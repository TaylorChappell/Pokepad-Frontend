export type PcItem = 'berry' | 'revive' | 'potion';
export const PC_ITEMS: Record<
  PcItem,
  { name: string; description: string; fraction: number; fainted: boolean }
> = {
  berry: {
    name: 'Sitrus Berry',
    description: 'Restore 25% of maximum HP. Cannot revive a fainted Pokémon.',
    fraction: 0.25,
    fainted: false,
  },
  potion: {
    name: 'Potion',
    description: 'Restore 30% of maximum HP. Cannot revive a fainted Pokémon.',
    fraction: 0.3,
    fainted: false,
  },
  revive: {
    name: 'Revive',
    description: 'Bring a fainted Pokémon back with 50% HP.',
    fraction: 0.5,
    fainted: true,
  },
};
/** Every manual is a consumable item, usable on any Pokémon that does not know it. */
export const GYM_MANUALS = [
  ...[
    'Swift',
    'Rest',
    'Thunder Wave',
    'Swords Dance',
    'Agility',
    'Confusion',
    'Harden',
    'Leech Life',
    'Low Kick',
    'Sleep Powder',
  ].map((move) => ({ move, minStrength: 1200 })),
  ...[
    'Body Slam',
    'Rock Slide',
    'Double-Edge',
    'Slash',
    'Fly',
    'Dream Eater',
    'Razor Leaf',
    'Flamethrower',
    'Thunderbolt',
    'Ice Beam',
  ].map((move) => ({ move, minStrength: 1800 })),
  ...[
    'Earthquake',
    'Psychic',
    'Surf',
    'Fire Blast',
    'Hydro Pump',
    'Solar Beam',
    'Hyper Beam',
    'Dragon Rage',
    'Recover',
    'Fire Spin',
  ].map((move) => ({ move, minStrength: 2400 })),
];
export const manualPool = (strength: number) =>
  GYM_MANUALS.filter((m) => m.minStrength <= strength);
export function manualDropChance(strength: number) {
  return strength < 1200 ? 0 : strength < 1800 ? 0.25 : strength < 2400 ? 0.4 : 0.6;
}
export function drawGymManual(strength: number, random: () => number): string | null {
  const pool = manualPool(strength);
  if (!pool.length || random() >= manualDropChance(strength)) return null;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))].move;
}
export interface GymPrize {
  points: number;
  badges: number;
  manualChance: number;
  items: Record<PcItem, number>;
}
export function gymPrize(strength: number): GymPrize {
  const s = Math.max(0, Math.floor(strength));
  return {
    points: Math.max(30, Math.floor(s / 10)),
    badges: 1,
    manualChance: manualDropChance(s),
    items: { berry: 1 + Math.floor(s / 1800), revive: 1 + Math.floor(s / 3000), potion: 0 },
  };
}
export interface GymDefender {
  /** Only set for a battle-only copy of the coin's launch partner. */
  source?: 'partner';
  id: string;
  speciesId: number;
  level: number;
  shiny: boolean;
  moves: string[];
  strength: number;
  trainerWallet: string;
  trainerName: string;
}
export interface GymView {
  coinId: string;
  name: string;
  badge: string;
  color: string;
  supporters: number;
  score: number;
  strength: number;
  weeklyPoints: number;
  defenders: GymDefender[];
  prize: GymPrize;
}
export interface GymProgress {
  badges: number;
  points: number;
  wins: number;
  manuals: Record<string, number>;
  claimedToday: string[];
  activeChallengeId?: string;
}
export function pcItemHealth(item: PcItem, current: number, max: number): number | null {
  const rule = PC_ITEMS[item];
  if (!rule || (rule.fainted ? current !== 0 : current <= 0 || current >= max)) return null;
  return rule.fainted
    ? Math.max(1, Math.floor(max * rule.fraction))
    : Math.min(max, current + Math.max(1, Math.floor(max * rule.fraction)));
}
