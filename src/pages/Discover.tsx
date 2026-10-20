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
  Badge,
  SolValue,
  Modal,
  EmptyState,
  EggArt,
  PackArt,
} from '../components/UI';
import type { Coin, RewardMode } from '../types';
import { compact, navigate, relativeTime, sol } from '../utils';
import { useCoinWatchlist } from '../state/watchlist';
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
  const main = state.coins.find((c) => c.main)!;
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
        <section className="discovery-intro">
          <div className="intro-dialogue">
            <div className="intro-copy">
              <h1>A launchpad for Pokémon trainers.</h1>
              <p>Create a coin. Find your people. Build your Pokémon collection.</p>
              <p>
                Hold community coins to receive eggs and packs funded by trading fees. Hatch your
                next partner, train with Rare Candy, and take your team into battle.
              </p>
              <div className="intro-actions">
                <a href="#/create" className="button primary create-cta">
                  Create a coin
                  <Icon name="ArrowRight" size={16} />
                </a>
                <a href="#/guide" className="button secondary">
                  Learn more
                </a>
              </div>
            </div>
            <div className="main-token-ticket">
              <span>MAIN TOKEN</span>
              <div>
                <CoinAvatar coin={main} size={46} />
                <h2>$POKE</h2>
              </div>
              <p>{compact(main.holders)} holders</p>
              <a href={'#/coin/' + main.id}>
                View coin
                <Icon name="ArrowRight" size={14} />
              </a>
            </div>
          </div>
          <div
            className="starter-showcase"
            aria-label="Bulbasaur, Charmander, and Squirtle: your first Pokémon partners"
          >
            <div className="showcase-pokeball" aria-hidden="true" />
            <div className="showcase-stars" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <PokemonArt
              id={1}
              animated={false}
              eager
              styleOverride="drawn"
              className="showcase-bulbasaur"
            />
            <PokemonArt
              id={4}
              animated={false}
              eager
              styleOverride="drawn"
              className="showcase-charmander"
            />
            <PokemonArt
              id={7}
              animated={false}
              eager
              styleOverride="drawn"
              className="showcase-squirtle"
            />
            <a href="#/starter" className="showcase-caption">
              <strong>Meet your first partner.</strong>
              <span>
                Hold POKE to choose a starter <Icon name="ArrowRight" size={16} />
              </span>
            </a>
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
function PriceChart({ seed = 6 }: { seed?: number }) {
  return (
    <svg
      viewBox="0 0 780 260"
      className="price-chart"
      role="img"
      aria-label="Illustrative coin price chart"
    >
      <defs>
        <linearGradient id="chartfade" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#73bfa0" stopOpacity=".13" />
          <stop offset="1" stopColor="#73bfa0" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[25, 75, 125, 175, 225].map((y) => (
        <g key={y}>
          <path d={'M0 ' + y + 'H720'} stroke="#ecebe5" strokeDasharray="3 5" />
          <text x="735" y={y + 4} fill="#9ba0a9" fontSize="10">
            {(0.000055 - y * 0.00000008).toFixed(6)}
          </text>
        </g>
      ))}
      {Array.from({ length: 52 }, (_, i) => {
        const y = 165 - i * 1.7 + Math.sin(i * 0.7 + seed) * 22,
          up = Math.sin(i * 2.3) > -0.25,
          h = 8 + Math.abs(Math.cos(i * 1.3)) * 24;
        return (
          <g key={i} stroke={up ? '#63b493' : '#ed8a8c'} fill={up ? '#63b493' : '#ed8a8c'}>
            <path d={'M' + (12 + i * 13.5) + ' ' + (y - 8) + 'v' + (h + 16)} />
            <rect x={8 + i * 13.5} y={y} width="8" height={h} rx="1" />
          </g>
        );
      })}
      {['09:00', '10:00', '11:00', '12:00', '13:00', '14:00'].map((t, i) => (
        <text key={t} x={20 + i * 132} y="256" fill="#9ba0a9" fontSize="11">
          {t}
        </text>
      ))}
    </svg>
  );
}
export function CoinPage({ id }: { id: string }) {
  const { state, toast, mode } = useApp(),
    coin = state.coins.find((c) => c.id === id),
    [tab, setTab] = useState('Transactions'),
    [side, setSide] = useState('Buy'),
    [amount, setAmount] = useState('0.1'),
    [time, setTime] = useState('1H'),
    [review, setReview] = useState(false);
  if (!coin)
    return (
      <EmptyState title="This coin wandered off" description="Try searching for another ticker.">
        <a href="#/discover" className="button primary">
          Back to discover
        </a>
      </EmptyState>
    );
  return (
    <>
      <a href="#/discover" className="button secondary back-button">
        <Icon name="ArrowLeft" size={16} />
        Back to coins
      </a>
      <div className="coin-detail-grid">
        <div>
          <div className="coin-detail-header">
            <CoinAvatar coin={coin} size={65} />
            <div>
              <h1>
                {coin.name} <span>{'$' + coin.ticker}</span>
              </h1>
              <div className="row-gap">
                <ModeBadge mode={coin.mode} />
                <span className="small muted">{compact(coin.holders)} holders</span>
                <button
                  className="copy-ca"
                  onClick={() => {
                    navigator.clipboard
                      ?.writeText(coin.ca)
                      .then(() => toast('Contract address copied'))
                      .catch(() => toast(coin.ca));
                  }}
                >
                  {coin.ca.slice(0, 7)}…{coin.ca.slice(-4)}
                  <Icon name="Copy" size={12} />
                </button>
              </div>
            </div>
            {coin.launchKind === 'trainer' && coin.trainer ? (
              <Avatar profile={coin.trainer} size={100} />
            ) : (
              <PokemonArt id={coin.pokemonId} shiny={coin.pokemonShiny} animated={false} />
            )}
          </div>
          <p className="coin-description">{coin.description}</p>
          <div className="coin-launch-credit">
            {coin.launchKind === 'trainer' && coin.trainer ? (
              <>
                <Avatar profile={coin.trainer} size={38} />
                <span>Launched by a trainer</span>
              </>
            ) : (
              <>
                <PokemonArt id={coin.pokemonId} shiny={coin.pokemonShiny} animated={false} />
                <span>
                  Launched with {POKEMON.find((p) => p.id === coin.pokemonId)?.name || 'a Pokémon'}
                </span>
              </>
            )}
          </div>
          {coin.socials && (
            <div className="coin-socials">
              {Object.entries(coin.socials)
                .filter(([, url]) => url && /^https?:\/\//i.test(url))
                .map(([name, url]) => (
                  <a key={name} href={url} target="_blank" rel="noopener noreferrer">
                    {{ website: 'Website', x: 'X', telegram: 'Telegram', discord: 'Discord' }[
                      name
                    ] || name}
                    <Icon name="ArrowUpRight" size={12} />
                  </a>
                ))}
            </div>
          )}
          <div className="panel chart-panel">
            <div className="chart-header">
              <div>
                <strong>
                  {coin.price.toFixed(7)} <small>SOL</small>
                </strong>
                <span className={coin.change >= 0 ? 'positive' : 'negative'}>
                  {coin.change >= 0 ? '+' : ''}
                  {coin.change}% today
                </span>
              </div>
              <div className="filter-pills">
                {['5M', '15M', '1H', '4H', '1D'].map((t) => (
                  <button onClick={() => setTime(t)} className={time === t ? 'active' : ''} key={t}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <PriceChart seed={coin.pokemonId + ['5M', '15M', '1H', '4H', '1D'].indexOf(time)} />
            <div className="chart-metrics">
              <span>
                Market cap
                <strong>
                  <MarketValue coin={coin} field="marketCap" />
                </strong>
              </span>
              <span>
                24h volume
                <strong>
                  <MarketValue coin={coin} field="volume" />
                </strong>
              </span>
              <span>
                Holders<strong>{coin.holders.toLocaleString()}</strong>
              </span>
            </div>
          </div>
          <div className="panel coin-tabs-panel">
            <div className="tab-bar">
              {['Transactions', 'Holders', 'Rewards', 'Gym'].map((t) => (
                <button onClick={() => setTab(t)} className={tab === t ? 'active' : ''} key={t}>
                  {t}
                </button>
              ))}
            </div>
            {tab === 'Transactions' ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Type</th>
                      <th>Amount / SOL</th>
                      <th>Token amount</th>
                      <th>Trader</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }, (_, i) => (
                      <tr key={i}>
                        <td>{i + 1}m ago</td>
                        <td>
                          <span className={'trade-tag ' + (i % 3 ? 'buy' : 'sell')}>
                            {i % 3 ? 'Buy' : 'Sell'}
                          </span>
                        </td>
                        <td>{(0.03 + i * 0.024).toFixed(3)}</td>
                        <td>{compact(1200 + i * 2100)}</td>
                        <td className="muted">7kP…{i}mQ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : tab === 'Holders' ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Trainer</th>
                      <th>Holding time</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['Leaf', 'Red', 'Misty', 'Brock'].map((n, i) => (
                      <tr key={n}>
                        <td>{n}</td>
                        <td>{28 - i * 4} days</td>
                        <td>{(2.8 - i * 0.4).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : tab === 'Rewards' ? (
              <div className="coin-reward-info">
                <EggArt tier="Rare" />
                <div>
                  <h3>Holder rewards</h3>
                  <p>
                    Eligible holders receive {coin.mode.toLowerCase()}. Every awarded Pokémon’s
                    redemption value is reserved before its reward is issued.
                  </p>
                  <a href="#/rewards" className="button secondary">
                    See your rewards
                    <Icon name="ArrowRight" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="coin-reward-info">
                <Badge label={coin.ticker} size={90} />
                <div>
                  <h3>Team {coin.ticker}</h3>
                  <p>Support your community with the Pokémon in your collection.</p>
                  <a href={'#/gym/' + coin.id} className="button secondary">
                    Visit the gym
                    <Icon name="ArrowRight" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
        <aside className="coin-right">
          <div className="panel trade-panel">
            <div className="trade-tabs">
              {['Buy', 'Sell'].map((t) => (
                <button key={t} onClick={() => setSide(t)} className={side === t ? 'active' : ''}>
                  {t}
                </button>
              ))}
            </div>
            <label className="field-label">Amount in {side === 'Buy' ? 'SOL' : coin.ticker}</label>
            <div className="amount-input">
              <input
                aria-label="Trade amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <span>{side === 'Buy' ? 'SOL' : coin.ticker}</span>
            </div>
            <div className="quick-amounts">
              {[0.1, 0.5, 1, 5].map((n) => (
                <button onClick={() => setAmount(String(n))} key={n}>
                  {n}
                </button>
              ))}
            </div>
            <div className="trade-estimate">
              <span>You receive (estimate)</span>
              <strong>
                {Number.isFinite(Number(amount))
                  ? compact(
                      side === 'Buy'
                        ? Number(amount) / Math.max(coin.price, 0.00001)
                        : Number(amount) * coin.price,
                    )
                  : '—'}{' '}
                {side === 'Buy' ? coin.ticker : 'SOL'}
              </strong>
            </div>
            <Button
              className="full-width"
              onClick={() => setReview(true)}
              disabled={!Number(amount) || Number(amount) < 0}
            >
              {mode === 'demo' ? 'Preview ' : ''}
              {side.toLowerCase() + ' $' + coin.ticker}
              <Icon name="ArrowRight" size={16} />
            </Button>
            <p className="mini-note">
              {mode === 'demo'
                ? 'Demo market · no real funds are used.'
                : 'Review your transaction before signing.'}
            </p>
          </div>
          <div className="panel reward-vault">
            <div className="row-between">
              <h3>Reward vault</h3>
              <Icon name="Shield" size={18} />
            </div>
            <SolValue amount={coin.vault} />
            <p>Set aside for this community’s rewards.</p>
            <div className="divider" />
            <div className="row-between">
              <span className="muted small">Next assessment</span>
              <strong className="small">2h 14m</strong>
            </div>
            <div className="funding-split">
              <span>50% creator</span>
              <span>50% holders</span>
            </div>
          </div>
          <div className="panel holding-card">
            <Icon name="Flame" size={25} />
            <h3>Your holding streak</h3>
            <strong>{coin.holdingDays} days</strong>
            <p>
              {coin.holding
                ? compact(coin.holding) + ' ' + coin.ticker + ' in your portfolio'
                : 'No holding yet.'}
            </p>
            <a href="#/portfolio" className="text-link">
              View portfolio
              <Icon name="ArrowRight" size={14} />
            </a>
          </div>
        </aside>
      </div>
      {review && (
        <Modal title={'Review ' + side.toLowerCase()} onClose={() => setReview(false)}>
          <div className="modal-body">
            <CoinAvatar coin={coin} size={62} />
            <h3>
              {side +
                ' ' +
                amount +
                ' ' +
                (side === 'Buy' ? 'SOL worth of ' + coin.ticker : coin.ticker)}
            </h3>
            <p>
              This frontend previews the trading flow. Connecting a wallet and submitting a
              transaction will be handled by the future backend integration.
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
          </div>
        </Modal>
      )}
    </>
  );
}
