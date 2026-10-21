import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isMobileWalkingDevice,
  postWalkingSample,
  type WalkSession,
} from '../src/services/walking';
import { ApiError, type apiRequest } from '../src/services/http';
const session = (): WalkSession => ({
  sessionId: 'walk-1',
  challenge: 'server-challenge',
  nextSeq: 1,
  expiresAt: 10000,
  acceptedMeters: 0,
});
const position = {
  coords: {
    latitude: 51,
    longitude: -1,
    accuracy: 10,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    toJSON: () => ({}),
  },
  timestamp: 1700000000000,
};
test('walking gates ordinary desktop devices and admits Android, iPhone, and touch iPad', () => {
  assert.equal(
    isMobileWalkingDevice({ userAgent: 'Mozilla Windows Chrome', maxTouchPoints: 0 }),
    false,
  );
  assert.equal(
    isMobileWalkingDevice({ userAgent: 'Mozilla Macintosh Safari', maxTouchPoints: 0 }),
    false,
  );
  for (const userAgent of ['Android Chrome', 'iPhone Safari', 'iPad Safari'])
    assert.equal(isMobileWalkingDevice({ userAgent, maxTouchPoints: 5 }), true);
  assert.equal(
    isMobileWalkingDevice({ userAgent: 'Mozilla Macintosh Safari', maxTouchPoints: 5 }),
    true,
  );
});
test('walking sends server challenge and coordinates, never caller-computed distance, and consumes filtered sequence', async () => {
  const current = session();
  let body: unknown;
  const send = (async (_path, options) => {
    body = options?.json;
    return {
      accepted: false,
      reason: 'first_location',
      creditedMeters: 0,
      sessionMeters: 0,
      dailyMeters: 0,
      nextSeq: 2,
      readyEggIds: [],
    };
  }) as typeof apiRequest;
  await postWalkingSample(current, position, send);
  assert.deepEqual(body, {
    challenge: 'server-challenge',
    seq: 1,
    latitude: 51,
    longitude: -1,
    accuracy: 10,
    timestamp: 1700000000000,
  });
  assert.equal(current.nextSeq, 2);
});
test('ambiguous location response retries identical payload, preserving anti-replay sequence', async () => {
  const current = session();
  const payloads: unknown[] = [];
  const send = (async (_path, options) => {
    payloads.push(options?.json);
    if (payloads.length === 1) throw new ApiError('Timeout', 408);
    return {
      accepted: true,
      creditedMeters: 12,
      sessionMeters: 12,
      dailyMeters: 12,
      nextSeq: 2,
      readyEggIds: [],
    };
  }) as typeof apiRequest;
  const result = await postWalkingSample(current, position, send);
  assert.deepEqual(payloads[0], payloads[1]);
  assert.equal(current.nextSeq, 2);
  assert.equal(result.sessionMeters, 12);
});
test('a rejected or doubly interrupted sample does not invent distance or advance its sequence', async () => {
  const current = session();
  let calls = 0;
  await assert.rejects(
    postWalkingSample(current, position, (async () => {
      calls++;
      throw new ApiError('Replay rejected', 409);
    }) as typeof apiRequest),
    /Replay rejected/,
  );
  assert.equal(calls, 1);
  assert.equal(current.nextSeq, 1);
  calls = 0;
  await assert.rejects(
    postWalkingSample(current, position, (async () => {
      calls++;
      throw new ApiError('Offline', 0);
    }) as typeof apiRequest),
    /Offline/,
  );
  assert.equal(calls, 2);
  assert.equal(current.nextSeq, 1);
});
