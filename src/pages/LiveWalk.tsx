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
  if (!mobile) {
    return (
      <div className="walking-desktop-page">
        <PageHeading title="Take a walk" />
        <section className="walk-mobile-invitation" aria-labelledby="walk-phone-title">
          <div className="walk-phone-scene" aria-hidden="true">
            <div className="walk-phone-orbit" />
            <div className="walk-phone">
              <div className="walk-phone-speaker" />
              <div className="walk-phone-screen">
                <div className="walk-phone-heading">
                  <Icon name="Compass" size={18} /> KANTO WALK
                </div>
                <div className="walk-phone-partner">
                  <PokemonArt id={id} shiny={equipped?.shiny} animated={false} />
                </div>
                <svg className="walk-phone-route" viewBox="0 0 180 70" fill="none">
                  <path
                    d="M40 5v8c0 22 100 2 100 30v16"
                    stroke="#86a88c"
                    strokeWidth="3"
                    strokeDasharray="5 7"
                    strokeLinecap="round"
                  />
                  <circle cx="40" cy="5" r="5" fill="#416c53" />
                  <circle cx="140" cy="59" r="5" fill="#416c53" />
                </svg>
                <div className="walk-phone-egg">
                  <EggArt tier="Standard" />
                  <span>Hatch a little sooner</span>
                </div>
              </div>
              <div className="walk-phone-home" />
            </div>
            <div className="walk-phone-stamp">
              <Icon name="Clock" size={22} />
              <span>
                Every step
                <br />
                <strong>less waiting</strong>
              </span>
            </div>
          </div>
          <div className="walk-mobile-copy">
            <span className="walk-mobile-only">
              <svg
                width="16"
                height="20"
                viewBox="0 0 16 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <rect x="2" y="1" width="12" height="18" rx="3" />
                <path d="M6 4h4M7 16h2" />
              </svg>
              Available on your phone
            </span>
            <h2 id="walk-phone-title">
              A little walk.
              <br />A quicker hatch.
            </h2>
            <p>
              Take your partner along. Walking takes time off every incubating egg, so your next
              Pokémon arrives sooner.
            </p>
            <div className="walk-mobile-benefit">
              <Icon name="Footprints" size={24} />
              <span>
                <strong>100 m walked</strong>
                <span>{duration(rate * 100)} off each egg</span>
              </span>
              <Icon name="Egg" size={34} />
            </div>
            <div className="walk-phone-instructions">
              <h3>Pick up your phone to start</h3>
              <p>
                Open <strong>{window.location.host}</strong> on your phone and connect the same
                wallet. Visit Take a walk and enable location.
              </p>
              <p>
                Walking isn’t available on desktop. Your eggs keep counting down while you’re here.
              </p>
            </div>
            <a className="button secondary" href="#/rewards">
              View your eggs <Icon name="ArrowRight" size={17} />
            </a>
          </div>
        </section>
      </div>
    );
  }
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
          {account.status !== 'authenticated' ? (
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
                        : walk.locationHelp
                          ? 'Try location again'
                          : walk.permission !== 'granted'
                            ? 'Enable location & start'
                            : walk.hasSession
                              ? 'Resume walking'
                              : 'Start walking'}
              </Button>
              {['requesting', 'connecting'].includes(walk.phase) && (
                <Button
                  variant="ghost"
                  className="full-width"
                  onClick={() => walk.controller.pause()}
                >
                  Cancel
                </Button>
              )}
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
          {walk.locationHelp && (
            <div className="walk-location-help">
              <h3>Location help</h3>
              <p>
                Turn on your phone’s Location Services and allow precise location for your browser.
              </p>
              <p>
                If Phantom never asks for location, open Kanto in your phone’s default browser
                (usually Safari on iPhone), connect Phantom there, then start walking. Phantom will
                open just for approval and return you to your browser.
              </p>
              <p>Your eggs will still hatch with time.</p>
            </div>
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
