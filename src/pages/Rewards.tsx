import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useApp } from '../state/AppContext';
import { LiveWalkPage } from './LiveWalk';
import { eggWalkingMeters, walkingDistance } from '../services/walking-controller';
import { pokemonById } from '../data/pokemon';
import { RewardProbabilities } from '../components/RewardProbabilities';
import { rewardBudget } from '../state/model';
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
  Pokeball,
} from '../components/UI';
import type { AppSnapshot, Reward } from '../types';
import { duration, navigate, relativeTime } from '../utils';
import { useRevealAudio } from '../audio/sound';
import { REVEAL_TIMELINES } from '../audio/catalog';
import type { RevealFrame } from '../audio/reveal-timeline';
import { preloadPokemonArtwork } from '../components/pokemon-art-loading';

const legendaryIds = [144, 145, 146, 150, 151];
function SourceCoin({ id }: { id: string }) {
  const { state } = useApp(),
    coin = state.coins.find((c) => c.id === id);
  return coin ? (
    <span className="source-coin">
      <CoinAvatar coin={coin} size={24} />
      {'$' + coin.ticker}
    </span>
  ) : null;
}
function TierBadge({ tier }: { tier: string }) {
  return (
    <span className={'reward-tier ' + tier.toLowerCase()}>
      <Pokeball size={16} />
      {tier}
    </span>
  );
}
function progressOf(reward: Reward, now: number) {
  return reward.initialDuration
    ? Math.max(0, Math.min(100, 100 - ((reward.readyAt - now) / reward.initialDuration) * 100))
    : 100;
}

