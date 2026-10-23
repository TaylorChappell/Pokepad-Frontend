import { apiRequest } from './http';
import { postWalkingSample, type SampleResult, type WalkSession } from './walking';

export type WalkingCapabilities = {
  enabled: boolean;
  mobileOnly: boolean;
  minSampleIntervalMs: number;
  maxDailyMeters: number;
  maxAccuracyMeters: number;
  boostMsPerMeter: number;
  maxEggAccelerationFraction: number;
};
export type WalkingPhase =
  | 'idle'
  | 'requesting'
  | 'connecting'
  | 'walking'
  | 'paused'
  | 'background'
  | 'error'
  | 'finishing';
export type WalkingState = {
  phase: WalkingPhase;
  message: string;
  permission: 'prompt' | 'granted' | 'denied' | 'unavailable';
  meters: number;
  dailyMeters: number;
  timeSavedMs: number;
  hasSession: boolean;
  capabilities: WalkingCapabilities | null;
  eggUpdates: Record<string, { readyAt: number; walkingBoostMs: number }>;
};
interface Dependencies {
  geo: Geolocation | undefined;
  mobile: boolean;
  screen: { width: number; height: number };
  hidden: () => boolean;
  request?: typeof apiRequest;
  now?: () => number;
  onProgress?: (result: SampleResult) => void;
}
const initial = (): WalkingState => ({
  phase: 'idle',
  message: '',
  permission: 'prompt',
  meters: 0,
  dailyMeters: 0,
  timeSavedMs: 0,
  hasSession: false,
  capabilities: null,
  eggUpdates: {},
});
const gpsOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 };
const sampleMessages: Record<string, string> = {
  first_location: 'Location found. Start walking to shorten your egg timers.',
  low_accuracy: 'Finding a clearer GPS signal. Try moving into an open area.',
  stale_location: 'Waiting for a fresh location from your phone.',
  too_frequent: 'Walking is active. Waiting for your next location.',
  non_monotonic_time: 'Waiting for a fresh location from your phone.',
  location_gap: 'Location found again. Your next steps will count.',
  location_jump: 'GPS moved unexpectedly. Waiting for a steady location.',
  too_fast: 'Move at walking pace for your distance to count.',
  not_enough_movement: 'Location found. Keep walking to shorten your egg timers.',
  daily_limit: 'You’ve reached today’s walking boost. Egg timers keep counting down.',
};

