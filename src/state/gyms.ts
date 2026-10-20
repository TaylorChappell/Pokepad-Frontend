import { GYMS } from '../data/demo';
import type { AppSnapshot } from '../types';
import { collectionValue } from './model';
export function gymRankings(state: AppSnapshot) {
  return state.coins
    .filter((c) => c.active)
    .map((coin) => {
      const seeded = GYMS.find((g) => g.coinId === coin.id);
      return {
        coin,
        coinId: coin.id,
        name: seeded?.name || 'Team ' + coin.ticker,
        badge: coin.ticker,
        color: seeded?.color || coin.color,
        supporters: (seeded?.supporters || 0) + (state.profile.supportedGym === coin.id ? 1 : 0),
        score:
          (seeded?.externalScore || 0) +
          (state.profile.supportedGym === coin.id ? collectionValue(state) : 0),
      };
    })
    .sort((a, b) => b.score - a.score);
}
