import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';
import { pokemonById } from '../data/pokemon';
import { getPokemonHealth } from '../data/stats';
import { Button, Icon, PokemonArt, Pokeball } from './UI';
import {
  createOnlineBattle,
  currentBattleRoom,
  joinOnlineBattle,
  leaveOnlineBattle,
  listBattleRooms,
  newestBattleRoom,
  readBattleRoom,
  sendBattleCommand,
  type BattleRoom,
  type OnlineWager,
  type OpenBattleRoom,
} from '../services/battles';
import type { BattleAction } from '../battle/engine';

export function useOnlineBattle(enabled: boolean) {
  const { mode, session, reload } = useApp();
  const [room, setRoom] = useState<BattleRoom | null>(null);
  const [rooms, setRooms] = useState<OpenBattleRoom[]>([]);
  const [error, setError] = useState('');
  const [networkError, setNetworkError] = useState('');
  const [pending, setPending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const roomRef = useRef(room);
  roomRef.current = room;
  const pendingRef = useRef(false);
  const requestIds = useRef(new Map<string, string>());
  const generation = useRef(0);
  const restoredRoute = useRef('');
  const accept = useCallback((next: BattleRoom) => {
    setRoom((current) => newestBattleRoom(current, next));
    setConnected(true);
    setClockOffset(Date.parse(next.serverTime) - Date.now());
  }, []);
  useEffect(() => {
    generation.current++;
    setRoom(null);
    roomRef.current = null;
    requestIds.current.clear();
    restoredRoute.current = '';
  }, [session.wallet]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(() => {
    if (!enabled || mode !== 'live' || session.status !== 'authenticated') return;
    const controller = new AbortController();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        if (roomRef.current) {
          if (roomRef.current.status === 'active' || roomRef.current.status === 'waiting') {
            const next = await readBattleRoom(roomRef.current.id, controller.signal);
            if (!stopped) accept(next);
          }
        } else {
          const current = await currentBattleRoom(controller.signal);
          if (!stopped && current.room) accept(current.room);
          if (!current.room) {
            const routeRoom = new URLSearchParams(window.location.hash.split('?')[1]).get('room');
            if (routeRoom && restoredRoute.current !== routeRoom) {
              restoredRoute.current = routeRoom;
              try {
                const previous = await readBattleRoom(routeRoom, controller.signal);
                if (!stopped) accept(previous);
              } catch {
                // An invitation belongs to an unjoined trainer; its join form remains available.
              }
            }
            const response = await listBattleRooms(controller.signal);
            if (!stopped) setRooms(response.rooms);
          }
        }
        if (!stopped) {
          setConnected(true);
          setNetworkError('');
        }
      } catch (cause) {
        if (!stopped) {
          setConnected(false);
          setNetworkError(
            cause instanceof Error ? cause.message : 'Reconnecting to the battle server…',
          );
        }
      }
      if (!stopped) timer = setTimeout(poll, 2000);
    }
    void poll();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [enabled, mode, session.status, session.wallet, accept]);
  const mutation = async (run: () => Promise<BattleRoom>) => {
    if (pendingRef.current) return null;
    pendingRef.current = true;
    setPending(true);
    setError('');
    const epoch = generation.current;
    try {
      const next = await run();
      if (epoch !== generation.current) return null;
      const previousStatus = roomRef.current?.status;
      accept(next);
      if (next.status === 'waiting' || (next.status === 'active' && previousStatus !== 'active'))
        void reload();
      return next;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The battle server could not complete that action.',
      );
      return null;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };
  const keyFor = (key: string) => {
    if (!requestIds.current.has(key)) requestIds.current.set(key, crypto.randomUUID());
    return requestIds.current.get(key)!;
  };
  return {
    room,
    rooms,
    pending,
    error: error || networkError,
    connected,
    clockOffset,
    create: (ids: string[], wager: OnlineWager, visibility: 'public' | 'invite') =>
      mutation(() =>
        createOnlineBattle(
          ids,
          wager,
          visibility,
          keyFor(JSON.stringify(['create', ids, wager, visibility])),
        ),
      ),
    join: (id: string, ids: string[], wager: OnlineWager, code?: string) =>
      mutation(() => joinOnlineBattle(id, ids, wager, code)),
    command: (action: BattleAction) => {
      const current = roomRef.current;
      if (!current?.state || current.submitted || current.status !== 'active')
        return Promise.resolve(null);
      return mutation(() =>
        sendBattleCommand(
          current.id,
          current.state!.turn,
          action,
          keyFor(JSON.stringify(['command', current.id, current.state!.turn, action])),
        ),
      );
    },
    leave: async () => {
      if (!roomRef.current) return null;
      const next = await mutation(() => leaveOnlineBattle(roomRef.current!.id));
      if (next) await reload();
      return next;
    },
    clear: () => {
      setRoom(null);
      roomRef.current = null;
      requestIds.current.clear();
      void reload();
    },
  };
}

export function OnlineBattle({ online }: { online: ReturnType<typeof useOnlineBattle> }) {
  const { state, mode, session, connectWallet, now, toast } = useApp();
  const [selected, setSelected] = useState<string[]>([]);
  const [wager, setWager] = useState<OnlineWager>('friendly');
  const [visibility, setVisibility] = useState<'public' | 'invite'>('public');
  const [page, setPage] = useState(0);
  const [approved, setApproved] = useState(false);
  const [joinId, setJoinId] = useState(
    () => new URLSearchParams(window.location.hash.split('?')[1]).get('room') || '',
  );
  const [invite, setInvite] = useState(
    () => new URLSearchParams(window.location.hash.split('?')[1]).get('invite') || '',
  );
  useEffect(() => {
    const readInvitation = () => {
      const params = new URLSearchParams(window.location.hash.split('?')[1]);
      if (params.has('room')) {
        setJoinId(params.get('room') || '');
        setInvite(params.get('invite') || '');
        setApproved(false);
      }
    };
    window.addEventListener('hashchange', readInvitation);
    return () => window.removeEventListener('hashchange', readInvitation);
  }, []);
  const available = state.pokemon.filter(
    (pokemon) =>
      !pokemon.locked &&
      getPokemonHealth(pokemon).current > 0 &&
      (wager !== 'pokemon' || !pokemon.starter),
  );
  const ids = selected.filter((id) => available.some((pokemon) => pokemon.id === id));
  const room = online.room;
  const eligible = mode === 'live' && session.status === 'authenticated';
  const selectedRoom = online.rooms.find((item) => item.id === joinId);
  const risk = (selectedRoom?.wager || wager) === 'pokemon';
  const join = async () => {
    const next = await online.join(joinId, ids, selectedRoom?.wager || wager, invite || undefined);
    if (next) setApproved(false);
  };
  if (room)
    return (
      <section className="online-room-panel">
        <Pokeball size={44} />
        <h2>
          {room.status === 'waiting'
            ? 'Your room is ready'
            : room.status === 'active'
              ? 'Preparing your battle…'
              : 'Battle complete'}
        </h2>
        <p>
          {room.status === 'waiting'
            ? `Waiting for a trainer with ${room.teamSize} Pokémon. Your selected team is locked until the room closes.`
            : 'Your latest battle state is saved on the server.'}
        </p>
        <div className="online-party-preview">
          {room.yourPokemonIds.map((id) => {
            const pokemon = state.pokemon.find((item) => item.id === id);
            return pokemon ? (
              <PokemonArt key={id} id={pokemon.speciesId} shiny={pokemon.shiny} animated={false} />
            ) : null;
          })}
        </div>
        {room.status === 'waiting' && (
          <>
            <span className="online-room-time">
              Room expires in{' '}
              {Math.max(
                0,
                Math.ceil((Date.parse(room.deadlineAt!) - now - online.clockOffset) / 1000),
              )}
              s
            </span>
            <Button
              variant="secondary"
              onClick={async () => {
                const url = new URL(window.location.href);
                url.hash =
                  '/battles?room=' +
                  room.id +
                  (room.inviteCode ? '&invite=' + encodeURIComponent(room.inviteCode) : '');
                try {
                  await navigator.clipboard.writeText(url.toString());
                  toast('Battle invitation copied');
                } catch {
                  toast(url.toString());
                }
              }}
            >
              Copy invitation <Icon name="Copy" size={16} />
            </Button>
            <Button
              disabled={online.pending}
              onClick={async () => {
                if (await online.leave()) online.clear();
              }}
            >
              Close room
            </Button>
          </>
        )}
        {['finished', 'cancelled'].includes(room.status) && (
          <Button onClick={online.clear}>Back to rooms</Button>
        )}
        {online.error && <p role="alert">{online.error}</p>}
      </section>
    );
  return (
    <section className="online-battle-lobby">
      <div className="online-battle-builder">
        <div className="online-battle-title">
          <div>
            <h2>Meet your next rival</h2>
            <p>
              {eligible
                ? online.connected
                  ? 'Connected · moves are resolved by Kanto'
                  : 'Connecting to Kanto…'
                : mode === 'demo'
                  ? 'Online battles need a connected backend.'
                  : 'Connect your wallet to battle another trainer.'}
            </p>
          </div>
          <span>1–3 Pokémon</span>
        </div>
        {!eligible && mode === 'live' && (
          <Button
            onClick={() => void connectWallet('Phantom').catch((error) => toast(error.message))}
          >
            Connect wallet
          </Button>
        )}
        <div className="online-format-options" aria-label="Online battle format">
          <button
            aria-pressed={wager === 'friendly'}
            onClick={() => {
              setWager('friendly');
              setApproved(false);
              setPage(0);
            }}
          >
            Friendly <small>Keep your team</small>
          </button>
          <button
            aria-pressed={wager === 'pokemon'}
            onClick={() => {
              setWager('pokemon');
              setApproved(false);
              setPage(0);
            }}
          >
            Pokémon wager <small>Winner takes the team</small>
          </button>
        </div>
        <p className="online-escrow-note">
          SOL and token wagers are unavailable until on-chain battle escrow is enabled.
        </p>
        <div className="online-team-picker" aria-label="Choose your online battle team">
          {available.slice(page * 3, page * 3 + 3).map((pokemon) => (
            <button
              key={pokemon.id}
              aria-pressed={ids.includes(pokemon.id)}
              disabled={!ids.includes(pokemon.id) && ids.length >= 3}
              onClick={() => {
                setApproved(false);
                setSelected((current) =>
                  current.includes(pokemon.id)
                    ? current.filter((id) => id !== pokemon.id)
                    : [...current, pokemon.id],
                );
              }}
            >
              <PokemonArt id={pokemon.speciesId} shiny={pokemon.shiny} animated={false} />
              <strong>{pokemonById(pokemon.speciesId).name}</strong>
              <small>
                Lv.{pokemon.level} · {getPokemonHealth(pokemon).current} HP
              </small>
            </button>
          ))}
        </div>
        {!available.length && (
          <p>No eligible Pokémon. Choose a starter or open a reward to build your team.</p>
        )}
        <div className="online-party-pagination">
          <button disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
            Previous
          </button>
          <span>{ids.length}/3 selected</span>
          <button
            disabled={(page + 1) * 3 >= available.length}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
        <label className="online-room-visibility">
          Room visibility
          <select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as 'public' | 'invite')}
          >
            <option value="public">Public room</option>
            <option value="invite">Invitation only</option>
          </select>
        </label>
        {risk && (
          <label className="online-wager-consent">
            <input
              type="checkbox"
              checked={approved}
              onChange={(event) => setApproved(event.target.checked)}
            />
            I understand that losing or forfeiting transfers every Pokémon in my selected team to
            the winner.
          </label>
        )}
        <Button
          disabled={!eligible || !ids.length || online.pending || (risk && !approved)}
          onClick={() => void online.create(ids, wager, visibility)}
        >
          Create room <Icon name="Plus" size={16} />
        </Button>
        <small className="online-recovery-note">
          60 seconds per turn. Injured Pokémon recover after 10 minutes; awarded Pokémon arrive
          healed.
        </small>
      </div>
      <aside className="online-room-list">
        <h2>Open rooms</h2>
        {online.rooms
          .filter((item) => item.hostWallet !== state.profile.wallet)
          .map((item) => (
            <button
              className={joinId === item.id ? 'selected' : ''}
              key={item.id}
              onClick={() => {
                setJoinId(item.id);
                setWager(item.wager);
                setApproved(false);
                setPage(0);
                setInvite('');
              }}
            >
              <strong>{item.hostName}</strong>
              <span>
                {item.teamSize} Pokémon · {item.wager === 'friendly' ? 'Friendly' : 'Pokémon wager'}
              </span>
            </button>
          ))}
        {!online.rooms.length && (
          <p>
            {eligible
              ? 'No open rooms yet. Create one and invite a trainer.'
              : 'Rooms appear once you are connected.'}
          </p>
        )}
        <label>
          Room ID
          <input
            value={joinId}
            onChange={(event) => {
              setJoinId(event.target.value);
              setApproved(false);
            }}
            placeholder="Paste a room ID"
          />
        </label>
        <label>
          Invitation code
          <input
            value={invite}
            onChange={(event) => setInvite(event.target.value)}
            placeholder="Only for private rooms"
          />
        </label>
        {joinId && (
          <p>
            Joining locks your selected Pokémon. Confirm the room format with the host before
            joining.
          </p>
        )}
        <Button
          variant="secondary"
          disabled={!eligible || !joinId || !ids.length || online.pending || (risk && !approved)}
          onClick={() => void join()}
        >
          Join room <Icon name="ArrowRight" size={16} />
        </Button>
        {online.error && (
          <p className="online-error" role="alert">
            {online.error}
          </p>
        )}
      </aside>
    </section>
  );
}
