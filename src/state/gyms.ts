import { GYMS } from '../data/demo';
import type { AppSnapshot } from '../types';
import { collectionValue } from './model';
export function gymRankings(state: AppSnapshot) {
  return state.coins
    .filter((c) => c.active)
    .map((coin) => {
      const seeded = GYMS.find((g) => g.coinId === coin.id);
      const live = state.gyms?.find((gym) => gym.coinId === coin.id);
      if (state.gyms)
        return {
          coin,
          coinId: coin.id,
          name: live?.name || 'Team ' + coin.ticker,
          badge: coin.ticker,
          color: live?.color || coin.color,
          supporters: live?.supporters || 0,
          score: live?.score || 0,
        };
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
