import type { Coin } from '../types';
import { asset } from '../utils';

/** An illustrative fixture rate, never a live SOL/USD price. */
export const DEMO_SOL_USD = 150;
const ages: Record<string, number> = {
  poke: 21,
  char: 14,
  geng: 7,
  squirt: 3,
  bulb: 2,
  eevee: 5,
  snorlax: 9,
  drago: 1,
};

export function decorateDemoCoins(coins: Coin[], now = Date.now()): Coin[] {
  return coins.map((coin) => ({
    ...coin,
    marketCapUsd: coin.marketCapUsd ?? coin.marketCap * DEMO_SOL_USD,
    volumeUsd: coin.volumeUsd ?? coin.volume * DEMO_SOL_USD,
    launchedAt: coin.launchedAt ?? (ages[coin.id] ? now - ages[coin.id] * 86400000 : undefined),
    image:
      coin.id === 'poke'
        ? asset('brand/kanto-emblem.png')
        : coin.image || (ages[coin.id] ? asset(`coins/${coin.id}.svg`) : undefined),
  }));
}