/** Lives above page routes. Only verified server samples can change distance or egg timers. */
export function createWalkingController(deps: Dependencies) {
  const request = deps.request || apiRequest,
    now = deps.now || Date.now;
  let state = initial(),
    owner: string | null = null,
    session: WalkSession | null = null;
  let wanted = false,
    version = 0,
    watcher: number | null = null,
    lastPosted = 0;
  let pendingSample: Promise<void> | null = null;
  let finishTask: Promise<void> | null = null;
  let disposed = false;
  const listeners = new Set<() => void>();
  function update(patch: Partial<WalkingState>) {
    if (disposed) return;
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  }
  function clearWatch() {
    if (watcher !== null) deps.geo?.clearWatch(watcher);
    watcher = null;
  }
  function current(run: number) {
    return !disposed && run === version && !!owner;
  }
  function locationError(error: { code?: number }) {
    if (error.code === 1)
      return 'Location is blocked. Enable location for Phantom (or your browser) in your phone’s settings, allow Kanto access, then try again.';
    if (error.code === 3)
      return 'GPS is taking longer than expected. Move into an open area and try again.';
    return 'Your phone could not find its location. Turn on Location Services and try again.';
  }
  async function loadCapabilities() {
    try {
      const caps = await request<WalkingCapabilities>('/v1/walking/capabilities');
      update({
        capabilities: caps,
        message: caps.enabled
          ? ''
          : 'Walking is temporarily unavailable. Your eggs still hatch with time.',
      });
    } catch {
      update({ message: 'Couldn’t check walking availability. Try again in a moment.' });
    }
  }
  function fail(run: number, message: string, permission?: WalkingState['permission']) {
    if (!current(run)) return;
    clearWatch();
    wanted = false;
    version++;
    update({ phase: 'error', message, ...(permission ? { permission } : {}) });
  }
  function sendPosition(
    position: GeolocationPosition,
    run: number,
    reanchor = false,
  ): Promise<void> {
    if (!current(run) || !wanted || deps.hidden() || !session || pendingSample)
      return Promise.resolve();
    if (
      !reanchor &&
      now() - lastPosted < Math.max(6000, state.capabilities?.minSampleIntervalMs || 0)
    )
      return Promise.resolve();
    if (position.coords.accuracy > (state.capabilities?.maxAccuracyMeters || 35)) {
      update({ message: sampleMessages.low_accuracy });
      return Promise.resolve();
    }
    const activeSession = session,
      wallet = owner;
    lastPosted = now();
    const task = (async () => {
      try {
        const result = await postWalkingSample(activeSession, position, request, reanchor);
        // A sample sent while visible may settle after backgrounding. Keep its accepted progress.
        if (disposed || owner !== wallet || session !== activeSession) return;
        const eggUpdates = { ...state.eggUpdates };
        for (const egg of result.eggUpdates || []) eggUpdates[egg.id] = egg;
        update({
          meters: result.sessionMeters,
          dailyMeters: result.dailyMeters,
          timeSavedMs: state.timeSavedMs + (result.timeSavedMs || 0),
          eggUpdates,
          ...(current(run) && wanted && !deps.hidden()
            ? {
                message: result.accepted
                  ? 'Your steps are shortening your egg timers.'
                  : sampleMessages[result.reason || ''] ||
                    'Walking is active. Keep moving at a comfortable pace.',
              }
            : {}),
        });
        if (result.creditedMeters > 0) deps.onProgress?.(result);
      } catch {
        fail(
          run,
          'Walking paused because the connection was interrupted. Tap Resume walking to continue. Your saved progress is safe.',
        );
      }
    })();
    pendingSample = task;
    void task.finally(() => {
      if (pendingSample === task) pendingSample = null;
    });
    return task;
  }
  async function start() {
    if (disposed || !owner || !deps.mobile || !state.capabilities?.enabled || finishTask) return;
    if (['requesting', 'connecting', 'walking'].includes(state.phase)) return;
    if (!deps.geo) {
      update({
        phase: 'error',
        permission: 'unavailable',
        message:
          'Location access is not available in this browser. Open Kanto in a phone browser with location access.',
      });
      return;
    }
    wanted = true;
    if (deps.hidden()) {
      update({ phase: 'background' });
      return;
    }
    clearWatch();
    const run = ++version;
    update({
      phase: 'requesting',
      message: 'Allow location access on your phone. Finding your position…',
    });
    // Request from the button gesture, before any network await, so mobile can show permission UI.
    const firstPosition = new Promise<GeolocationPosition>((resolve, reject) => {
      deps.geo!.getCurrentPosition(resolve, reject, gpsOptions);
    });
    let position: GeolocationPosition;
    try {
      position = await firstPosition;
    } catch (error) {
      fail(
        run,
        locationError(error as GeolocationPositionError),
        (error as GeolocationPositionError).code === 1 ? 'denied' : undefined,
      );
      return;
    }
    if (!current(run) || !wanted || deps.hidden()) return;
    update({
      permission: 'granted',
      phase: 'connecting',
      message: 'Location found. Starting your walk…',
    });
    try {
      // Never let foreground restoration race the previous, possibly still settling sample.
      if (pendingSample) await pendingSample;
      if (!current(run) || !wanted || deps.hidden()) return;
      const opened = await request<WalkSession>('/v1/walking/start', {
        method: 'POST',
        json: {
          requestId: crypto.randomUUID(),
          device: {
            mobile: true,
            geolocation: true,
            screenWidth: deps.screen.width,
            screenHeight: deps.screen.height,
          },
        },
      });
      if (!current(run) || !wanted || deps.hidden()) return;
      session = opened;
      update({ hasSession: true, meters: opened.acceptedMeters });
      let needsAnchor = true;
      // The server discards displacement since the last foreground session, including short absences.
      if (
        position.coords.accuracy <= state.capabilities!.maxAccuracyMeters &&
        now() - position.timestamp < 15000
      ) {
        await sendPosition(position, run, true);
        needsAnchor = false;
      }
      if (!current(run) || !wanted || deps.hidden()) return;
      update({ phase: 'walking' });
      watcher = deps.geo.watchPosition(
        (next) => {
          if (!current(run) || !wanted || deps.hidden() || pendingSample) return;
          if (now() >= new Date(opened.expiresAt).getTime()) {
            clearWatch();
            update({ phase: 'background' });
            void start();
            return;
          }
          const anchor = needsAnchor;
          if (next.coords.accuracy <= state.capabilities!.maxAccuracyMeters) needsAnchor = false;
          void sendPosition(next, run, anchor);
        },
        (error) => {
          // watchPosition can recover after a timeout or temporarily unavailable fix.
          if (!current(run)) return;
          if (error.code === 1) fail(run, locationError(error), 'denied');
          else update({ message: locationError(error) });
        },
        gpsOptions,
      );
    } catch {
      fail(run, 'Couldn’t start your walk. Check your connection and try again.');
    }
  }
  function pause() {
    wanted = false;
    version++;
    clearWatch();
    update({
      phase: session ? 'paused' : 'idle',
      message: 'Walking paused. Your egg timers keep counting down.',
    });
  }
  function visibilityChanged() {
    if (!wanted || finishTask) return;
    if (deps.hidden()) {
      version++;
      clearWatch();
      update({ phase: 'background', message: 'Walking will resume when you return to Kanto.' });
    } else if (state.phase === 'background') void start();
  }
  async function finish() {
    if (finishTask) return finishTask;
    wanted = false;
    version++;
    clearWatch();
    if (!session) {
      update({ phase: 'idle', message: '' });
      return;
    }
    const activeSession = session,
      wallet = owner;
    update({ phase: 'finishing', message: 'Saving your walk…' });
    const task = (async () => {
      try {
        if (pendingSample) await pendingSample;
        if (owner !== wallet || session !== activeSession) return;
        await request(`/v1/walking/${encodeURIComponent(activeSession.sessionId)}/finish`, {
          method: 'POST',
          json: { challenge: activeSession.challenge },
        });
        if (owner !== wallet || session !== activeSession) return;
        session = null;
        update({
          phase: 'idle',
          hasSession: false,
          message: 'Walk finished. Your egg timers include all your saved progress.',
        });
      } catch {
        if (owner === wallet)
          update({
            phase: 'error',
            message: 'Couldn’t finish your walk. Check your connection and try again.',
          });
      }
    })();
    finishTask = task;
    try {
      await task;
    } finally {
      if (finishTask === task) finishTask = null;
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    loadCapabilities,
    start,
    pause,
    finish,
    visibilityChanged,
    setOwner(wallet: string | null) {
      if (owner === wallet) return;
      owner = wallet;
      wanted = false;
      version++;
      clearWatch();
      session = null;
      update({ ...initial(), capabilities: state.capabilities });
    },
    dispose() {
      disposed = true;
      wanted = false;
      version++;
      clearWatch();
      listeners.clear();
    },
  };
}

export function eggWalkingMeters(readyAt: number, now: number, boostMsPerMeter = 7200) {
  return Math.ceil(Math.max(0, readyAt - now) / Math.max(1, boostMsPerMeter));
}
export function walkingDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.ceil(meters)} m`;
}
