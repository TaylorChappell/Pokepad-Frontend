import { useId, useMemo, useState, type CSSProperties } from 'react';
import { useApp } from '../state/AppContext';
import { POKEMON } from '../data/pokemon';
import { collectionValue } from '../state/model';
import {
  Button,
  Icon,
  PokemonArt,
  Avatar,
  CoinAvatar,
  ModeBadge,
  PageHeading,
  SolValue,
  Modal,
  EmptyState,
  EggArt,
  PackArt,
} from '../components/UI';
import type { Coin, RewardMode } from '../types';
import { compact, navigate, relativeTime, sol } from '../utils';
import { useCoinWatchlist } from '../state/watchlist';
import { MarketCapChart } from '../components/MarketCapChart';
import { DEMO_TRAINERS } from '../services/trainers';
import {
  decimalToRaw,
  useTransactionFlow,
  type TransactionConfirmation,
} from '../services/transactions';
import { TransactionStatus } from '../components/TransactionStatus';
import { WalletConnection } from '../components/WalletConnection';
import { StarterHeroArt } from '../components/StarterHeroArt';
function WatchStar({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.2-5.6-3-5.6 3 1.1-6.2L2.9 9.6l6.3-.9Z" />
    </svg>
  );
}
function MarketValue({ coin, field }: { coin: Coin; field: 'marketCap' | 'volume' }) {
  const usd = field === 'marketCap' ? coin.marketCapUsd : coin.volumeUsd;
  return (
    <>
      {typeof usd === 'number' && Number.isFinite(usd)
        ? '$' + compact(usd)
        : compact(coin[field]) + ' SOL'}
    </>
  );
}
const demoChartCoins = new Set([
  'poke',
  'char',
  'geng',
  'squirt',
  'bulb',
  'eevee',
  'snorlax',
  'drago',
]);
function CoinTrend({ coin, demo }: { coin: Coin; demo: boolean }) {
  const gradientId = useId();
  const history = useMemo(() => {
    if (
      coin.priceHistory &&
      coin.priceHistory.length > 1 &&
      coin.priceHistory.every((value) => Number.isFinite(value) && value >= 0)
    )
      return { values: coin.priceHistory, sample: false };
    if (!demo || !demoChartCoins.has(coin.id) || coin.price <= 0) return null;
    const seed = [...coin.id].reduce((value, character) => value + character.charCodeAt(0), 0);
    return {
      sample: true,
      values: Array.from({ length: 36 }, (_, index) => {
        const progress = index / 35;
        const movement = Math.sin(index * 0.49 + seed) * 7 + Math.sin(index * 1.71 + seed) * 3;
        return 100 + progress * coin.change * 0.55 + Math.sin(progress * Math.PI) * movement;
      }),
    };
  }, [coin.id, coin.price, coin.change, coin.priceHistory, demo]);
  if (!history)
    return <div className="market-trend-empty" aria-label="Price history is not available yet" />;
  const low = Math.min(...history.values),
    high = Math.max(...history.values),
    spread = high - low;
  const points = history.values.map((value, index) => [
    2 + (index / (history.values.length - 1)) * 296,
    spread > 0 ? 40 - ((value - low) / spread) * 32 : 24,
  ]);
  const line = points
    .map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ');
  const rising = history.values.at(-1)! >= history.values[0];
  return (
    <div className={'market-coin-trend ' + (rising ? 'trend-up' : 'trend-down')}>
      <svg
        viewBox="0 0 300 52"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${coin.name} price trend${history.sample ? ' · demo sample' : ''}`}
      >
        <title>{history.sample ? 'Sample price history' : 'Price history'}</title>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity=".15" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={line + ' L298 52 L2 52Z'} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx="298" cy={points.at(-1)![1]} r="2.3" fill="currentColor" />
      </svg>
    </div>
  );
}
function CoinSocials({ coin }: { coin: Coin }) {
  const socials = Object.entries(coin.socials || {}).filter((entry): entry is [string, string] =>
    Boolean(entry[1] && /^https?:\/\//i.test(entry[1])),
  );
  return (
    <div className="market-coin-socials">
      {socials.map(([kind, url]) => (
        <a
          key={kind}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={coin.name + ' on ' + (kind === 'x' ? 'X' : kind)}
          title={kind === 'x' ? 'X' : kind.charAt(0).toUpperCase() + kind.slice(1)}
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {kind === 'website' ? (
              <>
                <circle cx="12" cy="12" r="9" />
                <ellipse cx="12" cy="12" rx="4" ry="9" />
                <path d="M3 12h18" />
              </>
            ) : kind === 'x' ? (
              <>
                <path d="m5 3 14 18h-4L1 3h4Z" transform="translate(2)" />
                <path d="M20 3 4 21" />
              </>
            ) : kind === 'telegram' ? (
              <>
                <path d="m21 3-4 18-6-6-4 3 1-6-6-3 19-6Z" />
                <path d="m8 12 9-5-6 8" />
              </>
            ) : (
              <>
                <path d="M6 5 3 7 1 17c3 3 5 3 7 2l1-2h6l1 2c2 1 4 1 7-2L21 7l-3-2-2 2H8L6 5Z" />
                <path d="M8 11v3m8-3v3" />
              </>
            )}
          </svg>
        </a>
      ))}
    </div>
  );
}
export function CoinCard({
  coin,
  watched,
  onToggleWatch,
}: {
  coin: Coin;
  watched: boolean;
  onToggleWatch: () => void;
}) {
  const { toast, mode } = useApp();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const copyAddress = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(coin.ca);
      toast('Contract address copied');
    } catch {
      toast('Clipboard unavailable. Open the coin to view its contract address.');
    }
  };
  return (
    <article
      className="coin-card market-coin-card"
      data-coin-id={coin.id}
      style={{ '--card-tint': coin.color } as CSSProperties}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <header className="market-coin-header">
        <CoinAvatar coin={coin} size={44} />
        <div className="market-coin-identity">
          <a className="market-coin-link" href={'#/coin/' + coin.id}>
            {coin.name}
          </a>
          <span>
            <span>${coin.ticker}</span>
            <i aria-hidden="true">·</i>
            <time dateTime={coin.launchedAt ? new Date(coin.launchedAt).toISOString() : undefined}>
              {coin.launchedAt ? relativeTime(coin.launchedAt) : 'Age unavailable'}
            </time>
          </span>
        </div>
        <button
          type="button"
          className={'coin-watch-button' + (watched ? ' is-watched' : '')}
          aria-pressed={watched}
          aria-label={
            (watched ? 'Remove ' : 'Add ') +
            coin.name +
            (watched ? ' from watchlist' : ' to watchlist')
          }
          onClick={onToggleWatch}
        >
          <WatchStar filled={watched} />
        </button>
      </header>
      <div className="market-coin-main">
        <div className="market-cap-figure">
          <span>Market cap</span>
          <strong>
            <MarketValue coin={coin} field="marketCap" />
          </strong>
          <div className={'market-coin-change ' + (coin.change >= 0 ? 'positive' : 'negative')}>
            {coin.change >= 0 ? '+' : ''}
            {coin.change.toFixed(1)}% <small>24h</small>
          </div>
        </div>
        <div className="market-mascot-stage" aria-label="Coin Pokémon">
          {coin.launchKind === 'trainer' && coin.trainer ? (
            <Avatar profile={coin.trainer} size={96} />
          ) : (
            <PokemonArt
              id={coin.pokemonId}
              shiny={coin.pokemonShiny}
              animated={hovered || focused}
              stableFrames
            />
          )}
        </div>
      </div>
      <CoinTrend coin={coin} demo={mode === 'demo'} />
      <div className="market-coin-stats">
        <div>
          <span>24h volume</span>
          <strong>
            <MarketValue coin={coin} field="volume" />
          </strong>
        </div>
        <div>
          <span>Holders</span>
          <strong>{compact(coin.holders)}</strong>
        </div>
      </div>
      <footer className="market-coin-footer">
        <ModeBadge mode={coin.mode} />
        <CoinSocials coin={coin} />
        <button
          type="button"
          className="coin-copy-address"
          onClick={copyAddress}
          aria-label={'Copy ' + coin.ticker + ' contract address'}
          title="Copy contract address"
        >
          <span>CA</span>
          <Icon name="Copy" size={14} />
        </button>
      </footer>
    </article>
  );
}
export function DiscoverPage({ explore = false }: { explore?: boolean }) {
  const { state } = useApp(),
    [mode, setMode] = useState('All'),
    [sort, setSort] = useState('Trending'),
    [watchOnly, setWatchOnly] = useState(false),
    [view, setView] = useState<'grid' | 'list'>('grid');
  const main = state.coins.find((c) => c.main);
  const watchlist = useCoinWatchlist(state.profile.wallet);
  let coins = state.coins.filter(
    (c) => (mode === 'All' || c.mode === mode) && (!watchOnly || watchlist.ids.includes(c.id)),
  );
  coins = [...coins].sort((a, b) =>
    sort === 'Top volume'
      ? b.volume - a.volume
      : sort === 'Most holders'
        ? b.holders - a.holders
        : sort === 'New pairs'
          ? (b.launchedAt || 0) - (a.launchedAt || 0)
          : b.change - a.change,
  );
  return (
    <>
      {!explore ? (
        <section className="discovery-hero" aria-labelledby="discovery-hero-title">
          <div className="discovery-hero-copy">
            <h1 id="discovery-hero-title">
              <span>Launch a coin.</span>
              <span>Build your Pokémon team.</span>
            </h1>
            <p>Hold community coins to receive eggs and packs funded by trading fees.</p>
            <div className="discovery-hero-footer">
              <div className="discovery-hero-actions">
                <a href="#/create" className="button primary create-cta">
                  Create a coin <Icon name="ArrowRight" size={17} />
                </a>
                <a href="#/explore" className="button secondary">
                  Explore coins
                </a>
              </div>
              <div className="discovery-hero-starter">
                {main && (
                  <>
                    <CoinAvatar coin={main} size={34} />
                    <a href={'#/coin/' + main.id} className="discovery-hero-ticker">
                      ${main.ticker}
                    </a>
                    <span className="discovery-hero-divider" aria-hidden="true">
                      ·
                    </span>
                  </>
                )}
                <a href="#/starter" className="discovery-hero-starter-link">
                  Choose your starter <Icon name="ArrowRight" size={15} />
                </a>
              </div>
            </div>
          </div>
          <div className="discovery-hero-art">
            <StarterHeroArt />
          </div>
        </section>
      ) : (
        <PageHeading title="Explore coins">
          <a href="#/create" className="button primary">
            Create a coin
            <Icon name="Plus" />
          </a>
        </PageHeading>
      )}
      <section className="market-section">
        <div className="section-title">
          <h2>Coins</h2>
          <a href="#/explore" className="text-link">
            View all coins <Icon name="ArrowUpRight" size={15} />
          </a>
        </div>
        <div className="market-toolbar">
          <div className="market-sort-tabs" aria-label="Sort coins">
            {['Trending', 'New pairs', 'Top volume', 'Most holders'].map((s) => (
              <button
                className={sort === s && !watchOnly ? 'active' : ''}
                aria-pressed={sort === s && !watchOnly}
                key={s}
                onClick={() => {
                  setSort(s);
                  setWatchOnly(false);
                }}
              >
                {s}
              </button>
            ))}
            <button
              className={'watchlist-tab' + (watchOnly ? ' active' : '')}
              aria-pressed={watchOnly}
              onClick={() => setWatchOnly(!watchOnly)}
            >
              <WatchStar filled={watchOnly} /> Watchlist
              {watchlist.ids.length > 0 && <span>{watchlist.ids.length}</span>}
            </button>
          </div>
          <div className="toolbar-right">
            <div className="filter-pills">
              {['All', 'Eggs', 'Packs', 'Mixed'].map((m) => (
                <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
                  {m}
                </button>
              ))}
            </div>
            <div className="view-toggle">
              <button
                aria-label="Grid view"
                className={view === 'grid' ? 'active' : ''}
                onClick={() => setView('grid')}
              >
                <Icon name="Grid2X2" size={16} />
              </button>
              <button
                aria-label="List view"
                className={view === 'list' ? 'active' : ''}
                onClick={() => setView('list')}
              >
                <Icon name="List" size={17} />
              </button>
            </div>
          </div>
        </div>
        <div className="market-result-count" aria-live="polite">
          {coins.length} {coins.length === 1 ? 'coin' : 'coins'}
          {watchOnly ? ' in your watchlist' : ''}
        </div>
        {!coins.length ? (
          <EmptyState
            title={watchOnly ? 'Your watchlist is waiting' : 'No coins in this mode'}
            description={
              watchOnly
                ? 'Tap the star on a coin to keep it here.'
                : 'Choose another reward mode to explore more coins.'
            }
          >
            <Button
              variant="secondary"
              onClick={() => {
                setWatchOnly(false);
                setMode('All');
              }}
            >
              Explore coins
            </Button>
          </EmptyState>
        ) : view === 'grid' ? (
          <div className="coin-grid">
            {coins.map((c) => (
              <CoinCard
                coin={c}
                key={c.id}
                watched={watchlist.ids.includes(c.id)}
                onToggleWatch={() => watchlist.toggle(c.id)}
              />
            ))}
          </div>
        ) : (
          <div className="panel table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Coin</th>
                  <th>Market cap</th>
                  <th>24h</th>
                  <th>24h volume</th>
                  <th>Holders</th>
                  <th>Rewards</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {coins.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <a className="table-coin" href={'#/coin/' + c.id}>
                        <CoinAvatar coin={c} />
                        <span>
                          <strong>{'$' + c.ticker}</strong>
                          <small>{c.name}</small>
                        </span>
                      </a>
                    </td>
                    <td>
                      <MarketValue coin={c} field="marketCap" />
                    </td>
                    <td className={c.change >= 0 ? 'positive' : 'negative'}>
                      {c.change >= 0 ? '+' : ''}
                      {c.change}%
                    </td>
                    <td>
                      <MarketValue coin={c} field="volume" />
                    </td>
                    <td>{compact(c.holders)}</td>
                    <td>
                      <ModeBadge mode={c.mode} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={
                          'coin-watch-button' + (watchlist.ids.includes(c.id) ? ' is-watched' : '')
                        }
                        aria-pressed={watchlist.ids.includes(c.id)}
                        aria-label={
                          (watchlist.ids.includes(c.id) ? 'Remove ' : 'Add ') +
                          c.name +
                          (watchlist.ids.includes(c.id) ? ' from watchlist' : ' to watchlist')
                        }
                        onClick={() => watchlist.toggle(c.id)}
                      >
                        <WatchStar filled={watchlist.ids.includes(c.id)} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
const COIN_DETAIL_TABS = ['Transactions', 'Holders', 'Rewards', 'Gym'] as const;
type CoinDetailTab = (typeof COIN_DETAIL_TABS)[number];

export function CoinPage({ id }: { id: string }) {
  const { state, toast, mode, session, reload } = useApp();
  const coin = state.coins.find((item) => item.id === id);
  const [tab, setTab] = useState<CoinDetailTab>('Transactions');
  const [side, setSide] = useState<'Buy' | 'Sell'>('Buy');
  const [amount, setAmount] = useState('0.1');
  const [review, setReview] = useState(false);
  const [slippageBps, setSlippageBps] = useState(100);
  const transaction = useTransactionFlow(state.profile.wallet, 'trade:' + id);
  const tabsId = useId();
  const watchlist = useCoinWatchlist(state.profile.wallet);
  if (!coin)
    return (
      <EmptyState title="This coin wandered off" description="Try searching for another ticker.">
        <a href="#/discover" className="button primary">
          Back to discover
        </a>
      </EmptyState>
    );
  const isDemo = mode === 'demo';
  const watched = watchlist.ids.includes(coin.id);
  const creatorWallet = coin.creatorWallet;
  const creatorName =
    creatorWallet === state.profile.wallet
      ? state.profile.displayName || coin.creatorName
      : coin.creatorName;
  const creatorLabel =
    creatorName ||
    (creatorWallet ? creatorWallet.slice(0, 4) + '…' + creatorWallet.slice(-4) : 'Not provided');
  const tradeAmount = Number(amount);
  const validTrade =
    amount.trim() !== '' &&
    Number.isFinite(tradeAmount) &&
    tradeAmount > 0 &&
    (side === 'Buy' || tradeAmount <= coin.holding);
  const estimate =
    validTrade && Number.isFinite(coin.price) && coin.price > 0
      ? side === 'Buy'
        ? tradeAmount / coin.price
        : tradeAmount * coin.price
      : null;
  const validEstimate = estimate !== null && Number.isFinite(estimate);
  const tabIndex = COIN_DETAIL_TABS.indexOf(tab);
  const copyAddress = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(coin.ca);
      toast('Contract address copied');
    } catch {
      toast('Contract address: ' + coin.ca);
    }
  };
  async function finishTrade(result: TransactionConfirmation | null) {
    if (result?.status === 'confirmed') {
      await reload();
      toast('Trade confirmed on Solana.');
      setReview(false);
    }
  }
  async function submitTrade() {
    if (!coin || !validTrade || session.status !== 'authenticated') return;
    if (transaction.pending) {
      await finishTrade(await transaction.confirm());
      return;
    }
    if (side === 'Sell' && coin.decimals === undefined) {
      toast('Token precision is unavailable. Refresh the coin before selling.');
      return;
    }
    let raw: string;
    try {
      raw = decimalToRaw(amount, side === 'Buy' ? 9 : coin.decimals!);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Enter a valid amount.');
      return;
    }
    const result = await transaction.execute({
      preparePath: `/v1/coins/${encodeURIComponent(coin.ca)}/trades/prepare`,
      confirmPath: `/v1/coins/${encodeURIComponent(coin.ca)}/trades/confirm`,
      body: { side: side.toLowerCase(), amount: raw, slippageBps },
    });
    await finishTrade(result);
  }
  return (
    <div className="kanto-market-page">
      <div className="kanto-market-navigation">
        <a href="#/discover">
          <Icon name="ArrowLeft" size={17} /> Discover coins
        </a>
        <button
          type="button"
          className={'kanto-market-watch ' + (watched ? 'is-watched' : '')}
          aria-pressed={watched}
          onClick={() => watchlist.toggle(coin.id)}
        >
          <WatchStar filled={watched} />
          {watched ? 'Watching' : 'Watch coin'}
        </button>
      </div>
      <header className="kanto-market-masthead">
        <div className="kanto-market-coin-identity">
          <CoinAvatar coin={coin} size={72} />
          <div>
            <div className="kanto-market-coin-title">
              <h1>{coin.name}</h1>
              <span>${coin.ticker}</span>
            </div>
            <div className="kanto-market-identity-meta">
              <ModeBadge mode={coin.mode} />
              <span className={'kanto-market-status ' + (coin.active ? 'is-active' : '')}>
                <i aria-hidden="true" />
                {coin.active ? 'Active' : 'Inactive'}
              </span>
              {coin.launchedAt && (
                <time dateTime={new Date(coin.launchedAt).toISOString()}>
                  Launched {relativeTime(coin.launchedAt).toLowerCase()}
                </time>
              )}
            </div>
          </div>
        </div>
        <div className="kanto-market-creator">
          <span>Created by</span>
          {creatorWallet ? (
            <a href={'#/trainer/' + encodeURIComponent(creatorWallet)} title={creatorWallet}>
              {creatorLabel}
              <Icon name="ArrowUpRight" size={14} />
            </a>
          ) : (
            <strong>{creatorLabel}</strong>
          )}
        </div>
        <div className="kanto-market-description-row">
          <p>{coin.description}</p>
          <div className="kanto-market-links">
            <button
              type="button"
              className="kanto-market-ca"
              onClick={copyAddress}
              title={coin.ca}
              aria-label={'Copy contract address for ' + coin.name}
            >
              <span>CA</span>
              {coin.ca.slice(0, 5)}…{coin.ca.slice(-4)}
              <Icon name="Copy" size={13} />
            </button>
            <CoinSocials coin={coin} />
          </div>
        </div>
      </header>
      <div className="kanto-market-layout">
        <div className="kanto-market-main">
          <div className="kanto-market-terminal">
            <div className="kanto-market-terminal-top">
              <span>
                <i />
                <i />
                <i />
              </span>
              <span>{isDemo ? 'DEMO MARKET' : 'MARKET OVERVIEW'}</span>
              <span className="kanto-market-terminal-lines" aria-hidden="true" />
            </div>
            <MarketCapChart coin={coin} demo={isDemo} />
            <dl className="kanto-market-stat-strip">
              <div>
                <dt>24h volume</dt>
                <dd>
                  <MarketValue coin={coin} field="volume" />
                </dd>
              </div>
              <div>
                <dt>Holders</dt>
                <dd>{compact(coin.holders)}</dd>
              </div>
              <div>
                <dt>Total supply</dt>
                <dd>{compact(coin.totalSupply)}</dd>
              </div>
            </dl>
          </div>
          <section className="kanto-market-community" aria-label="Coin information">
            <div
              className="kanto-market-tabs"
              role="tablist"
              aria-label="Coin information"
              style={{ '--selected-tab': tabIndex } as CSSProperties}
            >
              {COIN_DETAIL_TABS.map((name, index) => (
                <button
                  key={name}
                  role="tab"
                  id={tabsId + '-tab-' + name}
                  aria-controls={tabsId + '-panel-' + name}
                  aria-selected={tab === name}
                  tabIndex={tab === name ? 0 : -1}
                  onClick={() => setTab(name)}
                  onKeyDown={(event) => {
                    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                    event.preventDefault();
                    const next =
                      event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? 3
                          : (index + (event.key === 'ArrowRight' ? 1 : 3)) % 4;
                    setTab(COIN_DETAIL_TABS[next]);
                    const buttons =
                      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                        '[role="tab"]',
                      );
                    buttons?.[next].focus();
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
            <div
              className="kanto-market-tab-content"
              key={tab}
              role="tabpanel"
              id={tabsId + '-panel-' + tab}
              aria-labelledby={tabsId + '-tab-' + tab}
              tabIndex={0}
            >
              {tab === 'Transactions' ? (
                isDemo ? (
                  <>
                    <div className="kanto-market-section-caption">
                      <span>Recent trades</span>
                      <span>Sample activity</span>
                    </div>
                    <div className="kanto-market-table-scroll">
                      <table className="kanto-market-table">
                        <thead>
                          <tr>
                            <th>Trainer</th>
                            <th>Side</th>
                            <th>SOL</th>
                            <th>Tokens</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: 5 }, (_, index) => {
                            const trainer = DEMO_TRAINERS[index % DEMO_TRAINERS.length];
                            const buy = index % 3 !== 1;
                            const value = 0.03 + index * 0.024;
                            return (
                              <tr key={index}>
                                <td>
                                  <a href={'#/trainer/' + trainer.wallet}>
                                    {trainer.displayName}
                                    <Icon name="ArrowUpRight" size={12} />
                                  </a>
                                  <small>{index + 1}m ago · demo</small>
                                </td>
                                <td>
                                  <span
                                    className={
                                      'kanto-market-trade-tag ' + (buy ? 'is-buy' : 'is-sell')
                                    }
                                  >
                                    {buy ? 'Buy' : 'Sell'}
                                  </span>
                                </td>
                                <td>{value.toFixed(3)}</td>
                                <td>{coin.price > 0 ? compact(value / coin.price) : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="kanto-market-data-empty">
                    <Icon name="Activity" size={28} />
                    <h3>No trade activity yet</h3>
                    <p>Confirmed trades will appear here when the market feed is connected.</p>
                  </div>
                )
              ) : tab === 'Holders' ? (
                isDemo ? (
                  <>
                    <div className="kanto-market-section-caption">
                      <span>Community holders</span>
                      <span>Sample holders</span>
                    </div>
                    <div className="kanto-market-table-scroll">
                      <table className="kanto-market-table">
                        <thead>
                          <tr>
                            <th>Trainer</th>
                            <th>Holding time</th>
                            <th>Supply share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {DEMO_TRAINERS.map((trainer, index) => (
                            <tr key={trainer.wallet}>
                              <td>
                                <a href={'#/trainer/' + trainer.wallet}>
                                  {trainer.displayName}
                                  <Icon name="ArrowUpRight" size={12} />
                                </a>
                                <small>
                                  {trainer.wallet.slice(0, 4)}…{trainer.wallet.slice(-4)}
                                </small>
                              </td>
                              <td>{28 - index * 7} days</td>
                              <td>{(2.8 - index * 0.6).toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="kanto-market-data-empty">
                    <Icon name="Users" size={28} />
                    <h3>Holder directory coming soon</h3>
                    <p>
                      Verified holder accounts will appear here when the market feed is connected.
                    </p>
                  </div>
                )
              ) : tab === 'Rewards' ? (
                <div className="kanto-market-feature">
                  <div className="kanto-market-reward-art">
                    {coin.mode === 'Packs' ? <PackArt tier="Rare" /> : <EggArt tier="Rare" />}
                  </div>
                  <div>
                    <ModeBadge mode={coin.mode} />
                    <h3>Your next Pokémon starts here.</h3>
                    <p>
                      {coin.mode === 'Packs'
                        ? 'Open packs to discover a new partner.'
                        : coin.mode === 'Eggs'
                          ? 'Collect eggs, let them hatch, and walk to speed things up.'
                          : 'Collect eggs to hatch and packs to open whenever you like.'}{' '}
                      Rewards are funded by this coin’s collected creator fees.
                    </p>
                    <a href="#/rewards" className="kanto-market-inline-action">
                      View your rewards
                      <Icon name="ArrowRight" size={17} />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="kanto-market-feature kanto-market-gym-feature">
                  <div className="kanto-market-gym-badge">
                    <CoinAvatar coin={coin} size={84} />
                  </div>
                  <div>
                    <span className="kanto-market-label">Community gym</span>
                    <h3>Team {coin.ticker}</h3>
                    <p>
                      Support this gym with your Pokémon collection. The coin’s own image is your
                      community badge.
                    </p>
                    <a href={'#/gym/' + coin.id} className="kanto-market-inline-action">
                      Visit the gym
                      <Icon name="ArrowRight" size={17} />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
        <aside className="kanto-market-sidebar" aria-label="Trading and rewards">
          <section className="kanto-market-trade-box" aria-label="Trade coin">
            <div className="kanto-market-trade-heading">
              <h2>Trade</h2>
              <span>${coin.ticker}</span>
            </div>
            <div
              className={'kanto-market-trade-tabs ' + (side === 'Sell' ? 'is-sell' : '')}
              role="group"
              aria-label="Trade side"
            >
              {(['Buy', 'Sell'] as const).map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={side === name}
                  onClick={() => {
                    setSide(name);
                    setAmount(name === 'Buy' ? '0.1' : '');
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
            <label className="kanto-market-amount-label" htmlFor={tabsId + '-amount'}>
              {side === 'Buy' ? 'You pay' : 'You sell'}
            </label>
            <div className="kanto-market-amount-input">
              <input
                id={tabsId + '-amount'}
                inputMode="decimal"
                placeholder="0.00"
                autoComplete="off"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <span>{side === 'Buy' ? 'SOL' : coin.ticker}</span>
            </div>
            {side === 'Sell' && tradeAmount > coin.holding && (
              <p className="kanto-market-trade-note" role="status">
                Amount exceeds your {compact(coin.holding)} {coin.ticker} holding.
              </p>
            )}
            <div className="kanto-market-quick-amounts">
              {(side === 'Buy' ? [0.1, 0.5, 1, 5] : [25, 50, 75, 100]).map((value) => (
                <button
                  type="button"
                  key={value}
                  disabled={side === 'Sell' && coin.holding <= 0}
                  onClick={() =>
                    setAmount(String(side === 'Buy' ? value : (coin.holding * value) / 100))
                  }
                >
                  {value}
                  {side === 'Sell' ? '%' : ''}
                </button>
              ))}
            </div>
            <div className="kanto-market-estimate">
              <span>Estimated receive</span>
              <strong>
                {validEstimate ? (side === 'Buy' ? compact(estimate!) : sol(estimate!)) : '—'}{' '}
                <small>{side === 'Buy' ? coin.ticker : 'SOL'}</small>
              </strong>
            </div>
            <Button
              className={'kanto-market-trade-action ' + (side === 'Sell' ? 'is-sell' : '')}
              onClick={() => setReview(true)}
              disabled={!validTrade || !validEstimate}
            >
              Review {side.toLowerCase()}
              <Icon name="ArrowRight" size={17} />
            </Button>
            <p className="kanto-market-trade-note">
              {isDemo
                ? 'Demo trade · no real funds are used.'
                : 'Trading is not connected yet. Review only.'}
            </p>
            <div className="kanto-market-position">
              <div>
                <span>Your position</span>
                <a href="#/portfolio">
                  Portfolio
                  <Icon name="ArrowUpRight" size={12} />
                </a>
              </div>
              <strong>
                {compact(coin.holding)} <small>{coin.ticker}</small>
              </strong>
              <span>
                {coin.holding > 0
                  ? `${coin.holdingDays} day${coin.holdingDays === 1 ? '' : 's'} held`
                  : 'No holding yet'}
              </span>
            </div>
          </section>
          <section className="kanto-market-vault">
            <div className="kanto-market-vault-heading">
              <span className="kanto-market-vault-icon">
                <Icon name="Lock" size={18} />
              </span>
              <h2>Reward vault</h2>
            </div>
            <SolValue amount={coin.vault} />
            <p>Collected for this community’s Pokémon rewards.</p>
            <div
              className="kanto-market-fee-split"
              aria-label="Creator fees: 30 percent creator, 20 percent platform, 50 percent holder rewards"
            >
              <span />
              <span />
              <span />
            </div>
            <div className="kanto-market-fee-labels">
              <span>
                <i />
                30% creator
              </span>
              <span>
                <i />
                20% platform
              </span>
              <span>
                <i />
                50% rewards
              </span>
            </div>
          </section>
        </aside>
      </div>
      {!isDemo && !review && transaction.pending && (
        <TransactionStatus
          {...transaction}
          onCheck={(signature) => void transaction.confirm(undefined, signature).then(finishTrade)}
        />
      )}
      {review && (
        <Modal
          title={'Review ' + side.toLowerCase()}
          onClose={() => setReview(false)}
          closeDisabled={transaction.busy}
        >
          <div className="modal-body">
            <CoinAvatar coin={coin} size={62} />
            <h3>
              {side +
                ' ' +
                amount +
                ' ' +
                (side === 'Buy' ? 'SOL worth of ' + coin.ticker : coin.ticker)}
            </h3>
            {isDemo ? (
              <>
                <p>
                  This is a trade preview. Wallet signing and transaction submission will become
                  available when trading is connected.
                </p>
                <div className="notice">
                  <Icon name="Info" />
                  No order or payment will be submitted.
                </div>
                <Button
                  className="full-width"
                  onClick={() => {
                    setReview(false);
                    toast('Trade preview complete. No transaction was sent.');
                  }}
                >
                  Close preview
                </Button>
              </>
            ) : (
              <>
                <p>
                  Your wallet will show the exact transaction before you approve. Displayed
                  estimates may change.
                </p>
                <label>
                  Maximum slippage
                  <select
                    value={slippageBps}
                    onChange={(event) => setSlippageBps(Number(event.target.value))}
                    disabled={transaction.busy || Boolean(transaction.pending)}
                  >
                    <option value={50}>0.5%</option>
                    <option value={100}>1%</option>
                    <option value={200}>2%</option>
                  </select>
                </label>
                {session.status !== 'authenticated' || !session.signingReady ? (
                  <WalletConnection />
                ) : (
                  <Button
                    className="full-width"
                    disabled={transaction.busy || !validTrade || state.features?.trading === false}
                    onClick={() => void submitTrade()}
                  >
                    {transaction.busy
                      ? 'Waiting for confirmation…'
                      : transaction.pending
                        ? 'Check confirmation'
                        : 'Review in wallet'}
                  </Button>
                )}
                {state.features?.trading === false && <p>Trading is currently unavailable.</p>}
                <TransactionStatus
                  {...transaction}
                  onCheck={(signature) =>
                    void transaction.confirm(undefined, signature).then(finishTrade)
                  }
                />
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
