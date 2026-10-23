import { useApp } from '../state/AppContext';
import { useWalking } from '../state/WalkingContext';
import {
  Button,
  EggArt,
  Icon,
  PageHeading,
  PokemonArt,
  Progress,
  CoinAvatar,
} from '../components/UI';
import { WalletConnection } from '../components/WalletConnection';
import { pokemonById } from '../data/pokemon';
import { duration } from '../utils';
import { isMobileWalkingDevice } from '../services/walking';
import { eggWalkingMeters, walkingDistance } from '../services/walking-controller';

export function LiveWalkPage() {
  const { state, session: account, now } = useApp();
  const walk = useWalking();
  const mobile = isMobileWalkingDevice(navigator);
  const equipped = state.pokemon.find((p) => p.id === state.profile.equippedId);
  const id = equipped?.speciesId || 4;
  const eggs = state.rewards.filter((reward) => reward.kind === 'egg' && !reward.openedAt);
  const active = walk.phase === 'walking';
  const busy = ['requesting', 'connecting', 'finishing'].includes(walk.phase);
  const rate = walk.capabilities?.boostMsPerMeter || 7200;
  const status = active
    ? 'Walking active'
    : walk.phase === 'requesting'
      ? 'Finding your location'
      : walk.phase === 'connecting'
        ? 'Starting your walk'
        : walk.phase === 'background'
          ? 'Paused in background'
          : walk.phase === 'paused'
            ? 'Walking paused'
            : 'Your walking partner';
  return (
    <div className="rewards-v3 walking-page">
      <PageHeading title={'Walk with ' + pokemonById(id).name} />
      <div className="walking-layout">
        <div className="walking-main">
          <div className={'walk-companion panel ' + (active ? 'is-walking' : '')}>
            <div className="walk-companion-art">
              <PokemonArt id={id} shiny={equipped?.shiny} />
            </div>
            <div>
              <span className={'walk-status-label ' + (active ? 'is-active' : '')}>
                <Icon name="Footprints" size={16} />
                {status}
              </span>
              <h2>Every step brings a hatch closer.</h2>
              <p>Walking takes time off all your incubating eggs. Their timers keep ticking too.</p>
              <span className="walk-rate">100 m walked = {duration(rate * 100)} off each egg</span>
            </div>
          </div>
          <section className="walk-incubator" aria-label="Your egg timers">
            <div className="walk-section-heading">
              <h2>Your eggs</h2>
              <a href="#/rewards">
                Rewards <Icon name="ArrowRight" size={16} />
              </a>
            </div>
            <div className="walk-egg-grid">
              {eggs.map((egg) => {
                const update = walk.eggUpdates[egg.id];
                const readyAt = Math.min(egg.readyAt, update?.readyAt ?? egg.readyAt);
                const remaining = Math.max(0, readyAt - now);
                const saved = Math.max(egg.walkingBoostMs || 0, update?.walkingBoostMs || 0);
                const coin = state.coins.find((c) => c.id === egg.originCoin);
                const ready = remaining === 0;
                return (
                  <article
                    className={
                      'walk-egg-card panel ' + egg.tier.toLowerCase() + (ready ? ' is-ready' : '')
                    }
                    key={egg.id}
                  >
                    <div className="walk-egg-top">
                      <EggArt tier={egg.tier} />
                      <div>
                        <span className="walk-egg-tier">{egg.tier} egg</span>
                        <span className="walk-egg-source">
                          {coin && <CoinAvatar coin={coin} size={18} />}
                          {egg.gift ? 'Kanto gift' : coin ? 'From $' + coin.ticker : 'Your reward'}
                        </span>
                      </div>
                    </div>
                    <div className="walk-egg-time">
                      <Icon name="Clock" size={18} />
                      <strong>{ready ? 'Ready to hatch!' : duration(remaining)}</strong>
                      {!ready && <span>remaining</span>}
                    </div>
                    <Progress value={100 * (1 - remaining / Math.max(1, egg.initialDuration))} />
                    {ready ? (
                      <a className="button primary full-width" href="#/rewards">
                        Hatch egg <Icon name="ArrowRight" size={16} />
                      </a>
                    ) : (
                      <div className="walk-egg-distance">
                        <Icon name="Footprints" size={20} />
                        <div>
                          <strong>{walkingDistance(eggWalkingMeters(readyAt, now, rate))}</strong>
                          <span>more walking to hatch now</span>
                        </div>
                      </div>
                    )}
                    {saved > 0 && (
                      <small className="walk-egg-saved">
                        {duration(saved)} already shaved off by walking
                      </small>
                    )}
                  </article>
                );
              })}
            </div>
            {!eggs.length && (
              <div className="panel walk-empty">
                <EggArt tier="Standard" />
                <h3>No eggs incubating</h3>
                <p>Your next egg will appear here with its timer and walking distance.</p>
                <a href="#/rewards" className="button secondary">
                  View rewards
                </a>
              </div>
            )}
          </section>
        </div>
        <aside className="panel walk-controls">
          <h2>Your walk</h2>
          <div className="walk-distance-total">
            <strong>{walkingDistance(walk.meters)}</strong>
            <span>walked this session</span>
          </div>
          <div className="walk-saved-total">
            <Icon name="Clock" size={18} />
            <span>
              <strong>{walk.timeSavedMs > 0 ? duration(walk.timeSavedMs) : '0m'}</strong> saved
              across your eggs
            </span>
          </div>
          {!mobile ? (
            <div className="walk-feedback">
              <Icon name="Info" />
              <span>Open Kanto on your phone to start walking.</span>
            </div>
          ) : account.status !== 'authenticated' ? (
            <WalletConnection />
          ) : (
            <>
              <Button
                className="full-width"
                disabled={busy || !walk.capabilities?.enabled}
                onClick={() => (active ? walk.controller.pause() : void walk.controller.start())}
              >
                <Icon
                  name={active ? 'Pause' : walk.permission !== 'granted' ? 'Compass' : 'Play'}
                  size={18}
                />
                {walk.phase === 'requesting'
                  ? 'Finding location…'
                  : walk.phase === 'connecting'
                    ? 'Starting…'
                    : walk.phase === 'finishing'
                      ? 'Finishing…'
                      : active
                        ? 'Pause walking'
                        : walk.permission !== 'granted'
                          ? 'Enable location & start'
                          : walk.hasSession
                            ? 'Resume walking'
                            : 'Start walking'}
              </Button>
              {walk.hasSession && (
                <Button
                  variant="ghost"
                  className="full-width"
                  disabled={busy}
                  onClick={() => void walk.controller.finish()}
                >
                  End walk
                </Button>
              )}
              {!walk.capabilities && (
                <Button variant="ghost" onClick={() => void walk.controller.loadCapabilities()}>
                  Check availability
                </Button>
              )}
            </>
          )}
          {walk.message && (
            <p
              className={'walk-feedback ' + (walk.phase === 'error' ? 'has-error' : '')}
              role="status"
            >
              <Icon name={walk.phase === 'error' ? 'Info' : 'Compass'} size={18} />
              <span>{walk.message}</span>
            </p>
          )}
          <p className="walk-explainer">
            Explore any Kanto page while you walk. Leave the app or lock your phone to pause; return
            to resume automatically.
          </p>
          {walk.dailyMeters >= (walk.capabilities?.maxDailyMeters || Infinity) && (
            <p className="walk-feedback">
              Today’s walking boost is complete. Your eggs still hatch with time.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
