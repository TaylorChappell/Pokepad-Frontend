import { useState, type CSSProperties } from 'react';
import { useApp } from '../state/AppContext';
import { gymRankings } from '../state/gyms';
import { POKEMON } from '../data/pokemon';
import { collectionValue } from '../state/model';
import {
  Button,
  Icon,
  PokemonArt,
  Avatar,
  CoinAvatar,
  ModeBadge,
  Sparkline,
  PageHeading,
  Badge,
  SolValue,
  Modal,
  EmptyState,
  EggArt,
  PackArt,
} from '../components/UI';
import type { Coin, RewardMode } from '../types';
import { compact, navigate, sol } from '../utils';
export function CoinCard({ coin }: { coin: Coin }) {
  return (
    <a
      href={'#/coin/' + coin.id}
      className="coin-card"
      style={{ '--card-tint': coin.color } as CSSProperties}
    >
      <div className="coin-card-top">
        <CoinAvatar coin={coin} />
        <div>
          <strong>{'$' + coin.ticker}</strong>
          <span>{coin.name}</span>
        </div>
        <span className="coin-card-arrow">
          <Icon name="ArrowUpRight" size={17} />
        </span>
      </div>
      <div className="coin-card-middle">
        <div>
          <ModeBadge mode={coin.mode} />
          <div className="coin-price">
            {coin.price ? coin.price.toFixed(7) : 'New'} <small>SOL</small>
          </div>
          <span className={coin.change >= 0 ? 'positive' : 'negative'}>
            {coin.change >= 0 ? '+' : ''}
            {coin.change}% <small>24h</small>
          </span>
        </div>
        {coin.launchKind === 'trainer' && coin.trainer ? (
          <Avatar profile={coin.trainer} size={100} />
        ) : (
          <PokemonArt id={coin.pokemonId} animated={false} />
        )}
      </div>
      <Sparkline seed={coin.pokemonId} negative={coin.change < 0} />
      <div className="coin-card-footer">
        <span>
          <Icon name="Users" size={14} />
          {compact(coin.holders)} holders
        </span>
        <span>
          <Icon name="Gift" size={14} />
          {sol(coin.vault)} SOL
        </span>
      </div>
    </a>
  );
}
export function DiscoverPage({ explore = false }: { explore?: boolean }) {
  const { state } = useApp(),
    [mode, setMode] = useState('All'),
    [sort, setSort] = useState('Trending'),
    [view, setView] = useState<'grid' | 'list'>(explore ? 'list' : 'grid');
  const ranked = gymRankings(state).filter((g) => g.score > 0);
  const best =
      state.coins.find((c) => c.id === ranked[0]?.coinId) || state.coins.find((c) => c.main)!,
    main = state.coins.find((c) => c.main)!;
  let coins = state.coins.filter((c) => mode === 'All' || c.mode === mode);
  coins = [...coins].sort((a, b) =>
    sort === 'Top volume'
      ? b.volume - a.volume
      : sort === 'Most holders'
        ? b.holders - a.holders
        : sort === 'New pairs'
          ? 0
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
          <a className="gym-spotlight-ribbon" href={'#/gym/' + best.id}>
            <Badge label={best.ticker} size={43} />
            <span>
              <small>Featured gym</small>
              <strong>Team {best.ticker}</strong>
            </span>
            <p>Top community by supported Pokémon value</p>
            <SolValue amount={ranked[0]?.score || 0} />
            <Icon name="ArrowRight" size={17} />
          </a>
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
          <div className="segmented">
            {['Trending', 'New pairs', 'Top volume', 'Most holders'].map((s) => (
              <button className={sort === s ? 'active' : ''} key={s} onClick={() => setSort(s)}>
                {s}
              </button>
            ))}
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
        {view === 'grid' ? (
          <div className="coin-grid">
            {coins.map((c) => (
              <CoinCard coin={c} key={c.id} />
            ))}
          </div>
        ) : (
          <div className="panel table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Coin</th>
                  <th>Price / SOL</th>
                  <th>24h</th>
                  <th>Market cap</th>
                  <th>Reward vault</th>
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
                    <td>{c.price.toFixed(7)}</td>
                    <td className={c.change >= 0 ? 'positive' : 'negative'}>
                      {c.change >= 0 ? '+' : ''}
                      {c.change}%
                    </td>
                    <td>{compact(c.marketCap)} SOL</td>
                    <td>{sol(c.vault)} SOL</td>
                    <td>
                      <ModeBadge mode={c.mode} />
                    </td>
                    <td>
                      <a href={'#/coin/' + c.id} aria-label={'View ' + c.name}>
                        <Icon name="ChevronRight" />
                      </a>
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
              <PokemonArt id={coin.pokemonId} animated={false} />
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
                <PokemonArt id={coin.pokemonId} animated={false} />
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
                Market cap<strong>{compact(coin.marketCap)} SOL</strong>
              </span>
              <span>
                24h volume<strong>{compact(coin.volume)} SOL</strong>
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
