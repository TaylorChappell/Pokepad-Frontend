import test from 'node:test';
import assert from 'node:assert/strict';
import {
  requestWalkingLocation,
  LOCATION_DEADLINE_MS,
  WalkingLocationError,
} from '../src/services/walking-location';

const position = {
  timestamp: 100000,
  coords: { latitude: 51, longitude: 0, accuracy: 3 },
} as GeolocationPosition;
function gps() {
  let first: PositionCallback | undefined,
    failure: PositionErrorCallback | undefined,
    watched: PositionCallback | undefined;
  let firstOptions: PositionOptions | undefined, watchOptions: PositionOptions | undefined;
  let watchCalls = 0,
    cleared = 0;
  const geo = {
    getCurrentPosition(
      success: PositionCallback,
      error: PositionErrorCallback,
      options: PositionOptions,
    ) {
      first = success;
      failure = error;
      firstOptions = options;
    },
    watchPosition(
      success: PositionCallback,
      _error: PositionErrorCallback,
      options: PositionOptions,
    ) {
      watched = success;
      watchOptions = options;
      return ++watchCalls;
    },
    clearWatch() {
      cleared++;
    },
  } as Geolocation;
  return {
    geo,
    fix() {
      first?.(position);
    },
    watchedFix() {
      watched?.(position);
    },
    deny() {
      failure?.({ code: 1 } as GeolocationPositionError);
    },
    unavailable() {
      failure?.({ code: 2 } as GeolocationPositionError);
    },
    get watchCalls() {
      return watchCalls;
    },
    get cleared() {
      return cleared;
    },
    get firstOptions() {
      return firstOptions;
    },
    get watchOptions() {
      return watchOptions;
    },
  };
}
test('an embedded browser that never calls back cannot leave location loading indefinitely', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = gps(),
    request = requestWalkingLocation(f.geo);
  const rejected = assert.rejects(
    request.promise,
    (e: WalkingLocationError) => e.reason === 'no-response' && e.code === 3,
  );
  t.mock.timers.tick(4999);
  assert.equal(f.watchCalls, 0);
  t.mock.timers.tick(1);
  assert.equal(f.watchCalls, 1);
  assert.equal(f.watchOptions?.enableHighAccuracy, true);
  t.mock.timers.tick(LOCATION_DEADLINE_MS - 5000);
  await rejected;
  assert.equal(f.cleared, 1);
  f.fix();
  f.watchedFix();
  t.mock.timers.tick(30000);
  assert.equal(f.watchCalls, 1);
});
test('fresh initial fixes avoid waiting for high accuracy, and a watch can recover a silent one-shot request', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = gps(),
    request = requestWalkingLocation(f.geo);
  assert.equal(f.firstOptions?.enableHighAccuracy, false);
  assert.equal(f.firstOptions?.maximumAge, 5000);
  t.mock.timers.tick(5000);
  f.watchedFix();
  assert.equal(await request.promise, position);
  assert.equal(f.cleared, 1);
  f.deny();
  t.mock.timers.tick(20000);
  assert.equal(f.cleared, 1, 'a late one-shot callback cannot change the settled result');
  const fast = gps(),
    next = requestWalkingLocation(fast.geo);
  fast.fix();
  await next.promise;
  t.mock.timers.tick(20000);
  assert.equal(fast.watchCalls, 0);
});
test('denial never invokes a fallback, and cancellation clears timers and ignores late locations', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = gps(),
    request = requestWalkingLocation(f.geo);
  const denied = assert.rejects(
    request.promise,
    (e: WalkingLocationError) => e.reason === 'denied',
  );
  f.deny();
  await denied;
  t.mock.timers.tick(30000);
  assert.equal(f.watchCalls, 0);
  const again = gps(),
    next = requestWalkingLocation(again.geo);
  t.mock.timers.tick(5000);
  const cancelled = assert.rejects(
    next.promise,
    (e: WalkingLocationError) => e.reason === 'cancelled',
  );
  next.cancel();
  await cancelled;
  again.fix();
  again.watchedFix();
  t.mock.timers.tick(30000);
  assert.equal(again.cleared, 1);
});
test('permission observations are optional, bounded, and cleaned up after a change', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = gps();
  const status = Object.assign(new EventTarget(), { state: 'prompt' as PermissionState });
  const seen: PermissionState[] = [];
  const permissions = { query: async () => status as PermissionStatus };
  const request = requestWalkingLocation(f.geo, {
    permissions,
    onPermission: (state) => seen.push(state),
  });
  await Promise.resolve();
  assert.deepEqual(seen, ['prompt']);
  status.state = 'granted';
  status.dispatchEvent(new Event('change'));
  assert.deepEqual(seen, ['prompt', 'granted']);
  f.fix();
  await request.promise;
  status.state = 'denied';
  status.dispatchEvent(new Event('change'));
  assert.equal(seen.length, 2);
  const silent = gps();
  const never = requestWalkingLocation(silent.geo, {
    permissions: { query: () => new Promise(() => {}) },
  });
  const rejected = assert.rejects(
    never.promise,
    (e: WalkingLocationError) => e.reason === 'no-response',
  );
  t.mock.timers.tick(LOCATION_DEADLINE_MS);
  await rejected;
});
