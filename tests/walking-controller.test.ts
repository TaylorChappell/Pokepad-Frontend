import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWalkingController,
  eggWalkingMeters,
  walkingDistance,
} from '../src/services/walking-controller';
import { ApiError, type apiRequest } from '../src/services/http';

function fixture({ mobile = true, deny = false, deferLocation = false } = {}) {
  let now = 100000,
    hidden = false,
    seq = 1,
    total = 0,
    nextWatch = 0;
  let resolveLocation: PositionCallback | undefined;
  let samplesFail = false;
  const log: string[] = [],
    bodies: any[] = [],
    watches = new Map<number, PositionCallback>();
  let lastWatcher: PositionCallback | undefined;
  let onProgress = 0;
  const position = (): GeolocationPosition =>
    ({
      timestamp: now,
      coords: { latitude: 51, longitude: 0, accuracy: 3 } as GeolocationCoordinates,
    }) as GeolocationPosition;
  const request = (async (path, options) => {
    log.push(path);
    const body = options?.json as any;
    if (path.endsWith('/capabilities'))
      return {
        enabled: true,
        minSampleIntervalMs: 5000,
        maxDailyMeters: 5000,
        maxAccuracyMeters: 35,
        boostMsPerMeter: 7200,
        maxEggAccelerationFraction: 1,
      };
    if (path.endsWith('/start'))
      return {
        sessionId: 'walk',
        challenge: 'challenge',
        nextSeq: seq,
        expiresAt: now + 5400000,
        acceptedMeters: total,
      };
    if (path.endsWith('/samples')) {
      bodies.push(body);
      if (samplesFail) throw new ApiError('offline', 0);
      assert.equal(body.seq, seq);
      const credited = body.resume ? 0 : 10;
      total += credited;
      seq++;
      return {
        accepted: credited > 0,
        reason: credited ? undefined : 'first_location',
        creditedMeters: credited,
        sessionMeters: total,
        dailyMeters: total,
        nextSeq: seq,
        readyEggIds: [],
        timeSavedMs: credited * 7200,
        eggUpdates: credited ? [{ id: 'egg', readyAt: now + 10000, walkingBoostMs: 72000 }] : [],
      };
    }
    return { finished: true };
  }) as typeof apiRequest;
  const geo = {
    getCurrentPosition(success: PositionCallback, error: PositionErrorCallback) {
      log.push('permission');
      if (deny) error({ code: 1 } as GeolocationPositionError);
      else if (deferLocation) resolveLocation = success;
      else success(position());
    },
    watchPosition(success: PositionCallback) {
      const id = ++nextWatch;
      lastWatcher = success;
      watches.set(id, success);
      return id;
    },
    clearWatch(id: number) {
      log.push('clear-watch');
      watches.delete(id);
    },
  } as Geolocation;
  const controller = createWalkingController({
    geo,
    mobile,
    screen: { width: 390, height: 844 },
    hidden: () => hidden,
    now: () => now,
    request,
    onProgress: () => {
      onProgress++;
    },
  });
  controller.setOwner('trainer');
  const settle = () => new Promise<void>((r) => setImmediate(r));
  return {
    controller,
    log,
    bodies,
    watches,
    settle,
    position,
    get onProgress() {
      return onProgress;
    },
    hide() {
      hidden = true;
      controller.visibilityChanged();
    },
    show() {
      hidden = false;
      controller.visibilityChanged();
    },
    advance(ms = 7000) {
      now += ms;
    },
    emit() {
      lastWatcher?.(position());
    },
    resolve() {
      resolveLocation?.(position());
    },
    failSamples() {
      samplesFail = true;
    },
    recover() {
      samplesFail = false;
    },
  };
}

