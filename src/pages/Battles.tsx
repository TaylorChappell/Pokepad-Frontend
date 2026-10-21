import { BattleResult } from '../components/BattleResult';
import { useGymChallenge } from '../services/gyms';
import { gymRankings } from '../state/gyms';
import { GymDefenders, GymRewards } from './Community';
import { BattleTeamPicker, rememberBattleTeam } from '../components/BattleTeamPicker';
import { BattleBagMenu } from '../components/BattleBagMenu';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import { useApp } from '../state/AppContext';
import { pokemonById } from '../data/pokemon';
import { Avatar, Button, Icon, PokemonArt, Pokeball, TypeChip, Modal } from '../components/UI';
import { profileName } from '../state/model';
import { compareBattlePokemon } from '../state/collection';
import { TYPE_COLORS } from '../utils';
import { BattleSprite } from '../battle/BattleSprite';
import { createBattleScene, type BattleActorGeometry, type BattleScene } from '../battle/geometry';
import { preloadEffectSprites } from '../battle/effect-sprites';
import { getBodyPreviewManifest } from '../battle/body-animation';
import {
  getBodyAssetState,
  loadBodyManifest,
  preloadBattleBodies,
  subscribeBodyAsset,
} from '../battle/body-registry';
import { useBattleAudio } from '../battle/audio';
import { BattleEffects } from '../components/BattleEffects';
import { BattleSwitchEffects } from '../battle/BattleSwitchEffects';
import { createBattlePlayback, type BattleCue } from '../battle/presentation';
import {
  DIFFICULTIES,
  battleMove,
  battlePhase,
  createBattle,
  createPlayerTeam,
  createSeededRandom,
  generateRivalTeam,
  getMoveHint,
  moveCategory,
  resolveTurn,
  teamStrength,
  type BattleAction,
  type BattleState,
  type Difficulty,
  type Fighter,
} from '../battle/engine';

import { OnlineBattle, useOnlineBattle, EscrowFunding } from '../components/OnlineBattle';
import { battleWagerLabel } from '../services/battles';
import { monetaryBattleResult } from '../battle/result';

const difficultyNames = Object.keys(DIFFICULTIES) as Difficulty[];
const trainerCharacters = { Easy: 'leaf', Medium: 'brock', Hard: 'blue', Master: 'red' } as const;
const trainerColors = {
  Easy: '#65b883',
  Medium: '#efb13f',
  Hard: '#4e9ee8',
  Master: '#ef5357',
} as const;
const statusLabels = {
  burn: 'BRN',
  poison: 'PSN',
  paralysis: 'PAR',
  sleep: 'SLP',
  freeze: 'FRZ',
  none: '',
};

function Health({
  fighter,
  side,
  team,
}: {
  fighter: Fighter;
  side: 'player' | 'rival';
  team: Fighter[];
}) {
  const percent = Math.max(0, (fighter.hp / fighter.stats.hp) * 100);
  return (
    <section
      className={'classic-health classic-health-' + side}
      aria-label={`${pokemonById(fighter.speciesId).name}, ${fighter.hp} of ${fighter.stats.hp} HP`}
    >
      <div className="classic-health-name">
        <strong>{pokemonById(fighter.speciesId).name}</strong>
        <span>Lv.{fighter.level}</span>
      </div>
      <div className="classic-health-bar">
        <b>HP</b>
        <span>
          <i
            style={{
              width: percent + '%',
              background: percent > 50 ? '#43b16d' : percent > 20 ? '#efc34c' : '#e65e58',
            }}
          />
        </span>
      </div>
      <div className="classic-health-bottom">
        <span className="classic-team-balls">
          {team.map((member) => (
            <Pokeball key={member.id} size={12} className={member.hp <= 0 ? 'fainted' : ''} />
          ))}
        </span>
        {fighter.status !== 'none' && (
          <b className={'battle-condition condition-' + fighter.status}>
            {statusLabels[fighter.status]}
          </b>
        )}
        {side === 'player' && (
          <span>
            {fighter.hp}/{fighter.stats.hp}
          </span>
        )}
      </div>
    </section>
  );
}

function DifficultyPicker({
  value,
  onChange,
}: {
  value: Difficulty;
  onChange: (value: Difficulty) => void;
}) {
  return (
    <div className="classic-difficulties" aria-label="Bot difficulty">
      {difficultyNames.map((name, index) => (
        <button
          key={name}
          aria-label={name + ' difficulty'}
          aria-pressed={value === name}
          className={value === name ? 'selected' : ''}
          onClick={() => onChange(name)}
        >
          <span className="difficulty-portrait">
            <Avatar
              profile={{ character: trainerCharacters[name], accessoryColor: trainerColors[name] }}
              size={60}
            />
          </span>
          <span className="difficulty-label">
            <strong>{name}</strong>
            <small>
              {trainerCharacters[name][0].toUpperCase() + trainerCharacters[name].slice(1)}
            </small>
          </span>
          <span className="classic-difficulty-stars" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <i key={i} className={i <= index ? 'lit' : ''} />
            ))}
          </span>
        </button>
      ))}
    </div>
  );
}

