import type { Coin } from '../types';

const DEMO_CHART_COINS = new Set([
  'poke',
  'char',
  'geng',
  'squirt',
  'bulb',
  'eevee',
  'snorlax',
  'drago',
]);

export interface MarketCapHistory {
  values: number[];
  currency: 'USD' | 'SOL';
  source: 'recorded' | 'demo';
}

/** Untimed price samples stay untimed. USD values use the supplied current quote, never a guessed rate. */
export function marketCapHistory(coin: Coin, demo: boolean): MarketCapHistory | null {
  const usdRate =
    Number.isFinite(coin.marketCapUsd) && coin.marketCapUsd! >= 0 && coin.marketCap > 0
      ? coin.marketCapUsd! / coin.marketCap
      : null;
  const multiplier = usdRate ?? 1;
  if (coin.priceHistory !== undefined) {
    if (
      coin.priceHistory.length < 2 ||
      !Number.isFinite(coin.totalSupply) ||
      coin.totalSupply <= 0 ||
      !coin.priceHistory.every((value) => Number.isFinite(value) && value >= 0)
    )
      return null;
    const values = coin.priceHistory.map((value) => value * coin.totalSupply * multiplier);
    return values.every(Number.isFinite)
      ? { values, currency: usdRate === null ? 'SOL' : 'USD', source: 'recorded' }
      : null;
  }
  if (
    !demo ||
    !DEMO_CHART_COINS.has(coin.id) ||
    !Number.isFinite(coin.marketCap) ||
    coin.marketCap <= 0
  )
    return null;
  const seed = [...coin.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const last = coin.marketCap * multiplier;
  const change = Number.isFinite(coin.change) ? Math.max(-90, coin.change) / 100 : 0;
  const first = last / (1 + change);
  return {
    source: 'demo',
    currency: usdRate === null ? 'SOL' : 'USD',
    values: Array.from({ length: 96 }, (_, index) => {
      const progress = index / 95;
      const movement =
        Math.sin(index * 0.35 + seed) * 0.045 + Math.sin(index * 0.91 + seed) * 0.013;
      return Math.max(
        0,
        first + (last - first) * progress + last * Math.sin(progress * Math.PI) * movement,
      );
    }),
  };
}

export function marketCapLabel(value: number, currency: 'USD' | 'SOL', precise = false): string {
  const formatted = Intl.NumberFormat(
    'en',
    precise
      ? { maximumFractionDigits: currency === 'USD' ? 2 : 4 }
      : { notation: 'compact', maximumFractionDigits: 2 },
  ).format(value);
  return currency === 'USD' ? '$' + formatted : formatted + ' SOL';
}
