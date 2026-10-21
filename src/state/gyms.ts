import { GYMS } from '../data/demo';
import { MOVE_OPTIONS } from '../data/moves';
import { DEMO_TRAINERS } from '../services/trainers';
import type { AppSnapshot } from '../types';
import { collectionValue } from './model';
import { pokemonStrength } from './collection';
import { gymPrize, type GymDefender } from '../game/gym-policy';
export function gymRankings(state: AppSnapshot) {
  return state.coins
    .filter((c) => c.active)
    .map((coin) => {
      const live = state.gyms?.find((g) => g.coinId === coin.id),
        seed = GYMS.find((g) => g.coinId === coin.id);
      const demo: GymDefender[] = state.gyms
        ? []
        : DEMO_TRAINERS.filter((t) => t.supportedGym === coin.id).flatMap((t) =>
            t.pokemon.map((p) => ({
              ...p,
              moves: MOVE_OPTIONS[p.speciesId]?.slice(0, 4) || ['Tackle'],
              strength: pokemonStrength(p),
              trainerWallet: t.wallet,
              trainerName: t.displayName,
            })),
          );
      if (!state.gyms && state.profile.supportedGym === coin.id && coin.holding > 0)
        demo.push(
          ...state.pokemon.map((p) => ({
            ...p,
            shiny: !!p.shiny,
            strength: pokemonStrength(p),
            trainerWallet: state.profile.wallet,
            trainerName: state.profile.displayName || 'You',
          })),
        );
      const defenders =
        live?.defenders ||
        demo
          .sort(
            (a, b) =>
              b.strength - a.strength || a.speciesId - b.speciesId || a.id.localeCompare(b.id),
          )
          .slice(0, 3);
      const strength = live?.strength ?? defenders.reduce((sum, p) => sum + p.strength, 0);
      return {
        coin,
        coinId: coin.id,
        name: live?.name || seed?.name || 'Team ' + coin.ticker,
        badge: coin.ticker,
        color: coin.color,
        supporters: state.gyms
          ? live?.supporters || 0
          : (seed?.supporters || 0) + (state.profile.supportedGym === coin.id ? 1 : 0),
        score: state.gyms
          ? live?.score || 0
          : (seed?.externalScore || 0) +
            (state.profile.supportedGym === coin.id ? collectionValue(state) : 0),
        strength,
        defenders,
        weeklyPoints: live?.weeklyPoints || 0,
        prize: live?.prize || gymPrize(strength),
      };
    })
    .sort(
      (a, b) =>
        b.weeklyPoints - a.weeklyPoints ||
        b.strength - a.strength ||
        a.coinId.localeCompare(b.coinId),
    );
}
