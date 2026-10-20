import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useApp } from '../state/AppContext';
import { pokemonById } from '../data/pokemon';
import { WALK_BOOST_MS_PER_KM } from '../state/model';
import {
  Button,
  Icon,
  EggArt,
  PackArt,
  PokemonArt,
  CoinAvatar,
  PageHeading,
  Progress,
  Modal,
  TypeChip,
  SolValue,
  EmptyState,
} from '../components/UI';
import type { Reward } from '../types';
import { duration, navigate, relativeTime, sol } from '../utils';
import { PixelWorld } from '../components/PixelWorld';
function SourceCoin({ id }: { id: string }) {
  const { state } = useApp(),
    coin = state.coins.find((c) => c.id === id);
  return coin ? (
    <span className="source-coin">
      <CoinAvatar coin={coin} size={22} />
      {'$' + coin.ticker}
    </span>
  ) : null;
}
export function RewardOpening({ reward, onClose }: { reward: Reward; onClose: () => void }) {
  const { state, act, busy } = useApp(),
    [phase, setPhase] = useState('opening'),
    [confirmed, setConfirmed] = useState(false),
    started = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    act({ type: 'reward.open', id: reward.id }).then((result) => {
      if (!result) {
        onClose();
        return;
      }
      setConfirmed(true);
      timer.current = setTimeout(
        () => setPhase('revealed'),
        state.profile.reducedMotion ? 80 : 2600,
      );
    });
    return () => {
      clearTimeout(timer.current);
    };
  }, []);
  const resolvedReward = state.rewards.find((r) => r.id === reward.id) || reward;
  const p = pokemonById(resolvedReward.outcomeSpeciesId || 1);
  return (
    <Modal
      title={
        phase === 'revealed'
          ? p.name + (reward.kind === 'egg' ? ' hatched!' : ' joins your team!')
          : reward.kind === 'egg'
            ? 'Your egg is hatching…'
            : 'Opening your pack…'
      }
      onClose={onClose}
      wide
      closeDisabled={phase !== 'revealed'}
    >
      <div
        className={
          'opening-scene ' +
          phase +
          ' ' +
          reward.kind +
          (state.profile.reducedMotion ? ' reduced' : '')
        }
      >
        <div className="opening-halo" />
        <div className="opening-sparkles">
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              style={{ '--i': i, '--r': (i * 37) % 360, '--d': i * 0.07 + 's' } as CSSProperties}
            >
              <svg viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true">
                <path d="M5 0h2v3h2v2h3v2H9v2H7v3H5V9H3V7H0V5h3V3h2z" fill="currentColor" />
              </svg>
            </span>
          ))}
        </div>
        {phase === 'opening' ? (
          <>
            <div className={'opening-object ' + (confirmed ? 'animate' : '')}>
              {reward.kind === 'egg' ? (
                <>
                  <EggArt tier={reward.tier} />
                  <svg className="egg-crack" viewBox="0 0 160 190">
                    <path
                      d="M52 70h20v20H60v16h30v18H78v12h30"
                      stroke="#59647a"
                      strokeWidth="3"
                      fill="none"
                    />
                  </svg>
                </>
              ) : (
                <PackArt tier={reward.tier} />
              )}
            </div>
            <p className="opening-caption">
              {confirmed
                ? reward.kind === 'egg'
                  ? 'What will hatch from the egg?'
                  : 'Opening…'
                : 'Getting your reward ready…'}
            </p>
          </>
        ) : (
          <>
            <div className="revealed-pokemon">
              <PokemonArt id={p.id} eager />
            </div>
            <span className={'rarity-badge ' + reward.tier.toLowerCase()}>
              <Icon name="Sparkles" size={13} />
              {reward.tier}
            </span>
            <h2>
              {p.name}
              <span> #{String(p.id).padStart(3, '0')}</span>
            </h2>
            <div className="type-row">
              {p.types.map((t) => (
                <TypeChip type={t} key={t} />
              ))}
            </div>
            <div className="reveal-value">
              <SolValue amount={resolvedReward.backing} />
            </div>
            <div className="reveal-actions">
              <Button
                disabled={busy}
                onClick={async () => {
                  const s = await act({ type: 'pokemon.equip', id: 'hatched-' + reward.id });
                  if (s) {
                    onClose();
                    navigate('/pokemon/hatched-' + reward.id);
                  }
                }}
              >
                Equip Pokémon
                <Icon name="Heart" size={16} />
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  onClose();
                  navigate('/pokemon/hatched-' + reward.id);
                }}
              >
                View Pokémon
              </Button>
            </div>
            <small className="muted">Already added to your inventory and Pokédex.</small>
          </>
        )}
      </div>
    </Modal>
  );
}
export function RewardsPage({ initialTab = 'eggs' }: { initialTab?: string }) {
  const { state, now } = useApp(),
    [tab, setTab] = useState(initialTab),
    [detail, setDetail] = useState<Reward | null>(null),
    [opening, setOpening] = useState<Reward | null>(null);
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  const eggs = state.rewards.filter((r) => r.kind === 'egg' && !r.openedAt),
    packs = state.rewards.filter((r) => r.kind === 'pack' && !r.openedAt),
    ready = eggs.filter((r) => r.readyAt <= now).length;
  const equipped = state.pokemon.find((p) => p.id === state.profile.equippedId);
  const open = (r: Reward) => {
    if (r.readyAt > now) {
      setDetail(r);
      return;
    }
    setDetail(null);
    setOpening(r);
  };
  const current = tab === 'packs' ? packs : eggs;
  return (
    <>
      <PageHeading title="Rewards">
        <a href="#/walk" className="button secondary">
          <Icon name="Footprints" size={17} />
          Take a walk
        </a>
      </PageHeading>
      <div className="reward-depot">
        <div className="depot-sign">
          <strong>DAY CARE</strong>
          <span>Reward storage</span>
        </div>
        <div className="depot-count">
          <EggArt />
          <span>
            <strong>{eggs.length} eggs</strong>
            <small>{ready} ready to hatch</small>
          </span>
        </div>
        <div className="depot-count pack-count">
          <PackArt />
          <span>
            <strong>{packs.length} packs</strong>
            <small>Open anytime</small>
          </span>
        </div>
        <div className="depot-distance">
          <strong>
            {state.walkKm.toFixed(1)} <small>km</small>
          </strong>
          <span>walked</span>
        </div>
      </div>
      <div className="rewards-toolbar">
        <div className="tab-bar">
          <button className={tab === 'eggs' ? 'active' : ''} onClick={() => setTab('eggs')}>
            <Icon name="Egg" size={18} />
            My eggs <span>{eggs.length}</span>
          </button>
          <button className={tab === 'packs' ? 'active' : ''} onClick={() => setTab('packs')}>
            <Icon name="Package" size={18} />
            My packs <span>{packs.length}</span>
          </button>
          <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
            <Icon name="Clock" size={17} />
            Opened
          </button>
        </div>
      </div>
      {tab !== 'history' ? (
        current.length ? (
          <div className="rewards-grid">
            {current.map((r, i) => {
              const isReady = r.readyAt <= now,
                percent = r.initialDuration
                  ? 100 - ((r.readyAt - now) / r.initialDuration) * 100
                  : 100,
                km = Math.max(0, (r.readyAt - now) / WALK_BOOST_MS_PER_KM);
              return (
                <button
                  key={r.id}
                  className={'reward-card ' + r.tier.toLowerCase() + (isReady ? ' ready' : '')}
                  onClick={() => open(r)}
                  aria-label={
                    isReady
                      ? (r.kind === 'egg' ? 'Hatch ' : 'Open ') + r.tier + ' ' + r.kind
                      : 'View ' + r.tier + ' egg'
                  }
                >
                  <div className="reward-card-top">
                    <span className={'rarity-badge ' + r.tier.toLowerCase()}>{r.tier}</span>
                    {isReady ? (
                      <span className="ready-label">
                        <span />
                        Ready!
                      </span>
                    ) : (
                      <span className="small muted">#{String(i + 1).padStart(2, '0')}</span>
                    )}
                  </div>
                  <div className="reward-art-stage">
                    {r.kind === 'egg' ? <EggArt tier={r.tier} /> : <PackArt tier={r.tier} />}
                  </div>
                  <h3>
                    {r.tier} {r.kind === 'egg' ? 'egg' : 'pack'}
                  </h3>
                  <div className="reward-origin">
                    From <SourceCoin id={r.originCoin} />
                  </div>
                  {r.kind === 'egg' ? (
                    <>
                      <Progress
                        value={percent}
                        color={
                          isReady
                            ? '#75bc94'
                            : r.tier === 'Epic'
                              ? '#ad89ce'
                              : r.tier === 'Rare'
                                ? '#7abce5'
                                : '#83b985'
                        }
                      />
                      <div className="reward-time">
                        <Icon name={isReady ? 'Sparkles' : 'Clock'} size={14} />
                        {isReady ? 'Ready to hatch' : duration(r.readyAt - now) + ' remaining'}
                      </div>
                      {!isReady && (
                        <div className="walk-equivalent">
                          <Icon name="Footprints" size={14} />
                          {km.toFixed(1)} km to hatch sooner
                          <span className="tooltip">
                            Walking accelerates the timer. You can also let it hatch with time.
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="pack-ready-copy">Open anytime</p>
                  )}
                  <span className={'reward-action ' + (isReady ? 'ready' : '')}>
                    {r.kind === 'pack' ? 'Open pack' : isReady ? 'Hatch egg' : 'View egg'}
                    <Icon name={isReady ? 'Sparkles' : 'ArrowRight'} size={16} />
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={tab === 'eggs' ? 'Egg' : 'Package'}
            title={tab === 'eggs' ? 'No eggs in storage' : 'No packs in storage'}
            description="Keep holding active community coins to become eligible for new rewards."
          >
            <a href="#/discover" className="button primary">
              Explore coins
              <Icon name="ArrowRight" />
            </a>
          </EmptyState>
        )
      ) : (
        <div className="panel">
          {state.rewards.filter((r) => r.openedAt).length ? (
            state.rewards
              .filter((r) => r.openedAt)
              .map((r) => (
                <a className="opened-reward-row" href={'#/pokemon/hatched-' + r.id} key={r.id}>
                  <PokemonArt id={r.outcomeSpeciesId || 1} />
                  <span>
                    <strong>{pokemonById(r.outcomeSpeciesId || 1).name}</strong>
                    <small>{r.tier + ' ' + r.kind + ' · ' + relativeTime(r.openedAt!)}</small>
                  </span>
                  <SourceCoin id={r.originCoin} />
                  <SolValue amount={r.backing} />
                  <Icon name="ChevronRight" />
                </a>
              ))
          ) : (
            <EmptyState
              title="No opened rewards yet"
              description="Open a pack or hatch a ready egg. Your discoveries will appear here."
            />
          )}
        </div>
      )}
      <div className="buddy-banner">
        <PokemonArt id={equipped?.speciesId || 4} />
        <div>
          <h3>Walk with {pokemonById(equipped?.speciesId || 4).name}</h3>
          <p>Walking reduces the time remaining on your eggs.</p>
        </div>
        <a href="#/walk" className="button secondary">
          <Icon name="Footprints" />
          Go walking
          <Icon name="ArrowRight" size={16} />
        </a>
        <span className="buddy-scenery" />
      </div>
      {detail && (
        <Modal title={detail.tier + ' egg'} onClose={() => setDetail(null)} wide>
          <div className="egg-detail">
            <div className="egg-detail-visual">
              <EggArt tier={detail.tier} />
              <span className={'rarity-badge ' + detail.tier.toLowerCase()}>{detail.tier}</span>
              <h3>{duration(detail.readyAt - now)}</h3>
              <Progress value={100 - ((detail.readyAt - now) / detail.initialDuration) * 100} />
              <span className="muted small">
                {Math.max(0, (detail.readyAt - now) / WALK_BOOST_MS_PER_KM).toFixed(1)} km of
                walking would finish this timer sooner
              </span>
              <SourceCoin id={detail.originCoin} />
              {detail.readyAt <= now ? (
                <Button onClick={() => open(detail)}>
                  Hatch my egg
                  <Icon name="Sparkles" />
                </Button>
              ) : (
                <a className="button primary" href="#/walk" onClick={() => setDetail(null)}>
                  <Icon name="Footprints" />
                  Start a walking preview
                </a>
              )}
            </div>
            <div className="egg-odds">
              <h3>Reward table</h3>
              <p>Example reward table for this {detail.tier.toLowerCase()} egg.</p>
              <div className="odds-table">
                {(detail.tier === 'Epic'
                  ? [6, 94, 149, 131]
                  : detail.tier === 'Rare'
                    ? [25, 93, 131, 133]
                    : [1, 4, 7, 25]
                ).map((id, i) => (
                  <div key={id}>
                    <PokemonArt id={id} />
                    <strong>{pokemonById(id).name}</strong>
                    <span>{[35, 30, 25, 10][i]}%</span>
                  </div>
                ))}
              </div>
              <div className="notice">
                <Icon name="Shield" />
                <span>
                  Your egg’s reward is already reserved. Its contents won’t change if you sell a
                  coin.
                </span>
              </div>
              <small className="muted">
                Preview odds and rewards are sample data. Live odds will come from the funded batch.
              </small>
            </div>
          </div>
        </Modal>
      )}
      {opening && <RewardOpening reward={opening} onClose={() => setOpening(null)} />}
    </>
  );
}
export function WalkPage() {
  const { state, act, mode, now } = useApp(),
    [walking, setWalking] = useState(false),
    [sessionKm, setSessionKm] = useState(0);
  const equipped = state.pokemon.find((p) => p.id === state.profile.equippedId),
    id = equipped?.speciesId || 4;
  const active = state.rewards.filter((r) => r.kind === 'egg' && !r.openedAt);
  useEffect(() => {
    if (!walking || mode !== 'demo') return;
    const t = setInterval(() => {
      act({ type: 'walk.progress', km: 0.1 }).then((s) => {
        if (s) setSessionKm((k) => k + 0.1);
      });
    }, 4000);
    return () => clearInterval(t);
  }, [walking, mode]);
  return (
    <>
      <PageHeading
        eyebrow="BETTER WITH A BUDDY"
        title={'Walk with ' + pokemonById(id).name}
        description="Fresh air for you. A little boost for your eggs."
      />
      <div className="walking-grid">
        <div className="walking-map panel">
          <div className="map-top">
            <span className="status-tag green">
              {walking ? 'Preview in progress' : 'Ready to walk'}
            </span>
            <span>
              <Icon name="Footprints" size={15} />
              {sessionKm.toFixed(1)} km
            </span>
          </div>
          <PixelWorld pokemonId={id} />
          <div className={'walking-buddy ' + (walking ? 'walking' : '')}>
            <PokemonArt id={id} />
            <span>{pokemonById(id).name}</span>
          </div>
          <div className="map-message">
            <Icon name="Heart" size={18} />
            {walking ? 'Walking preview active' : 'Start a walking session to boost your eggs.'}
          </div>
        </div>
        <div className="walking-sidebar">
          <div className="panel walk-session">
            <h3>Your walking session</h3>
            <div className="session-number">
              {sessionKm.toFixed(1)}
              <span>km</span>
            </div>
            <div className="walk-stats">
              <span>
                <Icon name="Clock" />
                <strong>{(sessionKm * 2).toFixed(1)}h</strong>time saved
              </span>
              <span>
                <Icon name="Egg" />
                <strong>{active.filter((r) => r.readyAt > now).length}</strong>eggs boosted
              </span>
            </div>
            <Button
              className="full-width"
              onClick={() => setWalking(!walking)}
              disabled={mode !== 'demo'}
            >
              <Icon name={walking ? 'Pause' : 'Play'} size={17} />
              {walking ? 'Pause preview' : 'Start walking preview'}
            </Button>
            {sessionKm > 0 && (
              <Button
                variant="ghost"
                className="full-width"
                onClick={() => {
                  setWalking(false);
                  setSessionKm(0);
                }}
              >
                End session
              </Button>
            )}
            <div className="notice small">
              <Icon name="Info" />
              This simulates walking for the frontend preview. It does not read GPS or verify real
              movement.
            </div>
          </div>
          <div className="panel walk-eggs">
            <h3>Egg timers</h3>
            {active.slice(0, 3).map((r) => (
              <div key={r.id}>
                <EggArt tier={r.tier} />
                <span>
                  <strong>{r.tier} egg</strong>
                  <small>{duration(r.readyAt - now)}</small>
                  <Progress value={100 - ((r.readyAt - now) / r.initialDuration) * 100} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
