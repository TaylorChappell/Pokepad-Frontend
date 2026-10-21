import { BASE_STATS, getPokemonStats } from '../data/stats';
import { MOVE_OPTIONS } from '../data/moves';
import type { GymDefender } from './gym-policy';

/** At most one battle-only partner fills a vacancy; they never enter anyone's inventory. */
export const GYM_PARTNER_LEVEL = 20;
export function completeGymDefenders(
  supporters: GymDefender[],
  coin: { id: string; launchKind?: string; pokemonId?: number; pokemonShiny?: boolean },
): GymDefender[] {
  const team = supporters.slice(0, 3);
  const speciesId = coin.pokemonId;
  if (team.length === 3 || coin.launchKind === 'trainer' || !speciesId || !BASE_STATS[speciesId])
    return team;
  const stats = getPokemonStats({ speciesId, level: GYM_PARTNER_LEVEL });
  const moves = [...new Set(MOVE_OPTIONS[speciesId] || ['Tackle', 'Growl'])].slice(0, 4);
  if (team.length < 3) {
    team.push({
      id: 'gym-partner:' + coin.id + ':' + team.length,
      speciesId,
      level: GYM_PARTNER_LEVEL,
      shiny: !!coin.pokemonShiny,
      moves: [...moves],
      strength: Object.values(stats).reduce((sum, stat) => sum + stat, 0),
      trainerWallet: '',
      trainerName: 'Gym partner',
      source: 'partner',
    });
  }
  return team;
}
