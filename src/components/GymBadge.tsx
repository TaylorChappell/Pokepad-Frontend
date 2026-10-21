import type { Coin } from '../types';
import { GYMS } from '../data/demo';
import { CoinAvatar } from './UI';

/** Resolve old achievement names without changing existing trainer saves. */
export function coinForBadge(coins: Coin[], badge: string): Coin | undefined {
  const exact = coins.find((coin) => coin.id === badge);
  if (exact) return exact;
  const legacyId =
    GYMS.find((gym) => gym.badge === badge)?.coinId || (badge === 'POKE' ? 'poke' : undefined);
  if (legacyId) return coins.find((coin) => coin.id === legacyId);
  const matches = coins.filter((coin) => coin.ticker === badge);
  return matches.length === 1 ? matches[0] : undefined;
}

export function GymBadge({ coin, size = 58 }: { coin: Coin; size?: number }) {
  return (
    <span className="gym-coin-badge" aria-label={coin.name + ' gym badge'}>
      <CoinAvatar coin={coin} size={size} />
    </span>
  );
}
