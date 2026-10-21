import type { AppSnapshot, OwnedPokemon } from '../types';
import { compareBattlePokemon, comparePokemonStrength } from './collection';
import { getEvolutionStatus, pendingMove } from './model';
export const POKEMON_SORTS = [
  'Ready first',
  'Strongest first',
  'Favourites first',
  'Highest value',
  'Highest level',
  'Newest',
] as const;
export function sortPokemon(
  list: OwnedPokemon[],
  sort: string,
  state?: AppSnapshot,
): OwnedPokemon[] {
  const ready = (p: OwnedPokemon) =>
    !p.locked && (!!pendingMove(p) || !!(state && getEvolutionStatus(state, p).canEvolve));
  return [...list].sort((a, b) => {
    if (sort === 'Highest value') return b.backing - a.backing || comparePokemonStrength(a, b);
    if (sort === 'Highest level') return b.level - a.level || comparePokemonStrength(a, b);
    if (sort === 'Newest') return b.acquiredAt - a.acquiredAt || comparePokemonStrength(a, b);
    if (sort === 'Favourites first') return compareBattlePokemon(a, b);
    if (sort === 'Ready first')
      return Number(ready(b)) - Number(ready(a)) || comparePokemonStrength(a, b);
    return comparePokemonStrength(a, b);
  });
}
