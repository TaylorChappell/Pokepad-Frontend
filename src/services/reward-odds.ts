import { apiRequest } from './http';

export interface RewardOddsEntry {
  speciesId: number;
  shiny: boolean;
  backing: number;
  chance: number;
}
export interface RewardOdds {
  rewardId: string;
  gift: boolean;
  entries: RewardOddsEntry[];
}
export async function loadRewardOdds(
  id: string,
  signal?: AbortSignal,
  request = apiRequest,
): Promise<RewardOdds> {
  const result = await request<RewardOdds>('/v1/rewards/' + encodeURIComponent(id) + '/odds', {
    signal,
  });
  if (
    result?.rewardId !== id ||
    typeof result.gift !== 'boolean' ||
    !Array.isArray(result.entries) ||
    !result.entries.length ||
    result.entries.length > 302 ||
    !result.entries.every(
      (entry) =>
        entry !== null &&
        typeof entry === 'object' &&
        Number.isInteger(entry.speciesId) &&
        entry.speciesId >= 1 &&
        entry.speciesId <= 151 &&
        typeof entry.shiny === 'boolean' &&
        Number.isFinite(entry.chance) &&
        entry.chance > 0 &&
        entry.chance <= 1 &&
        Number.isFinite(entry.backing) &&
        entry.backing >= 0,
    ) ||
    Math.abs(result.entries.reduce((sum, entry) => sum + entry.chance, 0) - 1) > 0.000001
  )
    throw new Error('The chances could not be loaded. Please try again.');
  return result;
}
