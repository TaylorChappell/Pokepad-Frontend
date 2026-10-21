import { getPokemonStats } from '../data/stats';
import { POKEMON } from '../data/pokemon';
import { pokemonRewardValue } from '../data/rewardPools';
import type { AppSnapshot, OwnedPokemon, PokemonCatalogue, VariantDiscoveries } from '../types';

/** Combat-stat total, independent of SOL value, shiny colour and favourite status. */
export function pokemonStrength(pokemon: Pick<OwnedPokemon, 'speciesId' | 'level'>): number {
  return Object.values(getPokemonStats(pokemon)).reduce((total, stat) => total + stat, 0);
}
export function comparePokemonStrength(a: OwnedPokemon, b: OwnedPokemon): number {
  return (
    pokemonStrength(b) - pokemonStrength(a) || a.speciesId - b.speciesId || a.id.localeCompare(b.id)
  );
}
/** Shared by every battle team picker. Favouriting never changes actual battle stats. */
export function compareBattlePokemon(a: OwnedPokemon, b: OwnedPokemon): number {
  return Number(!!b.favourite) - Number(!!a.favourite) || comparePokemonStrength(a, b);
}
const validIds = (values: unknown): number[] =>
  Array.isArray(values)
    ? [
        ...new Set(
          values.filter((id): id is number => Number.isInteger(id) && id >= 1 && id <= 151),
        ),
      ].sort((a, b) => a - b)
    : [];
export function variantDiscoveries(
  state: Pick<AppSnapshot, 'pokemon' | 'discovered' | 'discoveredVariants'>,
): VariantDiscoveries {
  const normal = new Set(validIds(state.discoveredVariants?.normal));
  const shiny = new Set(validIds(state.discoveredVariants?.shiny));
  for (const p of state.pokemon) (p.shiny ? shiny : normal).add(p.speciesId);
  const exact = new Set([...normal, ...shiny]);
  return {
    normal: [...normal].sort((a, b) => a - b),
    shiny: [...shiny].sort((a, b) => a - b),
    unknown: validIds([...state.discovered, ...(state.discoveredVariants?.unknown ?? [])]).filter(
      (id) => !exact.has(id),
    ),
  };
}
export function recordVariantDiscovery(state: AppSnapshot, speciesId: number, shiny = false): void {
  const history = variantDiscoveries(state);
  const key = shiny ? 'shiny' : 'normal';
  if (!history[key].includes(speciesId)) history[key].push(speciesId);
  history[key].sort((a, b) => a - b);
  history.unknown = history.unknown.filter((id) => id !== speciesId);
  state.discoveredVariants = history;
  if (!state.discovered.includes(speciesId)) state.discovered.push(speciesId);
}
/** Demo-only policy reference. Live pages require the catalogue supplied by the server. */
export function demoPokemonCatalogue(): PokemonCatalogue {
  const entries = POKEMON.map((p) => ({
    speciesId: p.id,
    normalValue: pokemonRewardValue(p.id),
    shinyValue: pokemonRewardValue(p.id, true),
  }));
  const total = (key: 'normalValue' | 'shinyValue') =>
    Number(entries.reduce((sum, entry) => sum + BigInt(Math.round(entry[key] * 1e9)), 0n)) / 1e9;
  return {
    policyVersion: 1,
    entries,
    totals: { normal: total('normalValue'), shiny: total('shinyValue') },
  };
}
