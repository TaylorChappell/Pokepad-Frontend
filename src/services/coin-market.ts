import { apiRequest, API_BASE } from './http';
export interface CoinTrade {
  id: string;
  signature: string;
  wallet: string;
  displayName: string | null;
  side: 'buy' | 'sell';
  solAmount: number;
  tokenAmount: number;
  createdAt: number;
}
export interface CoinHolder {
  wallet: string;
  displayName: string | null;
  tokenAmount: number;
  sharePercent: number;
  heldSince: number | null;
}
export interface CoinMarket {
  mint: string;
  updatedAt: number;
  indexedAt: number | null;
  syncing: boolean;
  holderCount: number;
  holdersCurrent: boolean;
  nextTradeCursor?: string | null;
  nextHolderCursor?: string | null;
  trades: CoinTrade[];
  holders: CoinHolder[];
}
const text = (v: unknown, length = 200): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= length;
const amount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const timestamp = (v: unknown): v is number => amount(v) && v <= 8.64e15;
export function parseCoinMarket(value: unknown, mint: string): CoinMarket {
  const d = value as CoinMarket;
  if (
    !d ||
    d.mint !== mint ||
    !timestamp(d.updatedAt) ||
    (d.indexedAt !== null && !timestamp(d.indexedAt)) ||
    typeof d.syncing !== 'boolean' ||
    typeof d.holdersCurrent !== 'boolean' ||
    !Number.isSafeInteger(d.holderCount) ||
    d.holderCount < 0 ||
    ![d.nextTradeCursor, d.nextHolderCursor].every((c) => c == null || text(c, 1024)) ||
    !Array.isArray(d.trades) ||
    d.trades.length > 100 ||
    !Array.isArray(d.holders) ||
    d.holders.length > 100 ||
    !d.trades.every(
      (t) =>
        t &&
        text(t.id) &&
        text(t.signature) &&
        text(t.wallet, 100) &&
        (t.displayName === null || text(t.displayName, 100)) &&
        ['buy', 'sell'].includes(t.side) &&
        amount(t.solAmount) &&
        amount(t.tokenAmount) &&
        timestamp(t.createdAt),
    ) ||
    !d.holders.every(
      (h) =>
        h &&
        text(h.wallet, 100) &&
        (h.displayName === null || text(h.displayName, 100)) &&
        amount(h.tokenAmount) &&
        amount(h.sharePercent) &&
        h.sharePercent <= 100 &&
        (h.heldSince === null || timestamp(h.heldSince)),
    )
  )
    throw new Error('Coin activity is temporarily unavailable.');
  return d;
}
export async function loadCoinMarket(
  mint: string,
  signal?: AbortSignal,
  base = API_BASE,
  page?: { tradeCursor?: string; holderCursor?: string },
) {
  const query = new URLSearchParams(page).toString();
  return parseCoinMarket(
    await apiRequest(
      '/v1/coins/' + encodeURIComponent(mint) + '/market' + (query ? '?' + query : ''),
      {
        base,
        signal,
        auth: false,
        credentials: 'omit',
        cache: 'no-store',
        timeoutMs: 12000,
      },
    ),
    mint,
  );
}
