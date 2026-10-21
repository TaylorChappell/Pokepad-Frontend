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
export const GYM_MANUALS = [
  { move: 'Thunder Wave', wins: 1 },
  { move: 'Rest', wins: 3 },
  { move: 'Swords Dance', wins: 7 },
] as const;
export interface GymPrize {
  points: number;
  medals: number;
  items: Record<PcItem, number>;
}
export function gymPrize(strength: number): GymPrize {
  const s = Math.max(0, Math.floor(strength));
  return {
    points: Math.max(30, Math.floor(s / 10)),
    medals: Math.max(1, Math.floor(s / 400)),
    items: { berry: 1 + Math.floor(s / 1800), revive: 1 + Math.floor(s / 3000), potion: 0 },
  };
}
export interface GymDefender {
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
  medals: number;
  points: number;
  wins: number;
  manuals: string[];
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
