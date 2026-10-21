import { useEffect, useRef, useState } from 'react';
import { apiRequest } from './http';
import { useApp } from '../state/AppContext';
import { gymRankings } from '../state/gyms';
import {
  createBattle,
  createPlayerTeam,
  resolveTurn,
  battlePhase,
  type BattleAction,
  type BattleState,
} from '../battle/engine';
import type { OwnedPokemon } from '../types';
import type { GymPrize } from '../game/gym-policy';
export interface GymChallenge {
  id: string;
  coinId: string;
  state: BattleState;
  status: 'active' | 'finished';
  revision: number;
  strength: number;
  prize: GymPrize;
  expiresAt: string;
  result: null | {
    winner: string;
    reason: string;
    awarded: boolean;
    message: string;
    prize: GymPrize | null;
    manuals: string[];
  };
}
export function useGymChallenge(enabled: boolean, coinId: string) {
  const app = useApp(),
    { mode, state, act, reload } = app;
  const [challenge, setChallenge] = useState<GymChallenge | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const inFlight = useRef(false),
    epoch = useRef(0),
    startRequest = useRef<{ key: string; id: string } | null>(null);
  const wallet = state.profile.wallet;
  useEffect(() => {
    epoch.current++;
    setChallenge(null);
    setError('');
    setPending(false);
    inFlight.current = false;
    startRequest.current = null;
  }, [enabled, wallet, coinId]);
  const task = async <T>(work: () => Promise<T>): Promise<T | null> => {
    if (inFlight.current) return null;
    const generation = epoch.current;
    inFlight.current = true;
    setPending(true);
    setError('');
    try {
      const value = await work();
      return generation === epoch.current ? value : null;
    } catch (e) {
      if (generation === epoch.current)
        setError(e instanceof Error ? e.message : 'Could not update the gym battle.');
      return null;
    } finally {
      if (generation === epoch.current) {
        inFlight.current = false;
        setPending(false);
      }
    }
  };
  useEffect(() => {
    if (!enabled || mode !== 'live' || app.session.status !== 'authenticated') return;
    const id =
      new URLSearchParams(window.location.hash.split('?')[1]).get('challenge') ||
      state.gymProgress?.activeChallengeId;
    if (!id) return;
    const controller = new AbortController();
    void apiRequest<GymChallenge>('/v1/gym-challenges/' + encodeURIComponent(id), {
      signal: controller.signal,
    })
      .then((c) => {
        if (!controller.signal.aborted) setChallenge(c);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [enabled, mode, wallet, app.session.status]);
  async function finishDemo(c: GymChallenge): Promise<GymChallenge> {
    if (!c.state.winner) return c;
    const next = await act({
      type: 'gym.demo.finish',
      id: c.id,
      coinId: c.coinId,
      prize: c.prize,
      winner: c.state.winner === 'player',
      health: c.state.player.map((p) => ({ id: p.id, hp: p.hp })),
    });
    const awarded = !!next && (next.gymProgress?.wins || 0) > (state.gymProgress?.wins || 0);
    return {
      ...c,
      status: 'finished',
      result: {
        winner: c.state.winner,
        reason: 'battle',
        awarded,
        prize: awarded ? c.prize : null,
        manuals: (next?.gymProgress?.manuals || []).filter(
          (m) => !state.gymProgress?.manuals.includes(m),
        ),
        message: awarded
          ? 'Rewards added to your demo bag.'
          : c.state.winner === 'player'
            ? 'Practice complete. No additional rewards.'
            : 'Your team can recover with supplies in My PC.',
      },
    };
  }
  const start = async (pokemon: OwnedPokemon[]) => {
    const generation = epoch.current;
    const c = await task(async () => {
      if (mode === 'live') {
        const key = coinId + ':' + pokemon.map((p) => p.id).join(',');
        if (startRequest.current?.key !== key)
          startRequest.current = { key, id: crypto.randomUUID() };
        return apiRequest<GymChallenge>('/v1/gym-challenges', {
          method: 'POST',
          json: {
            requestId: startRequest.current.id,
            coinId,
            pokemonIds: pokemon.map((p) => p.id),
          },
        });
      }
      const gym = gymRankings(state).find((g) => g.coinId === coinId);
      if (!gym || gym.defenders.length !== 3 || pokemon.length !== 3)
        throw new Error('Both gym teams need three Pokémon.');
      const rivals = createPlayerTeam(
        gym.defenders.map((p) => ({ ...p, id: 'defender:' + p.id })) as unknown as OwnedPokemon[],
      );
      const engine = createBattle(pokemon, rivals, 'Master');
      // Practice arena resets HP; gym challenges respect collection health.
      engine.player.forEach(
        (p, i) => (p.hp = Math.min(p.stats.hp, pokemon[i].health ?? p.stats.hp)),
      );
      return {
        id: crypto.randomUUID(),
        coinId,
        state: engine,
        status: 'active' as const,
        revision: 1,
        strength: gym.strength,
        prize: gym.prize,
        result: null,
        expiresAt: new Date(Date.now() + 30 * 60000).toISOString(),
      };
    });
    if (c && generation === epoch.current) setChallenge(c);
    return c;
  };
  const command = async (action: BattleAction) => {
    if (!challenge || challenge.status !== 'active') return;
    const generation = epoch.current;
    const c = await task(async () =>
      mode === 'live'
        ? apiRequest<GymChallenge>('/v1/gym-challenges/' + challenge.id + '/commands', {
            method: 'POST',
            json: {
              requestId: crypto.randomUUID(),
              turn: challenge.state.turn,
              phase: battlePhase(challenge.state),
              action,
            },
          })
        : finishDemo({
            ...challenge,
            state: resolveTurn(challenge.state, action),
            revision: challenge.revision + 1,
          }),
    );
    if (c && generation === epoch.current) {
      setChallenge(c);
      if (c.status === 'finished' && mode === 'live') void reload();
    } else if (mode === 'live' && generation === epoch.current) {
      try {
        const latest = await apiRequest<GymChallenge>('/v1/gym-challenges/' + challenge.id);
        if (generation === epoch.current) setChallenge(latest);
      } catch {
        /* The visible Retry button remains available. */
      }
    }
  };
  const surrender = async () => {
    if (!challenge) return false;
    const generation = epoch.current;
    const c = await task(async () =>
      mode === 'live'
        ? apiRequest<GymChallenge>('/v1/gym-challenges/' + challenge.id + '/surrender', {
            method: 'POST',
            json: {},
          })
        : finishDemo({
            ...challenge,
            state: {
              ...challenge.state,
              winner: 'rival',
              events: [{ kind: 'result', text: 'You surrendered the gym challenge.' }],
            },
            revision: challenge.revision + 1,
          }),
    );
    if (c && generation === epoch.current) {
      setChallenge(c);
      if (mode === 'live') void reload();
      return true;
    }
    return false;
  };
  return { challenge, pending, error, start, command, surrender, clear: () => setChallenge(null) };
}
