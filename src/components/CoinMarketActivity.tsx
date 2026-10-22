import { useEffect, useState } from 'react';
import { loadCoinMarket, type CoinMarket } from '../services/coin-market';
import { API_BASE } from '../services/http';
import { compact, relativeTime, sol } from '../utils';
import { Icon } from './UI';

const shortWallet = (wallet: string) => wallet.slice(0, 4) + '…' + wallet.slice(-4);
export function CoinMarketActivity({
  mint,
  kind,
  base = API_BASE,
  onHolderCount,
}: {
  mint: string;
  kind: 'Transactions' | 'Holders';
  base?: string;
  onHolderCount?: (value: { mint: string; count: number }) => void;
}) {
  const [data, setData] = useState<CoinMarket | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false,
      busy = false;
    const controller = new AbortController();
    setData(null);
    setFailed(false);
    async function refresh() {
      if (busy || disposed || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        const response = await loadCoinMarket(mint, controller.signal, base);
        if (!disposed) {
          setData(response);
          setFailed(false);
        }
      } catch {
        if (!disposed) setFailed(true);
      } finally {
        busy = false;
      }
    }
    void refresh();
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [mint, base, attempt]);
  useEffect(() => {
    if (data) onHolderCount?.({ mint: data.mint, count: data.holderCount });
  }, [data, onHolderCount]);
  const trades = kind === 'Transactions';
  const catchingUp = data?.syncing && (trades || !data.holdersCurrent);
  if (!data && !failed)
    return (
      <div className="coin-feed-loading" role="status" aria-label={'Loading ' + kind.toLowerCase()}>
        <span>Loading {kind.toLowerCase()}…</span>
        {[0, 1, 2, 3].map((n) => (
          <div className="coin-feed-skeleton" key={n} />
        ))}
      </div>
    );
  if (!data)
    return (
      <div className="kanto-market-data-empty">
        <Icon name={trades ? 'Activity' : 'Users'} size={28} />
        <h3>{trades ? 'Trades' : 'Holders'} couldn’t be loaded</h3>
        <p>Please try again in a moment.</p>
        <button type="button" className="text-link" onClick={() => setAttempt((v) => v + 1)}>
          Try again <Icon name="RefreshCw" size={14} />
        </button>
      </div>
    );
  const rows = trades ? data.trades : data.holders;
  return (
    <div className="coin-market-feed">
      <div className="kanto-market-section-caption">
        <span>{trades ? 'Recent trades' : 'Community holders'}</span>
        <span>
          {trades
            ? 'Confirmed on Solana'
            : data.holderCount.toLocaleString() + (data.holderCount === 1 ? ' holder' : ' holders')}
        </span>
      </div>
      {failed && (
        <p className="coin-feed-note" role="status">
          Updates are delayed. We’ll try again shortly.
        </p>
      )}
      {catchingUp && (
        <p className="coin-feed-note" role="status">
          <Icon name="Clock" size={14} />
          Earlier activity is still being added. This list updates automatically.
        </p>
      )}
      {!rows.length ? (
        <div className="kanto-market-data-empty">
          <Icon name={trades ? 'Activity' : 'Users'} size={28} />
          <h3>
            {catchingUp
              ? trades
                ? 'Trade history is catching up'
                : 'Holder history is catching up'
              : trades
                ? 'No trades yet'
                : 'No holders yet'}
          </h3>
          <p>
            {catchingUp
              ? 'Your coin’s activity will appear as it is verified.'
              : trades
                ? 'Confirmed buys and sells will appear here.'
                : 'Wallets holding this coin will appear here.'}
          </p>
        </div>
      ) : (
        <div className="kanto-market-table-scroll">
          <table className="kanto-market-table coin-feed-table">
            <thead>
              <tr>
                <th>Trainer</th>
                {trades ? (
                  <>
                    <th>Side</th>
                    <th>SOL</th>
                    <th>Tokens</th>
                  </>
                ) : (
                  <>
                    <th>Tokens</th>
                    <th>Supply</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {trades
                ? data.trades.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <a
                          href={
                            t.displayName
                              ? '#/trainer/' + encodeURIComponent(t.wallet)
                              : 'https://solscan.io/account/' + encodeURIComponent(t.wallet)
                          }
                          title={t.wallet}
                        >
                          <span className="coin-feed-trainer">
                            {t.displayName || shortWallet(t.wallet)}
                          </span>
                        </a>
                        <a
                          className="coin-feed-tx"
                          href={'https://solscan.io/tx/' + encodeURIComponent(t.signature)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={'View transaction ' + t.signature}
                        >
                          {relativeTime(t.createdAt)}
                          <Icon name="ArrowUpRight" size={12} />
                        </a>
                      </td>
                      <td>
                        <span
                          className={
                            'kanto-market-trade-tag ' + (t.side === 'buy' ? 'is-buy' : 'is-sell')
                          }
                        >
                          {t.side === 'buy' ? 'Buy' : 'Sell'}
                        </span>
                      </td>
                      <td title={t.solAmount.toString()}>{sol(t.solAmount)}</td>
                      <td title={t.tokenAmount.toLocaleString()}>{compact(t.tokenAmount)}</td>
                    </tr>
                  ))
                : data.holders.map((h) => (
                    <tr key={h.wallet}>
                      <td>
                        <a
                          href={
                            h.displayName
                              ? '#/trainer/' + encodeURIComponent(h.wallet)
                              : 'https://solscan.io/account/' + encodeURIComponent(h.wallet)
                          }
                          title={h.wallet}
                        >
                          <span className="coin-feed-trainer">
                            {h.displayName || shortWallet(h.wallet)}
                          </span>
                        </a>
                        {h.displayName && <small>{shortWallet(h.wallet)}</small>}
                      </td>
                      <td title={h.tokenAmount.toLocaleString()}>{compact(h.tokenAmount)}</td>
                      <td>
                        {h.sharePercent > 0 && h.sharePercent < 0.01
                          ? '<0.01'
                          : h.sharePercent.toFixed(2)}
                        %
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length === 100 && (
        <p className="coin-feed-limit">{trades ? 'Latest 100 trades' : 'Largest 100 holders'}</p>
      )}
    </div>
  );
}
