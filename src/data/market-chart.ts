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
  currency: 'USD';
  source: 'recorded' | 'demo';
}

/** Untimed price samples stay untimed. USD values use the supplied current quote, never a guessed rate. */
export function marketCapHistory(coin: Coin, demo: boolean): MarketCapHistory | null {
  const quotedCap = usdMarketCap(coin);
  const usdRate =
    Number.isFinite(coin.solUsd) && coin.solUsd! > 0
      ? coin.solUsd!
      : quotedCap !== null && quotedCap > 0 && Number.isFinite(coin.marketCap) && coin.marketCap > 0
        ? quotedCap / coin.marketCap
        : null;
  if (usdRate === null) return null;
  const samples = coin.marketCapHistory ?? coin.priceHistory;
  if (samples !== undefined) {
    if (
      samples.length < 2 ||
      !samples.every((value) => Number.isFinite(value) && value >= 0) ||
      (coin.marketCapHistory === undefined &&
        (!Number.isFinite(coin.totalSupply) || coin.totalSupply <= 0))
    )
      return null;
    // Explicit market-cap samples already include token supply. Legacy price samples do not.
    const supply = coin.marketCapHistory === undefined ? coin.totalSupply : 1;
    const values = samples.map((value) => value * supply * usdRate);
    return values.every(Number.isFinite) ? { values, currency: 'USD', source: 'recorded' } : null;
  }
  if (
    !demo ||
    !DEMO_CHART_COINS.has(coin.id) ||
    !Number.isFinite(coin.marketCap) ||
    coin.marketCap <= 0
  )
    return null;
  const seed = [...coin.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const last = coin.marketCap * usdRate;
  const change = Number.isFinite(coin.change) ? Math.max(-90, coin.change) / 100 : 0;
  const first = last / (1 + change);
  return {
    source: 'demo',
    currency: 'USD',
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

export function usdMarketCap(coin: Coin): number | null {
  return typeof coin.marketCapUsd === 'number' &&
    Number.isFinite(coin.marketCapUsd) &&
    coin.marketCapUsd >= 0
    ? coin.marketCapUsd
    : null;
}

export function marketCapLabel(value: number | null | undefined, precise = false): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '—';
  return (
    '$' +
    Intl.NumberFormat(
      'en',
      precise ? { maximumFractionDigits: 2 } : { notation: 'compact', maximumFractionDigits: 2 },
    ).format(value)
  );
}
