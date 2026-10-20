import { useMemo, useState } from 'react';
import { useApp } from '../state/AppContext';
import { Avatar, CoinAvatar, Icon, PokemonArt, Pokeball } from '../components/UI';
import { profileName } from '../state/model';
import { compact, relativeTime, sol } from '../utils';
import type { Activity, AppSnapshot, Profile } from '../types';

type EventKind = 'egg' | 'pack' | 'market' | 'evolve' | 'launch' | 'other';
export interface AnalyticsEvent {
  id: string;
  kind: EventKind;
  trainer: string;
  avatar: Pick<Profile, 'character' | 'accessoryColor'>;
  title: string;
  detail: string;
  createdAt: number;
  pokemonId?: number;
  shiny?: boolean;
  href: string;
}
export interface LaunchpadAnalytics {
  coins: number;
  activeCoins: number;
  combinedMarketCap: number;
  combinedVolume: number;
  currency: 'USD' | 'SOL';
  availableRewardFunds: number;
  modes: { mode: 'Eggs' | 'Packs' | 'Mixed'; count: number; color: string }[];
}
/** Snapshot-derived summary. Replace with a platform-wide analytics response when connected. */
export function summarizeLaunchpad(state: AppSnapshot): LaunchpadAnalytics {
  const quoted =
    state.coins.length > 0 &&
    state.coins.every(
      (coin) => Number.isFinite(coin.marketCapUsd) && Number.isFinite(coin.volumeUsd),
    );
  return {
    coins: state.coins.length,
    activeCoins: state.coins.filter((coin) => coin.active).length,
    combinedMarketCap: state.coins.reduce(
      (sum, coin) => sum + (quoted ? coin.marketCapUsd! : coin.marketCap),
      0,
    ),
    combinedVolume: state.coins.reduce(
      (sum, coin) => sum + (quoted ? coin.volumeUsd! : coin.volume),
      0,
    ),
    currency: quoted ? 'USD' : 'SOL',
    availableRewardFunds: state.coins.reduce((sum, coin) => sum + coin.vault, 0),
    modes: [
      {
        mode: 'Eggs',
        count: state.coins.filter((coin) => coin.mode === 'Eggs').length,
        color: '#edb362',
      },
      {
        mode: 'Packs',
        count: state.coins.filter((coin) => coin.mode === 'Packs').length,
        color: '#9a91d3',
      },
      {
        mode: 'Mixed',
        count: state.coins.filter((coin) => coin.mode === 'Mixed').length,
        color: '#77b9ae',
      },
    ],
  };
}
function activityKind(entry: Activity): EventKind {
  const text = (entry.title + ' ' + entry.detail).toLowerCase();
  if (entry.kind === 'evolve') return 'evolve';
  if (entry.kind === 'coin') return 'launch';
  if (['market', 'purchase', 'sale', 'listing'].includes(entry.kind)) return 'market';
  if (entry.kind === 'reward' && entry.pokemonId) {
    if (text.includes('pack')) return 'pack';
    if (text.includes('hatch') || text.includes('egg opened')) return 'egg';
  }
  return 'other';
}
export function accountAnalyticsEvents(state: AppSnapshot): AnalyticsEvent[] {
  return state.activity
    .map((entry) => ({
      ...entry,
      kind: activityKind(entry),
      trainer: profileName(state),
      avatar: state.profile,
      shiny: state.pokemon.find((pokemon) => entry.href === '/pokemon/' + pokemon.id)?.shiny,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}
/** Explicit illustration of the future community event stream, never included in metrics. */
function exampleCommunityEvents(anchor: number): AnalyticsEvent[] {
  return [
    {
      id: 'sample-pack-1',
      kind: 'pack',
      trainer: 'Leaf',
      avatar: { character: 'leaf', accessoryColor: '#65b883' },
      title: 'Opened a pack · Pikachu',
      detail: 'From $GENG · Alternate-colour find',
      pokemonId: 25,
      shiny: true,
      createdAt: anchor - 190000,
      href: '/rewards?tab=packs',
    },
    {
      id: 'sample-egg-1',
      kind: 'egg',
      trainer: 'Blue',
      avatar: { character: 'blue', accessoryColor: '#4e9ee8' },
      title: 'Hatched an egg · Lapras',
      detail: 'Rare egg · From $SQUIRT',
      pokemonId: 131,
      createdAt: anchor - 420000,
      href: '/rewards?tab=eggs',
    },
    {
      id: 'sample-market-1',
      kind: 'market',
      trainer: 'Misty',
      avatar: { character: 'misty', accessoryColor: '#ed87aa' },
      title: 'Bought Gengar on the marketplace',
      detail: 'Example purchase · 0.42 SOL',
      pokemonId: 94,
      createdAt: anchor - 780000,
      href: '/marketplace',
    },
    {
      id: 'sample-pack-2',
      kind: 'pack',
      trainer: 'Red',
      avatar: { character: 'red', accessoryColor: '#ef5357' },
      title: 'Opened a pack · Mewtwo',
      detail: 'Epic pack · From $POKE',
      pokemonId: 150,
      createdAt: anchor - 1260000,
      href: '/rewards?tab=packs',
    },
    {
      id: 'sample-evolve-1',
      kind: 'evolve',
      trainer: 'Brock',
      avatar: { character: 'brock', accessoryColor: '#efb13f' },
      title: 'Evolved Eevee into Jolteon',
      detail: 'Evolution complete · Funded value increased',
      pokemonId: 135,
      createdAt: anchor - 1980000,
      href: '/pokemon',
    },
    {
      id: 'sample-egg-2',
      kind: 'egg',
      trainer: 'Leaf',
      avatar: { character: 'leaf', accessoryColor: '#65b883' },
      title: 'Hatched an egg · Dratini',
      detail: 'Standard egg · From $DRAGO',
      pokemonId: 147,
      createdAt: anchor - 2820000,
      href: '/rewards?tab=eggs',
    },
    {
      id: 'sample-launch-1',
      kind: 'launch',
      trainer: 'Blue',
      avatar: { character: 'blue', accessoryColor: '#4e9ee8' },
      title: 'Launched a community coin',
      detail: 'Pokémon partner: Bulbasaur · Eggs mode',
      pokemonId: 1,
      createdAt: anchor - 3660000,
      href: '/create',
    },
  ];
}
const filters: { id: 'all' | EventKind; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'egg', label: 'Hatches' },
  { id: 'pack', label: 'Packs' },
  { id: 'market', label: 'Marketplace' },
  { id: 'evolve', label: 'Evolutions' },
  { id: 'launch', label: 'Launches' },
];
const eventLabels: Record<EventKind, string> = {
  egg: 'HATCH',
  pack: 'PACK',
  market: 'MARKET',
  evolve: 'EVOLUTION',
  launch: 'LAUNCH',
  other: 'ACTIVITY',
};

export function AnalyticsPage() {
  const { state, mode, now } = useApp();
  const [feed, setFeed] = useState<'account' | 'example'>(mode === 'demo' ? 'example' : 'account');
  const [filter, setFilter] = useState<'all' | EventKind>('all');
  const examples = useMemo(() => exampleCommunityEvents(Date.now()), []);
  const summary = summarizeLaunchpad(state);
  const yourEvents = accountAnalyticsEvents(state);
  const events = (feed === 'example' ? examples : yourEvents).filter(
    (event) => filter === 'all' || event.kind === filter,
  );
  const currency = (amount: number) =>
    summary.currency === 'USD' ? '$' + compact(amount) : compact(amount) + ' SOL';
  const ranked = [...state.coins].sort((a, b) => b.volume - a.volume).slice(0, 5);
  const largestVolume = Math.max(1, ...ranked.map((coin) => coin.volume));
  return (
    <div className="analytics-page">
      <header className="analytics-heading">
        <div>
          <h1>Launchpad analytics</h1>
          <p>Community markets, reward pools, and the latest discoveries.</p>
        </div>
        <span className="analytics-source-label">
          {mode === 'demo' ? 'Demo snapshot' : 'Available market snapshot'}
        </span>
      </header>
      <div className="analytics-metrics">
        <div>
          <span>Combined market cap</span>
          <strong>{currency(summary.combinedMarketCap)}</strong>
          <small>Across {summary.coins} tracked coins</small>
        </div>
        <div>
          <span>Reported trading volume</span>
          <strong>{currency(summary.combinedVolume)}</strong>
          <small>Combined coin volume in this snapshot</small>
        </div>
        <div>
          <span>Active communities</span>
          <strong>
            {summary.activeCoins}
            <em> / {summary.coins}</em>
          </strong>
          <small>Coins currently marked active</small>
        </div>
        <div>
          <span>Available reward pools</span>
          <strong>
            {sol(summary.availableRewardFunds)}
            <em> SOL</em>
          </strong>
          <small>Unallocated reward funds</small>
        </div>
      </div>
      <p className="analytics-data-caption">
        {mode === 'demo'
          ? 'Demo figures use sample market quotes. Community examples below are not real transactions.'
          : 'Totals cover the coins returned to this account, not a complete all-chain ledger.'}{' '}
        Reward funds exclude Pokémon values and allocated evolution budgets.
      </p>
      <div className="analytics-overview">
        <section className="analytics-volume-panel">
          <div className="analytics-panel-heading">
            <div>
              <h2>Most active coins</h2>
              <p>Ranked by reported trading volume</p>
            </div>
            <a href="#/explore">
              Explore <Icon name="ArrowUpRight" size={14} />
            </a>
          </div>
          <div className="analytics-volume-list">
            {ranked.map((coin, index) => (
              <a key={coin.id} href={'#/coin/' + coin.id} className="analytics-volume-row">
                <span className="analytics-rank">{index + 1}</span>
                <CoinAvatar coin={coin} size={38} />
                <div className="analytics-volume-name">
                  <strong>{coin.name}</strong>
                  <span>${coin.ticker}</span>
                </div>
                <div className="analytics-volume-chart">
                  <span
                    style={{
                      width: Math.max(2, (coin.volume / largestVolume) * 100) + '%',
                      background: coin.color,
                    }}
                  />
                </div>
                <strong>
                  {currency(summary.currency === 'USD' ? coin.volumeUsd! : coin.volume)}
                </strong>
              </a>
            ))}
            {!ranked.length && (
              <p className="analytics-empty-inline">No markets have been returned yet.</p>
            )}
          </div>
        </section>
        <section className="analytics-mode-panel">
          <div className="analytics-panel-heading">
            <div>
              <h2>How communities reward</h2>
              <p>Reward modes across tracked coins</p>
            </div>
          </div>
          <div
            className="analytics-mode-track"
            role="img"
            aria-label={summary.modes.map((item) => `${item.mode}: ${item.count} coins`).join(', ')}
          >
            {summary.modes.map((item) => (
              <span
                key={item.mode}
                style={{ flex: item.count || '0 0 0px', background: item.color }}
              />
            ))}
          </div>
          <div className="analytics-mode-legend">
            {summary.modes.map((item) => (
              <div key={item.mode}>
                <i style={{ background: item.color }} />
                <span>{item.mode === 'Mixed' ? 'Eggs + packs' : item.mode}</span>
                <strong>{item.count}</strong>
                <small>{summary.coins ? Math.round((item.count / summary.coins) * 100) : 0}%</small>
              </div>
            ))}
          </div>
          <a className="analytics-funding-link" href="#/guide?topic=value">
            <Pokeball size={23} />
            <span>Where reward value comes from</span>
            <Icon name="ArrowRight" size={15} />
          </a>
        </section>
      </div>
      <section className="analytics-feed-panel">
        <div className="analytics-feed-heading">
          <div>
            <h2>Trainer activity</h2>
            <p>Pack reveals, egg hatches, and moments from the community.</p>
          </div>
          <div className="analytics-feed-source" aria-label="Activity source">
            <button
              className={feed === 'example' ? 'active' : ''}
              aria-pressed={feed === 'example'}
              onClick={() => setFeed('example')}
            >
              Community preview
            </button>
            <button
              className={feed === 'account' ? 'active' : ''}
              aria-pressed={feed === 'account'}
              onClick={() => setFeed('account')}
            >
              Your activity
            </button>
          </div>
        </div>
        <div className={'analytics-feed-note ' + (feed === 'example' ? 'example' : '')}>
          <span>
            {feed === 'example'
              ? 'SAMPLE EVENTS'
              : mode === 'demo'
                ? 'YOUR DEMO ACCOUNT'
                : 'YOUR ACCOUNT'}
          </span>
          <p>
            {feed === 'example'
              ? 'Examples of the community feed. Live trainer events need the connected backend and do not affect the totals above.'
              : 'Recorded actions from this account. New pack openings, hatches, evolutions, and launches appear here.'}
          </p>
        </div>
        <nav className="analytics-event-filters" aria-label="Filter trainer activity">
          {filters.map((item) => (
            <button
              key={item.id}
              className={filter === item.id ? 'active' : ''}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="analytics-event-list" aria-live="polite">
          {events.length ? (
            events.map((event) => (
              <a
                className={'analytics-event event-' + event.kind}
                href={'#' + event.href}
                key={event.id}
              >
                <Avatar profile={event.avatar} size={44} />
                <div className="analytics-event-copy">
                  <div>
                    <strong>{event.trainer}</strong>
                    <span className={'analytics-event-tag ' + event.kind}>
                      {eventLabels[event.kind]}
                    </span>
                    <time dateTime={new Date(event.createdAt).toISOString()}>
                      {relativeTime(event.createdAt, now)}
                    </time>
                  </div>
                  <h3>{event.title}</h3>
                  <p>{event.detail}</p>
                </div>
                {event.pokemonId && (
                  <div className="analytics-event-pokemon">
                    <PokemonArt id={event.pokemonId} shiny={event.shiny} animated={false} />
                  </div>
                )}
                <Icon name="ChevronRight" size={14} />
              </a>
            ))
          ) : (
            <div className="analytics-feed-empty">
              <Pokeball size={40} />
              <h3>No matching activity yet</h3>
              <p>
                {feed === 'account'
                  ? 'Open a reward, evolve a Pokémon, or create a coin to add to your activity.'
                  : 'Choose another event category to explore the sample feed.'}
              </p>
              <a href="#/rewards">
                Go to Rewards <Icon name="ArrowRight" size={14} />
              </a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
