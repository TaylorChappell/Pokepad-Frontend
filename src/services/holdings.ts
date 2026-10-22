import type { Coin } from '../types';

export function holdingStreakLabel(coin: Pick<Coin, 'holdingDays' | 'holdingStatus'>): string {
  if (coin.holdingStatus === 'syncing') return 'Checking history';
  if (coin.holdingStatus === 'unavailable') return 'Balance update delayed';
  const days = Math.max(0, coin.holdingDays);
  if (days < 1 / 24) return 'Just started';
  if (days < 1) {
    const hours = Math.floor(days * 24);
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const whole = Math.floor(days);
  return `${whole} day${whole === 1 ? '' : 's'}`;
}