export function RewardOpening({
  reward,
  onClose,
  audio,
}: {
  reward: Reward;
  onClose: () => void;
  audio: ReturnType<typeof useRevealAudio>;
}) {
  const { state, act, busy } = useApp();
  const kind = reward.kind === 'egg' ? 'hatch' : 'pack';
  const [phase, setPhase] = useState<'opening' | 'revealed'>('opening');
  const [frame, setFrame] = useState<RevealFrame>({
    elapsedMs: 0,
    durationMs: REVEAL_TIMELINES[kind].durationMs,
    progress: 0,
    revealed: false,
  });
  const [result, setResult] = useState<AppSnapshot | null>(null);
  const artworkReady = useRef(false);
  const [artworkError, setArtworkError] = useState(false);
  const [artworkAttempt, setArtworkAttempt] = useState(0);
  const resolvedReward = result?.rewards.find((r) => r.id === reward.id);
  const owned = result?.pokemon.find(
    (p) => p.id === (resolvedReward?.pokemonInstanceId || 'hatched-' + reward.id),
  );
  useEffect(() => {
    if (!owned || !result) return;
    let cancelled = false;
    artworkReady.current = false;
    setArtworkError(false);
    void preloadPokemonArtwork({
      id: owned.speciesId,
      shiny: owned.shiny,
      artStyle: result.profile.artStyle,
      reducedMotion: result.profile.reducedMotion,
    }).then(
      () => {
        if (!cancelled) artworkReady.current = true;
      },
      () => {
        if (!cancelled) setArtworkError(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [owned, result, artworkAttempt]);
  const openRequest = useRef<Promise<AppSnapshot | null> | null>(null);
  useEffect(() => {
    let cancelled = false;
    openRequest.current ??= act({ type: 'reward.open', id: reward.id });
    openRequest.current.then((next) => {
      if (cancelled) return;
      if (!next) {
        onClose();
        return;
      }
      setResult(next);
    });
    return () => {
      cancelled = true;
      audio.stop();
    };
  }, []);
  useEffect(() => {
    if (!result) return;
    void audio.start(kind, {
      reducedMotion: result.profile.reducedMotion,
      canReveal: () => artworkReady.current,
      onFrame: setFrame,
      onReveal: () => setPhase('revealed'),
    });
    return audio.stop;
  }, [result, kind, audio.start, audio.stop]);
  const species = pokemonById(owned?.speciesId || resolvedReward?.outcomeSpeciesId || 1);
  const revealed = phase === 'revealed' && !!owned;
  return (
    <Modal
      title={
        revealed
          ? reward.kind === 'egg'
            ? 'A new hatch!'
            : 'Your pack reveal'
          : reward.kind === 'egg'
            ? 'Your egg is hatching…'
            : 'Opening your pack…'
      }
      onClose={onClose}
      wide
    >
      <div
        data-reveal-synced
        data-reveal-kind={kind}
        data-reveal-progress={frame.revealed ? 'complete' : 'opening'}
        style={
          {
            '--reveal-elapsed': `-${frame.elapsedMs}ms`,
            '--reveal-duration': `${frame.durationMs}ms`,
          } as CSSProperties
        }
        className={
          'reveal-v3 ' +
          (revealed ? 'is-revealed' : 'is-opening') +
          (state.profile.reducedMotion || frame.durationMs === 180 ? ' reduce-motion' : '')
        }
      >
        <div className="reveal-v3-stage">
          <div className="reveal-v3-aura" />
          <div className="reveal-v3-stars" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <span
                key={i}
                style={
                  {
                    '--angle': i * 30 + 'deg',
                    '--delay': i * 0.17 + 's',
                    '--distance': (i % 2 ? 115 : 140) + 'px',
                  } as CSSProperties
                }
              >
                <svg viewBox="0 0 12 12">
                  <path
                    d="M6 0 7.8 4.2 12 6 7.8 7.8 6 12 4.2 7.8 0 6 4.2 4.2Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
            ))}
          </div>
          <div className={'reveal-v3-object ' + (result ? 'is-confirmed' : '')}>
            {revealed ? (
              <PokemonArt id={species.id} shiny={owned?.shiny} eager />
            ) : reward.kind === 'egg' ? (
              <EggArt tier={reward.tier} />
            ) : (
              <PackArt tier={reward.tier} />
            )}
          </div>
          {!revealed && result && <div className="reveal-v3-flash" />}
        </div>
        {revealed ? (
          <div className="reveal-v3-details">
            {legendaryIds.includes(species.id) && (
              <span className="legendary-discovery">Legendary discovery</span>
            )}
            <h2>{species.name}</h2>
            <div className="type-row">
              {species.types.map((type) => (
                <TypeChip type={type} key={type} />
              ))}
            </div>
            <div className="reveal-v3-value">
              {owned.gift ? (
                <span className="gift-badge">Gift · cannot be sold</span>
              ) : (
                <SolValue amount={owned.backing} />
              )}
            </div>
            <div className="reveal-v3-source">
              From {reward.gift ? 'Kanto' : <SourceCoin id={reward.originCoin} />}
            </div>
            <div className="reveal-v3-actions">
              <Button
                disabled={busy}
                onClick={async () => {
                  const next = await act({ type: 'pokemon.equip', id: owned.id });
                  if (next) {
                    onClose();
                    navigate('/pokemon/' + owned.id);
                  }
                }}
              >
                Equip Pokémon <Icon name="Heart" size={17} />
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  onClose();
                  navigate('/pokemon/' + owned.id);
                }}
              >
                View summary <Icon name="ArrowRight" size={16} />
              </Button>
            </div>
            <p className="reveal-v3-note">Added to your PC and Pokédex.</p>
          </div>
        ) : (
          <div className="reveal-v3-wait" role="status">
            <h3>
              {artworkError
                ? 'Your Pokémon is safe in your PC.'
                : result
                  ? reward.kind === 'egg'
                    ? 'Something is moving…'
                    : 'Who’s inside?'
                  : 'Getting your reward ready…'}
            </h3>
            <p>
              {artworkError
                ? 'The artwork couldn’t load. Try again or view it in your PC.'
                : result
                  ? 'Your new Pokémon is almost here.'
                  : 'You can close this window. Opened rewards are saved in your PC.'}
            </p>
            {artworkError && (
              <div className="reveal-v3-actions">
                <Button onClick={() => setArtworkAttempt((attempt) => attempt + 1)}>
                  Retry artwork
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    onClose();
                    navigate('/pokemon');
                  }}
                >
                  My PC
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function RewardsPage({ initialTab = 'eggs' }: { initialTab?: string }) {
  const { state, now, mode } = useApp();
  const revealAudio = useRevealAudio();
  const [tab, setTab] = useState(initialTab),
    [detail, setDetail] = useState<Reward | null>(null),
    [opening, setOpening] = useState<Reward | null>(null);
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  const eggs = state.rewards
    .filter((r) => r.kind === 'egg' && !r.openedAt)
    .sort((a, b) => a.readyAt - b.readyAt);
  const packs = state.rewards.filter((r) => r.kind === 'pack' && !r.openedAt);
  const ready = eggs.filter((r) => r.readyAt <= now).length;
  const equipped = state.pokemon.find((p) => p.id === state.profile.equippedId);
  const current = tab === 'packs' ? packs : eggs;
  const selected = detail ? state.rewards.find((r) => r.id === detail.id) || detail : null;
  const showDetail = (r: Reward) => setDetail(r);
  const open = (r: Reward) => {
    if (r.readyAt > now) {
      showDetail(r);
      return;
    }
    revealAudio.unlock(r.kind === 'egg' ? 'hatch' : 'pack');
    setDetail(null);
    setOpening(r);
  };
  return (
    <div className="rewards-v3">
      <PageHeading title="Rewards">
        <a href="#/walk" className="button secondary">
          <Icon name="Footprints" size={18} />
          Take a walk
        </a>
      </PageHeading>
      <div className="rewards-v3-overview">
        <p>Eggs hatch with time. Walking helps. Packs open immediately.</p>
        <div>
          <span>
            <strong>{ready}</strong> ready to hatch
          </span>
          <span>
            <strong>{packs.length}</strong> unopened packs
          </span>
          <span>
            <strong>{state.walkKm.toFixed(1)}</strong> km walked
          </span>
        </div>
      </div>
      <div className="rewards-toolbar">
        <div className="tab-bar" role="tablist" aria-label="Reward collection">
          <button
            role="tab"
            aria-selected={tab === 'eggs'}
            className={tab === 'eggs' ? 'active' : ''}
            onClick={() => setTab('eggs')}
          >
            <Icon name="Egg" size={20} />
            Eggs <span>{eggs.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === 'packs'}
            className={tab === 'packs' ? 'active' : ''}
            onClick={() => setTab('packs')}
          >
            <Icon name="Package" size={19} />
            Packs <span>{packs.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === 'history'}
            className={tab === 'history' ? 'active' : ''}
            onClick={() => setTab('history')}
          >
            <Icon name="Clock" size={18} />
            Opened
          </button>
        </div>
      </div>
      {tab !== 'history' ? (
        current.length ? (
          <div className="reward-v3-grid">
            {current.map((r) => {
              const isReady = r.readyAt <= now,
                remaining = Math.max(0, r.readyAt - now),
                distance = walkingDistance(eggWalkingMeters(r.readyAt, now));
              return (
                <article
                  key={r.id}
                  className={
                    'reward-v3-card ' + r.tier.toLowerCase() + (isReady ? ' is-ready' : '')
                  }
                >
                  <header>
                    <TierBadge tier={r.tier} />
                    <span className={'reward-v3-status ' + (isReady ? 'ready' : '')}>
                      {isReady
                        ? r.kind === 'egg'
                          ? 'Ready to hatch'
                          : 'Ready to open'
                        : 'Incubating'}
                    </span>
                  </header>
                  <button
                    className={'reward-v3-art ' + r.kind}
                    onClick={() => open(r)}
                    aria-label={
                      (isReady ? (r.kind === 'egg' ? 'Hatch ' : 'Open ') : 'View ') +
                      r.tier +
                      ' ' +
                      r.kind
                    }
                  >
                    {r.kind === 'egg' ? <EggArt tier={r.tier} /> : <PackArt tier={r.tier} />}
                  </button>
                  <div className="reward-v3-info">
                    <h2>
                      {r.tier} {r.kind}
                    </h2>
                    <div className="reward-origin">
                      From{' '}
                      {r.gift ? (
                        <span>
                          Kanto · <span className="gift-badge">Gift</span>
                        </span>
                      ) : (
                        <SourceCoin id={r.originCoin} />
                      )}
                    </div>
                    {r.kind === 'egg' ? (
                      <div className="reward-v3-timer">
                        <div>
                          <span>
                            <Icon name="Clock" size={16} />
                            {isReady ? 'Your Pokémon is ready' : 'Time remaining'}
                          </span>
                          <strong>{isReady ? 'Let’s hatch!' : duration(remaining)}</strong>
                        </div>
                        <Progress value={progressOf(r, now)} />
                        {!isReady && (
                          <p>
                            <Icon name="Footprints" size={16} />
                            Walk {distance} to finish sooner
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="reward-v3-pack-copy">
                        {r.gift
                          ? 'A mystery gift Pokémon from Kanto. Cannot be sold.'
                          : 'A surprise Pokémon from the funded reward pool.'}
                        <br />
                        Legendaries can appear in packs, too.
                      </p>
                    )}
                    <button
                      className={'reward-v3-open ' + (r.kind === 'pack' ? 'pack-button' : '')}
                      onClick={() => open(r)}
                    >
                      <Pokeball size={22} />
                      <span>
                        {r.kind === 'pack' ? 'Open pack' : isReady ? 'Hatch egg' : 'View egg'}
                      </span>
                      <Icon name="ArrowRight" size={17} />
                    </button>
                    <button className="reward-v3-pool-link" onClick={() => showDetail(r)}>
                      Possible Pokémon & odds <Icon name="ChevronRight" size={14} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={tab === 'eggs' ? 'Egg' : 'Package'}
            title={tab === 'eggs' ? 'No eggs waiting' : 'No unopened packs'}
            description="Hold active community coins to become eligible for rewards."
          >
            <a href="#/discover" className="button primary">
              Explore coins <Icon name="ArrowRight" />
            </a>
          </EmptyState>
        )
      ) : (
        <div className="reward-v3-history panel">
          {state.rewards.some((r) => r.openedAt) ? (
            state.rewards
              .filter((r) => r.openedAt)
              .sort((a, b) => b.openedAt! - a.openedAt!)
              .map((r) => (
                <a
                  className="opened-reward-row"
                  href={
                    r.pokemonInstanceId || mode === 'demo'
                      ? '#/pokemon/' + (r.pokemonInstanceId || 'hatched-' + r.id)
                      : '#/pokedex'
                  }
                  key={r.id}
                >
                  <PokemonArt id={r.outcomeSpeciesId || 1} shiny={r.shiny} animated={false} />
                  <span>
                    <strong>{pokemonById(r.outcomeSpeciesId || 1).name}</strong>
                    <small>{r.tier + ' ' + r.kind + ' · ' + relativeTime(r.openedAt!)}</small>
                  </span>
                  {r.gift ? (
                    <span className="gift-badge">Gift · unsellable</span>
                  ) : (
                    <>
                      <SourceCoin id={r.originCoin} />
                      <SolValue amount={r.backing} />
                    </>
                  )}
                  <Icon name="ChevronRight" />
                </a>
              ))
          ) : (
            <EmptyState
              title="Your discoveries will appear here"
              description="Open a pack or hatch a ready egg to meet your next Pokémon."
            />
          )}
        </div>
      )}
      <div className="reward-v3-buddy">
        <div className="reward-v3-buddy-art">
          <PokemonArt id={equipped?.speciesId || 4} shiny={equipped?.shiny} />
        </div>
        <div>
          <h3>Walk with {pokemonById(equipped?.speciesId || 4).name}</h3>
          <p>Every kilometre takes two hours off your incubating eggs.</p>
        </div>
        <a href="#/walk" className="button secondary">
          <Icon name="Footprints" />
          Go walking <Icon name="ArrowRight" size={16} />
        </a>
      </div>
      {selected && (
        <Modal title={selected.tier + ' ' + selected.kind} onClose={() => setDetail(null)} wide>
          <div className="reward-v3-detail">
            <div className={'reward-v3-detail-art ' + selected.tier.toLowerCase()}>
              <TierBadge tier={selected.tier} />
              <div>
                {selected.kind === 'egg' ? (
                  <EggArt tier={selected.tier} />
                ) : (
                  <PackArt tier={selected.tier} />
                )}
              </div>
              <p>
                From{' '}
                {selected.gift ? (
                  'Kanto · gift Pokémon cannot be sold'
                ) : (
                  <SourceCoin id={selected.originCoin} />
                )}
              </p>
              {selected.kind === 'egg' && (
                <div className="reward-v3-detail-timer">
                  <strong>
                    {selected.readyAt <= now
                      ? 'Ready to hatch'
                      : duration(selected.readyAt - now) + ' remaining'}
                  </strong>
                  <Progress value={progressOf(selected, now)} />
                  {selected.readyAt > now && (
                    <span>
                      Or walk {walkingDistance(eggWalkingMeters(selected.readyAt, now))}
                      to finish sooner.
                    </span>
                  )}
                </div>
              )}
              {selected.readyAt <= now ? (
                <Button onClick={() => open(selected)} className="full-width">
                  <Pokeball size={22} />
                  {selected.kind === 'egg' ? 'Hatch egg' : 'Open pack'}
                </Button>
              ) : (
                <a
                  className="button primary full-width"
                  href="#/walk"
                  onClick={() => setDetail(null)}
                >
                  <Icon name="Footprints" />
                  Go walking
                </a>
              )}
            </div>
            <RewardProbabilities
              key={state.profile.wallet + ':' + selected.id}
              reward={selected}
              wallet={state.profile.wallet}
              mode={mode}
              budget={mode === 'demo' ? (selected.gift ? 100 : rewardBudget(state, selected)) : 0}
            />
          </div>
        </Modal>
      )}
      {opening && (
        <RewardOpening
          reward={opening}
          audio={revealAudio}
          onClose={() => {
            revealAudio.stop();
            setOpening(null);
          }}
        />
      )}
    </div>
  );
}

export function WalkPage() {
  const { mode } = useApp();
  return mode === 'live' ? <LiveWalkPage /> : <DemoWalkPage />;
}
function DemoWalkPage() {
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
    <div className="rewards-v3">
      <PageHeading title={'Walk with ' + pokemonById(id).name} />
      <div className="walking-grid">
        <div className={'walk-v3-showcase panel ' + (walking ? 'is-walking' : '')}>
          <span className="status-tag green">
            {walking ? 'Walking preview active' : 'Your walking partner'}
          </span>
          <div className="walk-v3-partner">
            <PokemonArt id={id} shiny={equipped?.shiny} />
          </div>
          <h2>{pokemonById(id).name}</h2>
          <p>A little movement brings your next hatch closer.</p>
          <div className="walk-v3-eggs">
            {active.slice(0, 3).map((r) => (
              <div key={r.id}>
                <EggArt tier={r.tier} />
                <strong>{r.readyAt <= now ? 'Ready!' : duration(r.readyAt - now)}</strong>
              </div>
            ))}
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
              This simulates walking. It does not read GPS or verify real movement.
            </div>
          </div>
          <div className="panel walk-eggs">
            <h3>Egg timers</h3>
            {active.length ? (
              active.map((r) => (
                <div key={r.id}>
                  <EggArt tier={r.tier} />
                  <span>
                    <strong>{r.tier} egg</strong>
                    <small>{r.readyAt <= now ? 'Ready to hatch' : duration(r.readyAt - now)}</small>
                    <Progress value={progressOf(r, now)} />
                  </span>
                </div>
              ))
            ) : (
              <p>No eggs incubating right now.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
