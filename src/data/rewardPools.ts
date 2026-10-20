import type { EggTier, Reward } from '../types';
import { POKEMON } from './pokemon';
import { BASE_STATS } from './stats';

export const LEGENDARY_IDS = [144, 145, 146, 150, 151] as const;
export const isLegendary = (speciesId: number) => LEGENDARY_IDS.some((id) => id === speciesId);

export interface RewardPoolEntry {
  speciesId: number;
  shiny: boolean;
  backing: number;
  evolutionReserve: number;
  weight: number;
  /** Fraction between 0 and 1, conditional on the supplied available budget. */
  chance: number;
}

type Group = 'common' | 'uncommon' | 'scarce' | 'legendary';
const groupOf = (id: number): Group => {
  if (isLegendary(id)) return 'legendary';
  if ([113, 131, 132, 133, 137, 142, 143, 147, 148, 149].includes(id)) return 'scarce';
  const total = BASE_STATS[id].reduce((sum, value) => sum + value, 0);
  return total > 500 ? 'scarce' : total > 350 ? 'uncommon' : 'common';
};

/** Demo prices are fixed per species and variant, not the tier of its originating reward. */
export function pokemonRewardValue(speciesId: number, shiny = false) {
  const group = groupOf(speciesId);
  const featuredValues: Record<number, number> = {
    1: 0.08,
    6: 0.42,
    9: 0.22,
    25: 0.12,
    94: 0.28,
    131: 0.2,
    133: 0.15,
    143: 0.32,
    149: 0.26,
  };
  const base =
    featuredValues[speciesId] ??
    (group === 'legendary'
      ? speciesId === 151
        ? 4
        : speciesId === 150
          ? 3.5
          : 2
      : group === 'scarce'
        ? 0.3
        : group === 'uncommon'
          ? 0.12
          : 0.04);
  return Math.round(base * (shiny ? 3 : 1) * 1e9) / 1e9;
}

/** Complete demo encounter table. A production API supplies the funded batch and outcome. */
export function rewardPool(
  tier: EggTier,
  kind: Reward['kind'],
  budget = Infinity,
): RewardPoolEntry[] {
  const chances: Record<EggTier, Record<Reward['kind'], Record<Group, number>>> = {
    Standard: {
      egg: { common: 7000, uncommon: 2400, scarce: 550, legendary: 50 },
      pack: { common: 8500, uncommon: 1300, scarce: 180, legendary: 20 },
    },
    Rare: {
      egg: { common: 3500, uncommon: 4500, scarce: 1800, legendary: 200 },
      pack: { common: 5500, uncommon: 3400, scarce: 1000, legendary: 100 },
    },
    Epic: {
      egg: { common: 1000, uncommon: 3500, scarce: 5000, legendary: 500 },
      pack: { common: 2500, uncommon: 4000, scarce: 3200, legendary: 300 },
    },
  };
  const groupCounts = { common: 0, uncommon: 0, scarce: 0, legendary: 0 };
  POKEMON.forEach((p) => groupCounts[groupOf(p.id)]++);
  const shinyBasisPoints =
    (tier === 'Epic' ? 400 : tier === 'Rare' ? 200 : 100) / (kind === 'pack' ? 2 : 1);
  const entries: RewardPoolEntry[] = [];
  for (const species of POKEMON) {
    const group = groupOf(species.id);
    for (const shiny of [false, true]) {
      const backing = pokemonRewardValue(species.id, shiny);
      const evolutionReserve = species.evolvesTo.length
        ? Math.max(0.02, Math.round(backing * 0.5 * 1e9) / 1e9)
        : 0;
      if (Math.round((backing + evolutionReserve) * 1e9) > Math.round(budget * 1e9)) continue;
      const weight = Math.max(
        1,
        Math.round(
          (chances[tier][kind][group] * (shiny ? shinyBasisPoints : 10000 - shinyBasisPoints)) /
            groupCounts[group],
        ),
      );
      entries.push({ speciesId: species.id, shiny, backing, evolutionReserve, weight, chance: 0 });
    }
  }
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  return entries.map((entry) => ({ ...entry, chance: entry.weight / total }));
}

export function drawReward(
  tier: EggTier,
  kind: Reward['kind'],
  budget: number,
  randomIndex: (length: number) => number,
) {
  const entries = rewardPool(tier, kind, budget);
  if (!entries.length) throw new Error('This reward pool does not have enough funding yet.');
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = randomIndex(total);
  if (!Number.isInteger(roll) || roll < 0 || roll >= total)
    throw new Error('The reward result was invalid. Please retry.');
  for (const entry of entries) {
    if (roll < entry.weight) return entry;
    roll -= entry.weight;
  }
  throw new Error('The reward result was invalid. Please retry.');
}
