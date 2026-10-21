import { ContentSkeleton } from '../components/Loading';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/AppContext';
import { Avatar, Icon, PokemonArt, Pokeball } from '../components/UI';
import { profileName } from '../state/model';
import { asset, compact, relativeTime, sol } from '../utils';
import {
  loadPlatformAnalytics,
  mergeAnalyticsEvents,
  type AnalyticsEvent,
  type AnalyticsEventKind,
  type PlatformAnalytics,
} from '../services/analytics';
import type { Activity, AppSnapshot } from '../types';
export type { AnalyticsEvent } from '../services/analytics';

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
function activityKind(entry: Activity): AnalyticsEventKind {
  const text = (entry.title + ' ' + entry.detail).toLowerCase();
  if (entry.kind === 'evolve') return 'evolve';
  if (entry.kind === 'coin') return 'launch';
  if (entry.kind === 'redeem' || (entry.kind === 'trade' && text.includes('redeemed')))
    return 'redeem';
  if (entry.kind === 'reward' && entry.pokemonId) {
    if (text.includes('pack')) return 'pack';
    if (text.includes('hatch') || text.includes('egg opened')) return 'egg';
  }
  return 'other';
}

export function accountAnalyticsEvents(state: AppSnapshot): AnalyticsEvent[] {
  return state.activity
    .filter((entry) => !['market', 'purchase', 'sale', 'listing'].includes(entry.kind))
    .filter((entry) => !entry.href.startsWith('/marketplace'))
    .map((entry) => ({
      ...entry,
      kind: activityKind(entry),
      trainer: profileName(state),
      trainerWallet: state.profile.wallet,
      avatar: state.profile,
      shiny:
        entry.shiny ??
        state.pokemon.find((pokemon) => entry.href === '/pokemon/' + pokemon.id)?.shiny,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

const filters: { id: 'all' | AnalyticsEventKind; label: string }[] = [
  { id: 'all', label: 'All activity' },
  { id: 'egg', label: 'Hatches' },
  { id: 'pack', label: 'Packs' },
  { id: 'evolve', label: 'Evolutions' },
  { id: 'redeem', label: 'Redemptions' },
  { id: 'launch', label: 'Launches' },
];
const eventLabels: Record<AnalyticsEventKind, string> = {
  egg: 'Hatched',
  pack: 'Pack opened',
  redeem: 'Redeemed',
  evolve: 'Evolved',
  launch: 'Coin launched',
  other: 'Trainer update',
};

type Connection = 'demo' | 'connecting' | 'connected' | 'reconnecting' | 'unavailable';

function usePlatformAnalytics(mode: 'demo' | 'live', refresh: number) {
  const [snapshot, setSnapshot] = useState<PlatformAnalytics | null>(null);
  const [connection, setConnection] = useState<Connection>(mode === 'demo' ? 'demo' : 'connecting');
  const baseUrl = import.meta.env?.VITE_API_BASE_URL as string | undefined;
  useEffect(() => {
    if (mode === 'demo' || !baseUrl) {
      setConnection('demo');
      return;
    }
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    async function poll() {
      let retry = false;
      try {
        const next = await loadPlatformAnalytics(baseUrl!, controller.signal);
        if (disposed) return;
        setSnapshot(next);
        setConnection('connected');
      } catch {
        if (disposed) return;
        retry = true;
        setConnection((current) =>
          current === 'connected' || current === 'reconnecting' ? 'reconnecting' : 'unavailable',
        );
      }
      if (!disposed) timer = setTimeout(poll, retry ? 15000 : 10000);
    }
    void poll();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [baseUrl, mode, refresh]);
  return { snapshot, connection };
}

export function AnalyticsPage() {
  const { state, mode, now } = useApp();
  const [filter, setFilter] = useState<'all' | AnalyticsEventKind>('all');
  const [scope, setScope] = useState<'community' | 'account'>('community');
  const [refresh, setRefresh] = useState(0);
  const { snapshot, connection } = usePlatformAnalytics(mode, refresh);
  const accountEvents = useMemo(() => accountAnalyticsEvents(state), [state]);
  const communityEvents = useMemo(
    () => mergeAnalyticsEvents(snapshot?.events ?? [], accountEvents),
    [snapshot, accountEvents],
  );
  const selectedEvents = scope === 'account' || mode === 'demo' ? accountEvents : communityEvents;
  const events = selectedEvents
    .filter((event) => filter === 'all' || event.kind === filter)
    .slice(0, 100);
  const metrics = snapshot?.metrics;
  const initialLoading = mode === 'live' && !snapshot && connection === 'connecting';
  const connectionLabel: Record<Connection, string> = {
    demo: 'Demo account',
    connecting: 'Connecting',
    connected: 'Connected · auto-updating',
    reconnecting: 'Reconnecting',
    unavailable: 'Awaiting connection',
  };

  return (
    <div className="analytics-page">
      <header className="analytics-heading">
        <div>
          <h1>Analytics</h1>
          <p>Rewards, trading, and trainer activity across Kanto.</p>
        </div>
        <span className={'analytics-connection ' + connection} role="status">
          <i aria-hidden="true" />
          {connectionLabel[connection]}
        </span>
      </header>

      <section className="analytics-metrics" aria-label="Platform totals">
        {initialLoading ? (
          <ContentSkeleton label="Loading platform totals" />
        ) : (
          <>
            <div className="analytics-metric rewards">
              <span className="analytics-metric-icon">
                <Icon name="Candy" size={24} />
              </span>
              <div className="analytics-metric-copy">
                <span>Total rewards</span>
                <strong aria-label={metrics ? undefined : 'Total rewards unavailable'}>
                  {metrics ? sol(metrics.totalRewardsSol) : '—'}
                  <em>
                    <img src={asset('brand/solana.svg')} width="16" height="13" alt="" />
                    SOL
                  </em>
                </strong>
                <small>Distributed to trainers · all time</small>
              </div>
            </div>
            <div className="analytics-metric volume">
              <span className="analytics-metric-icon">
                <Icon name="TrendingUp" size={24} />
              </span>
              <div className="analytics-metric-copy">
                <span>Platform trading volume</span>
                <strong
                  aria-label={metrics ? undefined : 'Platform trading volume unavailable'}
                  title={metrics ? sol(metrics.platformTradingVolumeSol) + ' SOL' : undefined}
                >
                  {metrics ? compact(metrics.platformTradingVolumeSol) : '—'}
                  <em>
                    <img src={asset('brand/solana.svg')} width="16" height="13" alt="" />
                    SOL
                  </em>
                </strong>
                <small>Across all Kanto coins · all time</small>
              </div>
            </div>
            <div className="analytics-metric trainers">
              <span className="analytics-metric-icon">
                <Icon name="Users" size={24} />
              </span>
              <div className="analytics-metric-copy">
                <span>Active users</span>
                <strong aria-label={metrics ? undefined : 'Active users unavailable'}>
                  {metrics ? metrics.activeUsers24h.toLocaleString('en-US') : '—'}
                </strong>
                <small>Unique active trainers · past 24 hours</small>
              </div>
            </div>
          </>
        )}
      </section>
      <div className="analytics-data-caption">
        <p>
          {mode === 'demo'
            ? 'Platform totals appear when the backend is connected. Your demo activity updates as you play.'
            : snapshot
              ? 'Platform totals updated ' +
                relativeTime(snapshot.updatedAt, now).toLowerCase() +
                '.'
              : 'Connecting to platform totals. Your account activity is available below.'}
          {connection === 'reconnecting' && ' Showing the last update while we reconnect.'}
        </p>
        {mode === 'live' && (connection === 'unavailable' || connection === 'reconnecting') && (
          <button onClick={() => setRefresh((value) => value + 1)}>Try again</button>
        )}
      </div>

      <section className="analytics-feed-panel" aria-labelledby="trainer-activity-title">
        <div className="analytics-feed-heading">
          <div className="analytics-feed-title">
            <span className="analytics-feed-ball">
              <Pokeball size={30} />
            </span>
            <div>
              <h2 id="trainer-activity-title">Trainer Activity</h2>
              <p>Hatches, pack reveals, evolutions, and redemptions.</p>
            </div>
          </div>
          {mode === 'live' ? (
            <div className="analytics-feed-source" aria-label="Activity source">
              <button
                className={scope === 'community' ? 'active' : ''}
                aria-pressed={scope === 'community'}
                onClick={() => setScope('community')}
              >
                Community
              </button>
              <button
                className={scope === 'account' ? 'active' : ''}
                aria-pressed={scope === 'account'}
                onClick={() => setScope('account')}
              >
                Your activity
              </button>
            </div>
          ) : (
            <span className="analytics-local-label">Your demo activity</span>
          )}
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
        <div className="analytics-feed-meta">
          <span>
            {events.length} recent {events.length === 1 ? 'event' : 'events'}
          </span>
          <span>
            {mode === 'demo' || scope === 'account'
              ? 'Updates as you play'
              : snapshot
                ? 'Updates every 10 seconds'
                : 'Showing your account activity'}
          </span>
        </div>
        <div className="analytics-event-list">
          {events.length ? (
            events.map((event) => (
              <article className={'analytics-event event-' + event.kind} key={event.id}>
                <a
                  className="analytics-trainer-avatar"
                  href={
                    event.trainerWallet
                      ? '#/trainer/' + encodeURIComponent(event.trainerWallet)
                      : '#' + event.href
                  }
                  aria-label={'View ' + event.trainer}
                >
                  <Avatar profile={event.avatar} size={46} />
                </a>
                <div className="analytics-event-copy">
                  <div className="analytics-event-byline">
                    {event.trainerWallet ? (
                      <a href={'#/trainer/' + encodeURIComponent(event.trainerWallet)}>
                        {event.trainer}
                      </a>
                    ) : (
                      <strong>{event.trainer}</strong>
                    )}
                    <span className={'analytics-event-tag ' + event.kind}>
                      {eventLabels[event.kind]}
                    </span>
                  </div>
                  <a className="analytics-event-action" href={'#' + event.href}>
                    <h3>{event.title}</h3>
                    <p>{event.detail}</p>
                  </a>
                </div>
                {event.pokemonId && (
                  <a
                    className="analytics-event-pokemon"
                    href={'#' + event.href}
                    aria-label={event.title}
                  >
                    <PokemonArt id={event.pokemonId} shiny={event.shiny} animated={false} />
                  </a>
                )}
                <time dateTime={new Date(event.createdAt).toISOString()}>
                  {relativeTime(event.createdAt, now)}
                </time>
                <a
                  className="analytics-event-open"
                  href={'#' + event.href}
                  aria-label={event.title}
                >
                  <Icon name="ChevronRight" size={16} />
                </a>
              </article>
            ))
          ) : (
            <div className="analytics-feed-empty">
              <Pokeball size={44} />
              <h3>
                {filter === 'all'
                  ? 'Your next discovery starts here'
                  : 'No ' +
                    filters.find((item) => item.id === filter)?.label.toLowerCase() +
                    ' yet'}
              </h3>
              <p>Open a reward, evolve a Pokémon, or launch a coin to join the activity.</p>
              <a href="#/rewards">
                Explore your rewards <Icon name="ArrowRight" size={15} />
              </a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