test('location is requested from Start before any session API, and denied permission never starts a walk', async () => {
  for (const deny of [false, true]) {
    const f = fixture({ deny });
    await f.controller.loadCapabilities();
    f.log.length = 0;
    const starting = f.controller.start();
    assert.equal(f.log[0], 'permission');
    await starting;
    if (deny) {
      assert.equal(f.controller.getSnapshot().permission, 'denied');
      assert.equal(f.controller.getSnapshot().phase, 'error');
      assert.equal(f.log.length, 1);
      assert.match(f.controller.getSnapshot().message, /phone’s settings/);
    } else {
      assert.equal(f.controller.getSnapshot().phase, 'walking');
      assert.equal(f.bodies[0].resume, true);
      assert.equal(f.controller.getSnapshot().meters, 0);
    }
    f.controller.dispose();
  }
});
test('walking survives page subscribers changing, pauses in background and automatically reanchors on return', async () => {
  const f = fixture();
  await f.controller.loadCapabilities();
  await f.controller.start();
  const unsub = f.controller.subscribe(() => {});
  unsub();
  const off = f.controller.subscribe(() => {});
  assert.equal(f.watches.size, 1, 'changing route consumers must not stop the controller');
  f.advance();
  f.emit();
  await f.settle();
  assert.equal(f.controller.getSnapshot().meters, 10);
  assert.equal(f.onProgress, 1);
  assert.equal(f.controller.getSnapshot().timeSavedMs, 72000);
  assert.ok(f.controller.getSnapshot().eggUpdates.egg);
  f.hide();
  assert.equal(f.watches.size, 0);
  assert.equal(f.controller.getSnapshot().phase, 'background');
  const before = f.bodies.length;
  f.advance();
  f.emit();
  await f.settle();
  assert.equal(f.bodies.length, before, 'late background callbacks ignored');
  f.show();
  await f.settle();
  assert.equal(f.controller.getSnapshot().phase, 'walking');
  assert.equal(f.watches.size, 1);
  assert.equal(f.bodies.at(-1).resume, true);
  assert.equal(f.controller.getSnapshot().meters, 10, 'background displacement not credited');
  f.advance();
  f.emit();
  await f.settle();
  assert.equal(f.controller.getSnapshot().meters, 20);
  f.controller.pause();
  f.hide();
  f.show();
  await f.settle();
  assert.equal(f.controller.getSnapshot().phase, 'paused');
  assert.equal(f.watches.size, 0, 'manual pause stays paused');
  off();
  f.controller.dispose();
});
test('desktop cannot prompt for location and logout cancels pending permission callbacks and GPS', async () => {
  const desktop = fixture({ mobile: false });
  await desktop.controller.loadCapabilities();
  await desktop.controller.start();
  assert.ok(!desktop.log.includes('permission'));
  desktop.controller.dispose();
  const f = fixture({ deferLocation: true });
  await f.controller.loadCapabilities();
  const start = f.controller.start();
  f.controller.setOwner(null);
  f.resolve();
  await start;
  assert.equal(f.watches.size, 0);
  assert.equal(f.controller.getSnapshot().phase, 'idle');
  assert.ok(!f.log.some((p) => p.endsWith('/start')));
  f.controller.dispose();
});
test('network interruptions preserve accepted progress and Resume starts with a fresh server sequence and anchor', async () => {
  const f = fixture();
  await f.controller.loadCapabilities();
  await f.controller.start();
  f.advance();
  f.emit();
  await f.settle();
  f.failSamples();
  f.advance();
  f.emit();
  await f.settle();
  assert.equal(f.controller.getSnapshot().phase, 'error');
  assert.equal(f.watches.size, 0);
  assert.equal(f.controller.getSnapshot().meters, 10);
  assert.deepEqual(f.bodies.at(-1), f.bodies.at(-2), 'retry is byte-for-byte identical');
  f.recover();
  await f.controller.start();
  assert.equal(f.controller.getSnapshot().phase, 'walking');
  assert.equal(f.bodies.at(-1).resume, true);
  await f.controller.finish();
  assert.equal(f.controller.getSnapshot().hasSession, false);
  assert.equal(f.watches.size, 0);
  f.hide();
  f.show();
  await f.settle();
  assert.equal(f.watches.size, 0);
  f.controller.dispose();
});
test('remaining distance counts down with both clock time and server-approved walking, never rounding an unready egg to zero', () => {
  const now = 100000;
  assert.equal(eggWalkingMeters(now + 14400000, now), 2000);
  assert.equal(eggWalkingMeters(now + 14400000 - 720000, now), 1900);
  assert.equal(eggWalkingMeters(now + 14400000 - 720000, now + 720000), 1800);
  assert.equal(eggWalkingMeters(now + 1, now), 1);
  assert.equal(eggWalkingMeters(now - 1, now), 0);
  assert.equal(walkingDistance(99.1), '100 m');
  assert.equal(walkingDistance(1900), '1.90 km');
});
