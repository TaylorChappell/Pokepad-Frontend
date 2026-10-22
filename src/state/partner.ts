import type { AppSnapshot } from '../types';

/** Demo saves only. The live server owns and persists partner selection. */
export function ensureDemoPartner(state: AppSnapshot) {
  if (state.pokemon.some((p) => p.id === state.profile.equippedId)) return;
  const first = state.pokemon.reduce<(typeof state.pokemon)[number] | undefined>(
    (oldest, p) => (!oldest || p.acquiredAt < oldest.acquiredAt ? p : oldest),
    undefined,
  );
  state.profile.equippedId = first?.id ?? null;
}
