import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';
import { apiRequest } from '../services/http';
import { Button, EggArt, Icon, PageHeading, PokemonArt, Progress } from '../components/UI';
import { WalletConnection } from '../components/WalletConnection';
import { pokemonById } from '../data/pokemon';
import { duration } from '../utils';
import type { Reward } from '../types';
import { isMobileWalkingDevice, postWalkingSample, type WalkSession } from '../services/walking';
const progressOf = (reward: Reward, now: number) =>
  Math.max(
    0,
    Math.min(
      100,
      100 * (1 - Math.max(0, reward.readyAt - now) / Math.max(1, reward.initialDuration)),
    ),
  );

type Capabilities = {
  enabled: boolean;
  mobileOnly: true;
  minSampleIntervalMs: number;
  maxDailyMeters: number;
  maxAccuracyMeters: number;
};
export function LiveWalkPage() {
  const { state, session: account, now, reload } = useApp();
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [walking, setWalking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mustFinish, setMustFinish] = useState(false);
  const [meters, setMeters] = useState(0);
  const [message, setMessage] = useState('');
  const walk = useRef<WalkSession | null>(null);
  const startRequestId = useRef(crypto.randomUUID());
  const watcher = useRef<number | null>(null);
  const inFlight = useRef(false);
  const lastPosted = useRef(0);
  const mounted = useRef(true);
  const mobile = isMobileWalkingDevice(navigator);
  const equipped = state.pokemon.find((p) => p.id === state.profile.equippedId);
  const id = equipped?.speciesId || 4;
  const eggs = state.rewards.filter((reward) => reward.kind === 'egg' && !reward.openedAt);
  function clearWatch() {
    if (watcher.current !== null) navigator.geolocation?.clearWatch(watcher.current);
    watcher.current = null;
  }
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void apiRequest<Capabilities>('/v1/walking/capabilities', { signal: controller.signal })
      .then(setCapabilities)
      .catch((e) => {
        if (!controller.signal.aborted) setMessage(e.message);
      });
    const visibility = () => {
      if (document.hidden) {
        clearWatch();
        setWalking(false);
        setMessage('Walking paused. Keep Kanto visible on your phone while walking.');
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      mounted.current = false;
      controller.abort();
      clearWatch();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  async function start() {
    if (
      !mobile ||
      !navigator.geolocation ||
      !capabilities?.enabled ||
      busy ||
      mustFinish ||
      account.status !== 'authenticated'
    )
      return;
    setBusy(true);
    setMessage('');
    try {
      if (!walk.current)
        walk.current = await apiRequest<WalkSession>('/v1/walking/start', {
          method: 'POST',
          json: {
            device: {
              mobile: true,
              screenWidth: window.screen.width,
              screenHeight: window.screen.height,
              geolocation: true,
            },
            requestId: startRequestId.current,
          },
        });
      if (!mounted.current) return;
      setWalking(true);
      watcher.current = navigator.geolocation.watchPosition(
        (position) => {
          if (
            document.hidden ||
            inFlight.current ||
            !walk.current ||
            Date.now() - lastPosted.current < Math.max(6000, capabilities.minSampleIntervalMs)
          )
            return;
          if (position.coords.accuracy > capabilities.maxAccuracyMeters) {
            setMessage('GPS is still settling. Move to an open area for a more accurate location.');
            return;
          }
          const current = walk.current;
          inFlight.current = true;
          lastPosted.current = Date.now();
          void postWalkingSample(current, position)
            .then((result) => {
              if (!mounted.current) return;
              setMeters(result.sessionMeters);
              setMessage(
                result.accepted
                  ? 'Location received. Progress is checked by the server.'
                  : result.reason || 'This sample did not add distance. Keep walking naturally.',
              );
              if (result.creditedMeters > 0) void reload();
            })
            .catch((e) => {
              clearWatch();
              if (mounted.current) {
                setWalking(false);
                setMustFinish(true);
                setMessage(e.message + ' End this session before starting another.');
              }
            })
            .finally(() => {
              inFlight.current = false;
            });
        },
        (error) => {
          clearWatch();
          setWalking(false);
          setMessage(
            error.code === 1
              ? 'Location permission was denied. Enable location for Kanto, then try again.'
              : 'Your location is unavailable. Check GPS and try again.',
          );
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to start walking.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function finish() {
    if (inFlight.current) {
      setMessage('Finishing the last location check. Try again in a moment.');
      return;
    }
    clearWatch();
    setWalking(false);
    if (!walk.current) return;
    setBusy(true);
    try {
      const result = await apiRequest<{ sessionMeters: number }>(
        `/v1/walking/${encodeURIComponent(walk.current.sessionId)}/finish`,
        { method: 'POST', json: { challenge: walk.current.challenge } },
      );
      walk.current = null;
      startRequestId.current = crypto.randomUUID();
      setMustFinish(false);
      setMeters(result.sessionMeters);
      setMessage('Session finished. Your accepted distance has been saved.');
      await reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not finish the session. Try again.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="rewards-v3">
      <PageHeading title={'Walk with ' + pokemonById(id).name} />
      <div className="walking-grid">
        <div className={'walk-v3-showcase panel ' + (walking ? 'is-walking' : '')}>
          <span className="status-tag green">
            {walking ? 'Walking session active' : 'Your walking partner'}
          </span>
          <div className="walk-v3-partner">
            <PokemonArt id={id} shiny={equipped?.shiny} />
          </div>
          <h2>{pokemonById(id).name}</h2>
          <p>Walk on your phone to speed up your incubating eggs.</p>
          <div className="walk-v3-eggs">
            {eggs.slice(0, 3).map((egg) => (
              <div key={egg.id}>
                <EggArt tier={egg.tier} />
                <strong>{egg.readyAt <= now ? 'Ready!' : duration(egg.readyAt - now)}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="walking-sidebar">
          <div className="panel walk-session">
            <h3>Your walking session</h3>
            <div className="session-number">
              {(meters / 1000).toFixed(2)}
              <span>km accepted</span>
            </div>
            {!mobile ? (
              <div className="notice">
                <Icon name="Info" />
                Open this page on your phone to walk. Desktop devices cannot start walking sessions.
              </div>
            ) : account.status !== 'authenticated' ? (
              <WalletConnection />
            ) : (
              <>
                <Button
                  className="full-width"
                  disabled={
                    busy ||
                    mustFinish ||
                    inFlight.current ||
                    !capabilities?.enabled ||
                    !navigator.geolocation
                  }
                  onClick={() => (walking ? (clearWatch(), setWalking(false)) : void start())}
                >
                  <Icon name={walking ? 'Pause' : 'Play'} />
                  {busy
                    ? 'Please wait…'
                    : walking
                      ? 'Pause walking'
                      : walk.current
                        ? 'Resume walking'
                        : 'Start walking'}
                </Button>
                {walk.current && (
                  <Button
                    variant="ghost"
                    disabled={busy || inFlight.current}
                    onClick={() => void finish()}
                  >
                    End session
                  </Button>
                )}
              </>
            )}
            {capabilities && !capabilities.enabled && (
              <p>Walking is not currently available. Your eggs still hatch with time.</p>
            )}
            {message && (
              <p className="notice small" role="status">
                {message}
              </p>
            )}
            <p className="notice small">
              Keep this page open while walking. GPS progress is checked and capped by the server;
              it is not proof against all location spoofing.
            </p>
          </div>
          <div className="panel walk-eggs">
            <h3>Egg timers</h3>
            {eggs.length ? (
              eggs.map((egg) => (
                <div key={egg.id}>
                  <EggArt tier={egg.tier} />
                  <span>
                    <strong>{egg.tier} egg</strong>
                    <small>
                      {egg.readyAt <= now ? 'Ready to hatch' : duration(egg.readyAt - now)}
                    </small>
                    <Progress value={progressOf(egg, now)} />
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