function FieldGround({ scene }: { scene: BattleScene }) {
  return (
    <svg
      className="classic-ground"
      viewBox={`0 0 ${scene.width} ${scene.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="battle-grass" x2="0" y2="1">
          <stop stopColor="#a3eaa0" />
          <stop offset="1" stopColor="#56b66e" />
        </linearGradient>
        <pattern id="battle-grass-blades" width="28" height="14" patternUnits="userSpaceOnUse">
          <path
            d="M2 12 1 6 6 9 8 3 11 9 16 6 14 12M20 11l2-7 3 6"
            stroke="#4c9c5b"
            strokeWidth="2"
            fill="none"
          />
        </pattern>
      </defs>
      {(['rival', 'player'] as const).map((side) => {
        const { x, y, rx, ry } = scene.actors[side].ground;
        return (
          <g className={'classic-ground-' + side} key={side}>
            <ellipse cx={x} cy={y + ry * 0.14} rx={rx} ry={ry} fill="#a3ad56" />
            <ellipse
              cx={x}
              cy={y}
              rx={rx}
              ry={ry}
              fill="url(#battle-grass)"
              stroke="#668d4e"
              strokeWidth="2"
            />
            <ellipse
              cx={x}
              cy={y - ry * 0.08}
              rx={rx * 0.94}
              ry={ry * 0.78}
              fill="url(#battle-grass-blades)"
              opacity=".65"
            />
          </g>
        );
      })}
    </svg>
  );
}

function actorStyle(actor: BattleActorGeometry): CSSProperties {
  return {
    left: actor.rect.x,
    top: actor.rect.y,
    width: actor.rect.width,
    height: actor.rect.height,
    right: 'auto',
    bottom: 'auto',
  };
}

function useBattleBody(speciesId: number) {
  const state = useSyncExternalStore(
    (listener) => subscribeBodyAsset(speciesId, listener),
    () => getBodyAssetState(speciesId),
    () => getBodyAssetState(speciesId),
  );
  useEffect(() => {
    void loadBodyManifest(speciesId).catch(() => {});
  }, [speciesId]);
  return state.manifest || getBodyPreviewManifest(speciesId);
}

export function BattlesPage() {
  const { state, now, reload } = useApp();
  const [mode, setMode] = useState<'offline' | 'online' | 'gym'>(() =>
    new URLSearchParams(window.location.hash.split('?')[1]).has('gym')
      ? 'gym'
      : new URLSearchParams(window.location.hash.split('?')[1]).has('room')
        ? 'online'
        : 'offline',
  );
  const online = useOnlineBattle(mode === 'online');
  const gymId = new URLSearchParams(window.location.hash.split('?')[1]).get('gym') || '';
  const gymBattle = useGymChallenge(mode === 'gym', gymId);
  const gym = gymRankings(state).find((g) => g.coinId === (gymBattle.challenge?.coinId || gymId));
  const [forfeitConfirm, setForfeitConfirm] = useState(false);
  const [escrowDetails, setEscrowDetails] = useState(false);
  const settledRoom = useRef<string | null>(null);
  const [phase, setPhase] = useState<'lobby' | 'team' | 'battle'>(() =>
    mode === 'gym' ? 'team' : 'lobby',
  );
  useEffect(() => {
    const followInvitation = () => {
      if (phase === 'lobby' && new URLSearchParams(window.location.hash.split('?')[1]).has('room'))
        setMode('online');
    };
    window.addEventListener('hashchange', followInvitation);
    return () => window.removeEventListener('hashchange', followInvitation);
  }, [phase]);
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [matchSeed, setMatchSeed] = useState(() => Date.now());
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [displayBattle, setDisplayBattle] = useState<BattleState | null>(null);
  const [busy, setBusy] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const launchAttempt = useRef(0);
  const [command, setCommand] = useState<'root' | 'fight' | 'pokemon' | 'bag' | 'log'>('root');
  const [streak, setStreak] = useState(0);
  const [cue, setCue] = useState<BattleCue | null>(null);
  const [cueStartedAt, setCueStartedAt] = useState(0);
  const [visualFaintedIds, setVisualFaintedIds] = useState<Set<string>>(() => new Set());
  const [dialogue, setDialogue] = useState('');
  const [compactHeight, setCompactHeight] = useState(() => window.innerHeight <= 560);
  const field = useRef<HTMLDivElement>(null);
  const [fieldSize, setFieldSize] = useState({ width: 1000, height: 600 });
  useLayoutEffect(() => {
    const element = field.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 && height > 0)
        setFieldSize((previous) =>
          previous.width === width && previous.height === height ? previous : { width, height },
        );
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [phase, mode]);
  useEffect(() => {
    const resize = () => setCompactHeight(window.innerHeight <= 560);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const audio = useBattleAudio(phase === 'battle');
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    launchAttempt.current += 1;
    setLaunching(false);
    setLaunchError(null);
    if (phase === 'team') void preloadEffectSprites().catch(() => {});
  }, [phase, mode, selectedIds, difficulty, matchSeed]);
  useEffect(
    () => () => {
      launchAttempt.current += 1;
    },
    [],
  );
  const available = state.pokemon.filter((pokemon) => !pokemon.locked).sort(compareBattlePokemon);
  const chosen = useMemo(
    () =>
      selectedIds
        .map((id) => state.pokemon.find((pokemon) => pokemon.id === id))
        .filter((pokemon) => !!pokemon),
    [selectedIds, state.pokemon],
  );
  const rivals = useMemo(
    () => generateRivalTeam(chosen, difficulty, createSeededRandom(matchSeed)),
    [chosen, difficulty, matchSeed],
  );
  const ownPreview = useMemo(() => createPlayerTeam(chosen), [chosen]);
  const lobbyParty = chosen.length ? chosen : available.slice(0, 3);
  const lobbyRivals = useMemo(
    () => generateRivalTeam(lobbyParty, difficulty, createSeededRandom(matchSeed)),
    [chosen, state.pokemon, difficulty, matchSeed],
  );
  const visibleBattle = phase === 'battle' ? displayBattle || battle : null;
  const visiblePlayer = visibleBattle?.player[visibleBattle.active.player] || lobbyParty[0];
  const visibleRival = visibleBattle?.rival[visibleBattle.active.rival] || lobbyRivals[0];
  const playerBody = useBattleBody(visiblePlayer?.speciesId || 4);
  const rivalBody = useBattleBody(visibleRival?.speciesId || 7);
  useEffect(() => {
    if (phase === 'team') void preloadBattleBodies([...chosen, ...rivals]).catch(() => {});
  }, [phase, chosen, rivals]);
  const scene = useMemo(
    () =>
      createBattleScene({
        ...fieldSize,
        player: {
          speciesId: visiblePlayer?.speciesId || 4,
          shiny: visiblePlayer?.shiny,
          manifest: playerBody,
        },
        rival: {
          speciesId: visibleRival?.speciesId || 7,
          shiny: visibleRival?.shiny,
          manifest: rivalBody,
        },
      }),
    [
      fieldSize,
      playerBody,
      rivalBody,
      visiblePlayer?.speciesId,
      visiblePlayer?.shiny,
      visibleRival?.speciesId,
      visibleRival?.shiny,
    ],
  );
  const relativeStrength = ownPreview.length
    ? Math.round((teamStrength(rivals) / teamStrength(ownPreview)) * 100)
    : Math.round(DIFFICULTIES[difficulty].ratio * 100);
  const cancelLaunch = () => {
    launchAttempt.current += 1;
    setLaunching(false);
    setLaunchError(null);
  };
  const start = async (fresh = false) => {
    if (!chosen.length || launching) return;
    const attempt = ++launchAttempt.current;
    setLaunching(true);
    setLaunchError(null);
    clearTimeout(timer.current);
    audio.unlock();
    if (mode === 'gym') {
      const next = await gymBattle.start(chosen);
      if (next) rememberBattleTeam(state.profile.wallet, chosen);
      setLaunching(false);
      return;
    }
    const next = createBattle(
      chosen,
      fresh ? generateRivalTeam(chosen, difficulty) : rivals,
      difficulty,
    );
    try {
      await Promise.all([
        preloadEffectSprites(),
        preloadBattleBodies([...next.player, ...next.rival]),
      ]);
    } catch {
      if (launchAttempt.current === attempt) {
        setLaunching(false);
        setLaunchError('Battle artwork could not load. Check your connection and try again.');
      }
      return;
    }
    if (launchAttempt.current !== attempt) return;
    rememberBattleTeam(state.profile.wallet, chosen);
    setVisualFaintedIds(new Set());
    setBattle(next);
    setDisplayBattle(next);
    setPhase('battle');
    setBusy(false);
    setCue(null);
    setCommand('root');
    setDialogue('');
    setLaunching(false);
  };
  const animateTurn = (next: BattleState) => {
    if (!battle || busy) return;
    audio.unlock();
    setCommand('root');
    setBusy(true);
    const frames = createBattlePlayback(battle, next);
    let index = 0;
    let completedFaint: string | undefined;
    const advance = () => {
      if (completedFaint) {
        const id = completedFaint;
        setVisualFaintedIds((previous) => new Set([...previous, id]));
        completedFaint = undefined;
      }
      const frame = frames[index++];
      if (!frame) {
        setBattle(next);
        setDisplayBattle(next);
        setBusy(false);
        setCue(null);
        setDialogue('');
        if (next.winner) {
          setStreak((value) => (next.winner === 'player' ? value + 1 : 0));
          if (next.winner !== 'draw') audio.playCue(next.winner === 'player' ? 'win' : 'lose');
        }
        return;
      }
      if (frame.event.kind === 'item' && frame.event.itemTargetId) {
        const revivedId = frame.event.itemTargetId;
        setVisualFaintedIds((previous) => {
          const next = new Set(previous);
          next.delete(revivedId);
          return next;
        });
      }
      setDisplayBattle(frame.displayState);
      setDialogue(frame.event.text);
      const durationMs = state.profile.reducedMotion
        ? Math.min(frame.durationMs, 450)
        : frame.durationMs;
      setCueStartedAt(performance.now());
      setCue(frame.cue ? { ...frame.cue, durationMs } : null);
      if (frame.cue?.kind === 'faint') {
        const side = frame.cue.side;
        completedFaint = frame.displayState[side][frame.displayState.active[side]].id;
      }
      if (frame.cue?.moveName) audio.playMove(frame.cue.moveName);
      else if (frame.event.kind === 'switch' && frame.switch?.phase !== 'recall')
        audio.playCue('switch');
      else if (frame.event.kind === 'faint') audio.playCue('faint');
      else if (frame.event.kind === 'item') audio.playMove('Recover');
      timer.current = setTimeout(advance, durationMs);
    };
    advance();
  };
  useEffect(() => {
    const next = mode === 'gym' ? gymBattle.challenge?.state : online.room?.state;
    if (mode === 'offline' || !next || busy) return;
    if (!battle || phase !== 'battle') {
      let cancelled = false;
      setLaunching(true);
      void Promise.all([
        preloadEffectSprites(),
        preloadBattleBodies([...next.player, ...next.rival]),
      ])
        .then(() => {
          if (cancelled) return;
          setBattle(next);
          setDisplayBattle(next);
          setPhase('battle');
          setVisualFaintedIds(new Set());
          setCommand('root');
          setCue(null);
          setDialogue('');
          setLaunching(false);
          setLaunchError(null);
        })
        .catch(() => {
          if (!cancelled) {
            setLaunching(false);
            setLaunchError('Battle artwork could not load. Check your connection.');
          }
        });
      return () => {
        cancelled = true;
      };
    }
    if (
      next.turn !== battle.turn ||
      next.winner !== battle.winner ||
      next.active.player !== battle.active.player ||
      next.active.rival !== battle.active.rival ||
      battlePhase(next) !== battlePhase(battle)
    )
      animateTurn(next);
    if (online.room?.status === 'finished' && settledRoom.current !== online.room.id) {
      settledRoom.current = online.room.id;
      void reload();
    }
  }, [
    mode,
    online.room?.id,
    online.room?.revision,
    gymBattle.challenge?.id,
    gymBattle.challenge?.revision,
    busy,
    phase,
    battle?.turn,
    battle?.winner,
    battle?.active.player,
    battle?.active.rival,
    battle?.replacementRequired,
  ]);
  const play = (action: BattleAction) => {
    if (!battle || busy || battle.winner) return;
    if (mode === 'gym') {
      if (!gymBattle.pending) {
        setCommand('root');
        audio.unlock();
        void gymBattle.command(action);
      }
      return;
    }
    if (mode === 'online') {
      if (online.pending || online.room?.submitted) return;
      setCommand('root');
      audio.unlock();
      void online.command(action);
      return;
    }
    const next = resolveTurn(battle, action);
    if (next !== battle) animateTurn(next);
  };
  const resetMatch = () => {
    cancelLaunch();
    clearTimeout(timer.current);
    setBusy(false);
    setBattle(null);
    setDisplayBattle(null);
    setCue(null);
    setVisualFaintedIds(new Set());
    setPhase('lobby');
  };
  const leave = () => {
    if (
      battle &&
      !battle.winner &&
      (mode === 'offline' || mode === 'gym' || online.room?.status === 'active')
    ) {
      setForfeitConfirm(true);
      return;
    }
    if (mode === 'gym') {
      gymBattle.clear();
      window.location.hash = '/gym/' + (gym?.coinId || gymId);
      return;
    }
    if (mode === 'online') online.clear();
    resetMatch();
  };
  const heading = (
    <header className="classic-page-heading battle-page-heading">
      <div>
        <h1>{mode === 'gym' ? gym?.name || 'Gym challenge' : 'Battle arena'}</h1>
      </div>
      {phase === 'battle' ? (
        <div className="classic-match-tools">
          <span>Turn {Math.max(1, (displayBattle || battle)?.turn || 1)}</span>
          <button
            className="classic-sound"
            onClick={audio.toggleMuted}
            aria-label={audio.muted ? 'Enable battle sound' : 'Mute battle sound'}
            title={
              audio.musicUnavailable
                ? 'Music unavailable. Tap to retry sound.'
                : audio.muted
                  ? 'Sound off'
                  : 'Sound on'
            }
            data-audio-unavailable={audio.musicUnavailable || undefined}
            aria-pressed={!audio.muted}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9h4l5-4v14l-5-4H4Z" />
              {audio.muted ? (
                <path d="m17 9 5 6m0-6-5 6" />
              ) : (
                <>
                  <path d="M16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14" />
                </>
              )}
            </svg>
          </button>
          <button
            className="classic-exit"
            onClick={leave}
            aria-label={mode === 'online' ? 'Leave online battle' : 'Leave practice battle'}
          >
            <Icon name="X" size={18} />
          </button>
        </div>
      ) : mode === 'gym' ? (
        <a className="button secondary" href={'#/gym/' + (gym?.coinId || gymId)}>
          Back to gym
        </a>
      ) : (
        <div className="arena-mode-tabs">
          <button
            className={mode === 'offline' ? 'active' : ''}
            aria-pressed={mode === 'offline'}
            onClick={() => {
              cancelLaunch();
              setMode('offline');
              setPhase('lobby');
            }}
          >
            Offline
          </button>
          <button
            className={mode === 'online' ? 'active' : ''}
            aria-pressed={mode === 'online'}
            onClick={() => {
              cancelLaunch();
              setMode('online');
              setPhase('lobby');
            }}
          >
            Online
          </button>
        </div>
      )}
    </header>
  );

  if (phase === 'battle' && battle) {
    const view = displayBattle || battle;
    const current = view.player[view.active.player],
      opponent = view.rival[view.active.rival];
    const exhausted = current.pp.every((value) => value <= 0),
      lockedMove = current.charging;
    const playerFainted = visualFaintedIds.has(current.id) || (!busy && current.hp <= 0);
    const rivalFainted = visualFaintedIds.has(opponent.id) || (!busy && opponent.hp <= 0);
    const choosingReplacement = !battle.winner && !!battle.replacementRequired?.player;
    const awaitingRivalReplacement =
      !battle.winner && battlePhase(battle) === 'replacement' && !choosingReplacement;
    const waiting =
      mode === 'gym'
        ? gymBattle.pending
        : mode === 'online' &&
          (online.pending || !!online.room?.submitted || awaitingRivalReplacement);
    const partyMenu = !busy && !waiting && (choosingReplacement || command === 'pokemon');
    const controlsBusy = busy || waiting;
    const monetary =
      mode === 'online' && (online.room?.wager === 'sol' || online.room?.wager === 'token');
    const prompt = busy
      ? dialogue
      : waiting
        ? awaitingRivalReplacement
          ? 'Waiting for your rival to choose a Pokémon…'
          : choosingReplacement
            ? 'Your replacement is locked in. Waiting for your rival…'
            : 'Your move is locked in. Waiting for your rival…'
        : battle.winner
          ? battle.winner === 'player'
            ? 'You won the battle!'
            : battle.winner === 'draw'
              ? 'Both teams gave it everything.'
              : mode === 'online'
                ? 'Your rival won this battle.'
                : 'Your rival won the practice battle.'
          : choosingReplacement
            ? 'Choose your next Pokémon.'
            : current.recharge
              ? `${pokemonById(current.speciesId).name} needs to recharge.`
              : lockedMove
                ? `${lockedMove} is ready!`
                : `What will ${pokemonById(current.speciesId).name} do?`;
    return (
      <div className="battle-v8 battle-screen classic-match">
        {heading}
        {mode === 'online' && (
          <div className="online-match-notice" role="status">
            <span>
              {online.error ||
                (online.connected
                  ? 'Connected · server-authoritative battle'
                  : 'Reconnecting… Your battle continues on the server.')}
            </span>
            <span>
              {online.room?.deadlineAt && !battle.winner
                ? Math.max(
                    0,
                    Math.ceil(
                      (Date.parse(online.room.deadlineAt) - now - online.clockOffset) / 1000,
                    ),
                  ) + 's to choose'
                : monetary &&
                    online.room?.escrow?.status !== 'settled' &&
                    online.room?.escrow?.status !== 'refunded'
                  ? 'Settlement pending'
                  : 'Battle complete'}
            </span>
          </div>
        )}
        {mode === 'gym' && gymBattle.error && (
          <p className="online-error" role="alert">
            {gymBattle.error}
          </p>
        )}
        {mode === 'gym' && gymBattle.challenge?.result?.awarded && (
          <div className="gym-battle-reward-summary">
            +{gymBattle.challenge.prize.points} points · 1 badge ·{' '}
            {gymBattle.challenge.prize.items.berry} berries ·{' '}
            {gymBattle.challenge.prize.items.revive} revives
            {gymBattle.challenge.result.manuals.map((m) => (
              <span key={m}>Manual received: {m}</span>
            ))}
          </div>
        )}
        {escrowDetails && online.room && (
          <Modal title="Battle escrow" onClose={() => setEscrowDetails(false)}>
            <div className="modal-body">
              <EscrowFunding room={online.room} online={online} />
            </div>
          </Modal>
        )}
        {forfeitConfirm && (
          <Modal
            title="Surrender this battle?"
            onClose={() => setForfeitConfirm(false)}
            closeDisabled={mode === 'online' && online.pending}
          >
            <div className="modal-body">
              <p>
                {mode === 'online' && online.room?.wager === 'pokemon'
                  ? 'Your full selected team will transfer to the other trainer. This cannot be undone.'
                  : monetary && online.room
                    ? `Forfeiting awards your ${battleWagerLabel(online.room)} stake to your rival. Your Pokémon stay yours.`
                    : mode === 'offline'
                      ? 'The practice match ends in a loss. Your Pokémon and items in your collection are unchanged.'
                      : 'The other trainer wins. Your Pokémon stay in your collection.'}
              </p>
              <Button
                disabled={mode === 'online' && online.pending}
                onClick={async () => {
                  if (mode === 'offline') {
                    setForfeitConfirm(false);
                    clearTimeout(timer.current);
                    const result: BattleState = {
                      ...battle,
                      winner: 'rival',
                      events: [{ kind: 'result', text: 'You surrendered the practice battle.' }],
                    };
                    setBusy(false);
                    setBattle(result);
                    setDisplayBattle(result);
                    setCue(null);
                    setCommand('root');
                    audio.playCue('lose');
                  } else if (mode === 'gym') {
                    if (await gymBattle.surrender()) setForfeitConfirm(false);
                  } else if (await online.leave()) {
                    setForfeitConfirm(false);
                  }
                }}
              >
                Confirm surrender
              </Button>
              <Button
                variant="secondary"
                disabled={mode === 'online' && online.pending}
                onClick={() => setForfeitConfirm(false)}
              >
                Keep battling
              </Button>
            </div>
          </Modal>
        )}
        <section
          className="classic-handheld"
          aria-label="Pokémon battle"
          aria-busy={busy}
          data-state={busy ? 'playing' : battle.winner ? 'result' : command}
        >
          <div ref={field} className="battle-field classic-field" data-effect={cue?.family || ''}>
            <FieldGround scene={scene} />
            {battle.winner && !busy && (
              <BattleResult
                battle={battle}
                gym={mode === 'gym'}
                reducedMotion={state.profile.reducedMotion}
              />
            )}
            <Health fighter={opponent} side="rival" team={view.rival} />
            <Health fighter={current} side="player" team={view.player} />
            <div
              className={
                'classic-fighter classic-rival battle-placed-actor' +
                (rivalFainted ? ' is-fainted' : '')
              }
              style={actorStyle(scene.actors.rival)}
            >
              <BattleSprite
                speciesId={opponent.speciesId}
                shiny={opponent.shiny}
                side="rival"
                actor={scene.actors.rival}
                manifest={rivalBody}
                cue={cue}
                cueStartedAt={cueStartedAt}
                transition={
                  cue?.switchPhase && cue.side === 'rival'
                    ? {
                        phase: cue.switchPhase,
                        startedAt: cueStartedAt,
                        durationMs: cue.durationMs,
                      }
                    : undefined
                }
                paused={
                  rivalFainted || (busy && !cue) || (cue?.kind === 'switch' && cue.side === 'rival')
                }
                reducedMotion={state.profile.reducedMotion}
              />
            </div>
            <div
              className={
                'classic-fighter classic-player battle-placed-actor' +
                (playerFainted ? ' is-fainted' : '')
              }
              style={actorStyle(scene.actors.player)}
            >
              <BattleSprite
                speciesId={current.speciesId}
                shiny={current.shiny}
                side="player"
                actor={scene.actors.player}
                manifest={playerBody}
                cue={cue}
                cueStartedAt={cueStartedAt}
                transition={
                  cue?.switchPhase && cue.side === 'player'
                    ? {
                        phase: cue.switchPhase,
                        startedAt: cueStartedAt,
                        durationMs: cue.durationMs,
                      }
                    : undefined
                }
                paused={
                  playerFainted ||
                  (busy && !cue) ||
                  (cue?.kind === 'switch' && cue.side === 'player')
                }
                reducedMotion={state.profile.reducedMotion}
              />
            </div>
            <BattleEffects
              cue={cue?.kind === 'switch' ? null : cue}
              scene={scene}
              cueStartedAt={cueStartedAt}
              reducedMotion={state.profile.reducedMotion}
            />
            <BattleSwitchEffects
              cue={cue}
              scene={scene}
              cueStartedAt={cueStartedAt}
              reducedMotion={state.profile.reducedMotion}
            />
          </div>
          <div className={'classic-console command-' + (partyMenu ? 'pokemon' : command)}>
            {battle.winner && !busy ? (
              <div className="classic-result">
                <div>
                  <strong>
                    {battle.winner === 'player'
                      ? 'Victory!'
                      : battle.winner === 'draw'
                        ? 'A draw!'
                        : 'A good battle!'}
                  </strong>
                  <span>
                    {battle.turn - 1} turns · {streak} wins in a row
                  </span>
                  <small>
                    {mode === 'gym'
                      ? gymBattle.challenge?.result?.message
                      : mode === 'offline'
                        ? 'Your collection is unchanged.'
                        : monetary && online.room
                          ? monetaryBattleResult(online.room)
                          : online.room?.wager === 'pokemon' && battle.winner !== 'draw'
                            ? battle.winner === 'player'
                              ? 'The opposing team joined your PC.'
                              : 'Your wagered team transferred to the winner.'
                            : 'Your Pokémon stay yours. Injured Pokémon recover in 10 minutes.'}
                  </small>
                </div>
                <div>
                  {mode === 'gym' ? (
                    <Button onClick={leave}>Back to gym</Button>
                  ) : mode === 'online' ? (
                    <>
                      {monetary && (
                        <Button variant="secondary" onClick={() => setEscrowDetails(true)}>
                          Wager details
                        </Button>
                      )}
                      <Button onClick={leave}>Back to rooms</Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          cancelLaunch();
                          setBattle(null);
                          setDisplayBattle(null);
                          setPhase('lobby');
                          setMatchSeed((seed) => seed + 1);
                        }}
                      >
                        Change party
                      </Button>
                      <Button disabled={launching} onClick={() => start(true)}>
                        {launching
                          ? 'Preparing battle…'
                          : launchError
                            ? 'Retry battle'
                            : 'Play again'}
                        <Icon name="RefreshCw" size={15} />
                      </Button>
                    </>
                  )}
                  {launchError && (
                    <p className="battle-load-error" role="alert">
                      {launchError}
                    </p>
                  )}
                </div>
              </div>
            ) : busy || waiting || (command === 'root' && !partyMenu) ? (
              <>
                <div className="classic-dialogue" role="status" aria-live="polite">
                  <p>{prompt}</p>
                  {busy ? (
                    <span className="classic-dialogue-cursor" aria-hidden="true" />
                  ) : (
                    <small>
                      {current.trapped
                        ? 'Trapped · switching unavailable'
                        : lockedMove
                          ? 'Finish the charged move'
                          : current.recharge
                            ? 'Take a recovery turn'
                            : ''}
                    </small>
                  )}
                </div>
                <div className="classic-root-actions">
                  <button
                    className="classic-fight"
                    disabled={controlsBusy}
                    onClick={() => {
                      audio.playCue('select');
                      setCommand('fight');
                    }}
                  >
                    <span aria-hidden="true">▶</span>Fight
                  </button>
                  <button
                    className="classic-pokemon"
                    disabled={
                      controlsBusy || current.trapped > 0 || !!current.charging || current.recharge
                    }
                    onClick={() => {
                      audio.playCue('select');
                      setCommand('pokemon');
                    }}
                  >
                    <Pokeball size={24} />
                    Pokémon
                  </button>
                  <button
                    className="classic-bag"
                    disabled={controlsBusy}
                    onClick={() => {
                      audio.playCue('select');
                      setCommand('bag');
                    }}
                  >
                    <Icon name="Backpack" size={22} />
                    Bag
                  </button>
                  <button
                    className="classic-surrender"
                    disabled={online.pending && mode === 'online'}
                    onClick={() => setForfeitConfirm(true)}
                  >
                    <Icon name="Flag" size={22} />
                    Surrender
                  </button>
                </div>
              </>
            ) : command === 'bag' && !partyMenu ? (
              <BattleBagMenu
                state={battle}
                disabled={controlsBusy}
                onUse={play}
                onBack={() => setCommand('root')}
              />
            ) : command === 'fight' && !partyMenu ? (
              <>
                <div className="battle-moves classic-moves">
                  {(lockedMove
                    ? [lockedMove]
                    : current.recharge
                      ? [current.moves[0]]
                      : exhausted
                        ? ['Struggle']
                        : current.moves
                  ).map((name) => {
                    const move = battleMove(name),
                      index = current.moves.indexOf(name);
                    return (
                      <button
                        key={name}
                        style={
                          { '--move-color': TYPE_COLORS[move.type] || '#718797' } as CSSProperties
                        }
                        disabled={
                          controlsBusy ||
                          (!current.recharge && !lockedMove && current.pp[index] <= 0 && !exhausted)
                        }
                        onClick={() =>
                          play({ kind: 'move', index: name === 'Struggle' ? -1 : index })
                        }
                        title={
                          current.recharge
                            ? 'Recover this turn'
                            : getMoveHint(current, opponent, name)
                        }
                      >
                        <strong>{current.recharge ? 'Recharge' : name}</strong>
                        <span>
                          <b>{move.type}</b>
                          <small>{exhausted ? '—' : `${current.pp[index]}/${move.pp}`} PP</small>
                        </span>
                        <small className="classic-move-detail">
                          {moveCategory(move)}
                          {move.power ? ` · ${move.power}` : ''}
                        </small>
                      </button>
                    );
                  })}
                </div>
                <button className="classic-menu-back" onClick={() => setCommand('root')}>
                  <Icon name="ArrowLeft" size={18} />
                  <span>Back</span>
                </button>
              </>
            ) : partyMenu ? (
              <>
                <div className="classic-party-menu">
                  {view.player.map((fighter, index) => (
                    <button
                      key={fighter.id}
                      disabled={
                        controlsBusy ||
                        fighter.hp <= 0 ||
                        index === view.active.player ||
                        (!choosingReplacement &&
                          (current.trapped > 0 || !!current.charging || current.recharge))
                      }
                      onClick={() =>
                        play({ kind: choosingReplacement ? 'replace' : 'switch', index })
                      }
                      aria-label={`${choosingReplacement ? 'Send out' : 'Switch to'} ${pokemonById(fighter.speciesId).name}`}
                    >
                      <PokemonArt id={fighter.speciesId} shiny={fighter.shiny} animated={false} />
                      <span>
                        <strong>{pokemonById(fighter.speciesId).name}</strong>
                        <small>
                          {fighter.hp}/{fighter.stats.hp} HP
                          {fighter.hp <= 0
                            ? ' · Fainted'
                            : index === view.active.player
                              ? ' · In battle'
                              : ''}
                        </small>
                        <i>
                          <b
                            style={{
                              width: Math.max(0, (fighter.hp / fighter.stats.hp) * 100) + '%',
                            }}
                          />
                        </i>
                      </span>
                    </button>
                  ))}
                </div>
                {choosingReplacement ? (
                  <div
                    className="classic-menu-back"
                    role="status"
                    aria-label="Choose your next Pokémon"
                  >
                    <Pokeball size={22} />
                    <span>Choose next</span>
                  </div>
                ) : (
                  <button className="classic-menu-back" onClick={() => setCommand('root')}>
                    <Icon name="ArrowLeft" size={18} />
                    <span>Back</span>
                  </button>
                )}
              </>
            ) : (
              <div className="classic-log">
                <div>
                  {battle.history.slice(-6).map((event, index) => (
                    <p key={index}>{event.text}</p>
                  ))}
                </div>
                <button onClick={() => setCommand('root')}>Back</button>
              </div>
            )}
          </div>
        </section>
        <footer className="classic-match-footer">
          <span>
            {profileName(state)} <b>vs</b>{' '}
            {mode === 'online'
              ? online.room?.trainers.find((trainer) => trainer.wallet !== state.profile.wallet)
                  ?.displayName || 'Trainer'
              : mode === 'gym'
                ? gym?.name
                : difficulty}
          </span>
          <span>
            {mode === 'online'
              ? online.room
                ? online.room.wager === 'pokemon'
                  ? 'Pokémon wager · all selected Pokémon'
                  : online.room.wager === 'friendly'
                    ? 'Friendly · no stakes'
                    : battleWagerLabel(online.room) + ' per trainer'
                : 'Connecting'
              : null}
          </span>
        </footer>
      </div>
    );
  }

  if (mode === 'gym' && phase !== 'battle')
    return (
      <div className="battle-v8 battle-screen classic-team-screen gym-team-screen">
        {heading}
        <div className="classic-team-desk">
          <section className="classic-team-pick slot-team-pick">
            <BattleTeamPicker
              pokemon={state.pokemon}
              selected={selectedIds}
              onChange={setSelectedIds}
              disabled={launching || gymBattle.pending}
            />
          </section>
          <aside className="battle-review classic-team-review">
            <h2>Gym defenders</h2>
            {gym && (
              <>
                <GymDefenders defenders={gym.defenders} compact />
                <GymRewards prize={gym.prize} />
              </>
            )}
            <p>3 Pokémon each · original levels · equal battle bags</p>
            <Button
              disabled={
                chosen.length !== 3 ||
                !gym ||
                gym.defenders.length !== 3 ||
                launching ||
                gymBattle.pending
              }
              onClick={() => start()}
            >
              {launching || gymBattle.pending ? 'Preparing challenge…' : 'Start gym challenge'}
            </Button>
            <p>
              Your team’s current HP carries into this challenge. Injured Pokémon recover afterward
              or can use items in My PC.
            </p>
            {(gymBattle.error || launchError) && (
              <p role="alert" className="online-error">
                {gymBattle.error || launchError}
              </p>
            )}
            {!gym && <p>Loading this gym…</p>}
          </aside>
        </div>
      </div>
    );

  return (
    <div className="battle-v8 battle-screen arena-lobby">
      {heading}
      {mode === 'offline' ? (
        <div className="classic-lobby-grid">
          <section className="arena-hero classic-lobby-board">
            <div ref={field} className="classic-preview-field">
              <FieldGround scene={scene} />

              <div className="classic-preview-caption">
                <h2>Your next challenger.</h2>
                <p>Choose your rival and your team.</p>
              </div>
              <div
                className="classic-preview-player battle-placed-actor"
                style={actorStyle(scene.actors.player)}
              >
                <BattleSprite
                  speciesId={lobbyParty[0]?.speciesId || 4}
                  shiny={lobbyParty[0]?.shiny}
                  side="player"
                  actor={scene.actors.player}
                  manifest={playerBody}
                  reducedMotion={state.profile.reducedMotion}
                />
              </div>
              <div
                className="classic-preview-rival battle-placed-actor"
                style={actorStyle(scene.actors.rival)}
              >
                <BattleSprite
                  speciesId={lobbyRivals[0]?.speciesId || 7}
                  side="rival"
                  actor={scene.actors.rival}
                  manifest={rivalBody}
                  reducedMotion={state.profile.reducedMotion}
                />
              </div>
              <span className="classic-preview-versus">VS</span>
            </div>
            <BattleTeamPicker
              pokemon={state.pokemon}
              selected={selectedIds}
              onChange={(ids) => {
                cancelLaunch();
                setSelectedIds(ids);
              }}
              disabled={launching}
            />
            <div className="classic-lobby-actions">
              <span>{chosen.length ? chosen.length + ' Pokémon selected' : ''}</span>
              <Button disabled={!chosen.length || launching} onClick={() => start()}>
                {launching ? 'Preparing battle…' : 'Start battle'}
                <Icon name="Swords" size={17} />
              </Button>
            </div>
            {launchError && (
              <p className="battle-load-error" role="alert">
                {launchError}
              </p>
            )}
          </section>
          <aside className="classic-rival-desk">
            <h2>Choose a rival</h2>
            <p>How tough should the match be?</p>
            <DifficultyPicker
              value={difficulty}
              onChange={(value) => {
                cancelLaunch();
                setDifficulty(value);
              }}
            />
            <div className="classic-difficulty-note">
              <strong>{difficulty} challenge</strong>
              <p>{DIFFICULTIES[difficulty].detail}</p>
              {streak > 0 && <span>{streak} wins in a row</span>}
            </div>
            <a href="#/guide?topic=battles">
              <Icon name="BookOpen" size={16} />
              Battle guide
              <Icon name="ArrowUpRight" size={14} />
            </a>
          </aside>
        </div>
      ) : (
        <OnlineBattle online={online} />
      )}
    </div>
  );
}
