import type { OwnedPokemon } from '../types';
import { getPokemonHealth } from '../data/stats';

export const DEMO_RECOVERY_MS = 10 * 60 * 1000;

/** Demo persistence only. Live recovery deadlines always come from the API. */
export function normalizeDemoRecovery(p: OwnedPokemon, now: number) {
  const hp = getPokemonHealth(p, now);
  p.health = hp.current;
  if (p.locked) return;
  if (hp.current === hp.max) delete p.recoverAt;
  else if (typeof p.recoverAt !== 'number' || !Number.isFinite(p.recoverAt) || p.recoverAt <= 0)
    p.recoverAt = now + DEMO_RECOVERY_MS;
}
