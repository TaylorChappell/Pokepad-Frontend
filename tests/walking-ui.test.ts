import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { AppContext } from '../src/state/AppContext';
import { WalkingProvider } from '../src/state/WalkingContext';
import { LiveWalkPage } from '../src/pages/LiveWalk';
import { WalkingStatus } from '../src/components/WalkingStatus';
import { createWalkingController } from '../src/services/walking-controller';
import { createInitialState } from '../src/data/demo';
import type { apiRequest } from '../src/services/http';

test('walking UI shows per-egg countdowns, retains GPS across pages, and pauses/resumes with app visibility', async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://kanto.test/#/walk',
    pretendToBeVisual: true,
  });
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Image'])
    Object.defineProperty(globalThis, key, {
      value: (dom.window as any)[key],
      configurable: true,
      writable: true,
    });
  Object.defineProperty(navigator, 'userAgent', { value: 'iPhone Mobile', configurable: true });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let stall = true;
  let hidden = false,
    time = Date.now(),
    seq = 1,
    watchCount = 0,
    cleared = 0,
    watch: PositionCallback | undefined;
  Object.defineProperty(document, 'hidden', { get: () => hidden, configurable: true });
  const state = createInitialState();
  state.profile.reducedMotion = true;
  state.rewards = state.rewards
    .filter((r) => r.kind === 'egg')
    .slice(0, 2)
    .map((r, i) => ({
      ...r,
      openedAt: undefined,
      readyAt: time + (i + 1) * 720000,
      initialDuration: (i + 1) * 720000,
      walkingBoostMs: 0,
    }));
  const location = () =>
    ({
      timestamp: time,
      coords: { latitude: 51, longitude: 0, accuracy: 3 },
    }) as GeolocationPosition;
  const geo = {
    getCurrentPosition(success: PositionCallback) {
      if (!stall) success(location());
    },
    watchPosition(success: PositionCallback) {
      watch = success;
      return ++watchCount;
    },
    clearWatch() {
      cleared++;
    },
  } as Geolocation;
  const controller = createWalkingController({
    geo,
    mobile: true,
    screen: { width: 390, height: 844 },
    now: () => time,
    hidden: () => hidden,
    request: (async (path, options) => {
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
          expiresAt: time + 5400000,
          acceptedMeters: 0,
        };
      const body = options?.json as any;
      seq++;
      return {
        accepted: !body.resume,
        creditedMeters: body.resume ? 0 : 10,
        sessionMeters: body.resume ? 0 : 10,
        dailyMeters: 10,
        nextSeq: seq,
        readyEggIds: [],
        timeSavedMs: body.resume ? 0 : 144000,
        eggUpdates: body.resume
          ? []
          : state.rewards.map((r) => ({
              id: r.id,
              readyAt: r.readyAt - 72000,
              walkingBoostMs: 72000,
            })),
      };
    }) as typeof apiRequest,
  });
  const context = {
    state,
    mode: 'live' as const,
    session: {
      status: 'authenticated' as const,
      wallet: state.profile.wallet,
      provider: 'Phantom' as const,
      expiresAt: null,
    },
    now: time,
    busy: false,
    toast: () => {},
    act: async () => null,
    reload: async () => null,
    connectWallet: async () => {},
    disconnectWallet: async () => {},
  };
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root')!);
  const render = async (path: string) =>
    act(async () =>
      root.render(
        React.createElement(
          AppContext.Provider,
          { value: { ...context, now: time } },
          React.createElement(WalkingProvider, {
            controller,
            children:
              path === '/walk'
                ? React.createElement(LiveWalkPage)
                : React.createElement(WalkingStatus, { path }),
          }),
        ),
      ),
    );
  try {
    await render('/walk');
    assert.equal(document.querySelectorAll('.walk-egg-card').length, 2);
    assert.deepEqual(
      [...document.querySelectorAll('.walk-egg-distance strong')].map((e) => e.textContent),
      ['100 m', '200 m'],
    );
    assert.match(document.querySelector('.walk-saved-total')!.textContent!, /0m saved/);
    assert.doesNotMatch(document.body.textContent!, /spoofing/);
    await act(async () => {
      (
        Array.from(document.querySelectorAll('button')).find((b) =>
          b.textContent?.includes('Enable location'),
        ) as HTMLButtonElement
      ).click();
    });
    assert.equal(controller.getSnapshot().phase, 'requesting');
    const cancel = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Cancel',
    )!;
    assert.equal(cancel.disabled, false);
    await act(async () => cancel.click());
    assert.equal(controller.getSnapshot().phase, 'idle');
    stall = false;
    await act(async () => {
      [...document.querySelectorAll('button')]
        .find((b) => b.textContent?.includes('Enable location'))!
        .click();
    });
    assert.equal(controller.getSnapshot().phase, 'walking');
    assert.equal(watchCount, 1);
    await render('/pokemon');
    assert.match(document.body.textContent!, /Walking active/);
    assert.equal(cleared, 0);
    time += 7000;
    await act(async () => {
      watch!(location());
    });
    await render('/walk');
    assert.deepEqual(
      [...document.querySelectorAll('.walk-egg-distance strong')].map((e) => e.textContent),
      ['90 m', '190 m'],
    );
    time += 72000;
    await render('/walk');
    assert.deepEqual(
      [...document.querySelectorAll('.walk-egg-distance strong')].map((e) => e.textContent),
      ['80 m', '180 m'],
    );
    hidden = true;
    await act(async () => document.dispatchEvent(new dom.window.Event('visibilitychange')));
    assert.equal(controller.getSnapshot().phase, 'background');
    assert.equal(cleared, 1);
    hidden = false;
    await act(async () => document.dispatchEvent(new dom.window.Event('visibilitychange')));
    assert.equal(controller.getSnapshot().phase, 'walking');
    assert.equal(watchCount, 2);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});

test('desktop walking is an explanation, never a location permission or tracking screen', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://kanto.test/#/walk' });
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Image'])
    Object.defineProperty(globalThis, key, {
      value: (dom.window as any)[key],
      configurable: true,
      writable: true,
    });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let gpsCalls = 0;
  const controller = createWalkingController({
    mobile: false,
    geo: {
      getCurrentPosition() {
        gpsCalls++;
      },
      watchPosition() {
        gpsCalls++;
        return 1;
      },
      clearWatch() {},
    } as Geolocation,
    screen: { width: 1440, height: 900 },
    request: (async () => ({ enabled: true, boostMsPerMeter: 7200 })) as typeof apiRequest,
  });
  const context = {
    state: createInitialState(),
    mode: 'live',
    now: Date.now(),
    session: { status: 'authenticated', wallet: 'trainer', provider: 'Phantom', expiresAt: null },
    reload: async () => null,
  } as React.ContextType<typeof AppContext>;
  const { createRoot } = await import('react-dom/client');
  const { WalkPage } = await import('../src/pages/Rewards');
  const root = createRoot(document.getElementById('root')!);
  try {
    for (const mode of ['live', 'demo'] as const) {
      await act(async () =>
        root.render(
          React.createElement(
            AppContext.Provider,
            { value: { ...context, mode } },
            React.createElement(WalkingProvider, {
              controller,
              children: React.createElement(WalkPage),
            }),
          ),
        ),
      );
      assert.ok(document.querySelector('.walk-mobile-invitation'));
      assert.match(document.body.textContent!, /Walking isn’t available on desktop/);
      assert.match(document.body.textContent!, /12m off each egg/);
      assert.match(document.body.textContent!, /connect the same wallet/);
      assert.equal(
        document.querySelectorAll('.walk-controls,.walking-layout,.walk-session').length,
        0,
      );
      assert.equal(
        document.querySelector('a[href="#/rewards"]')!.textContent!.trim(),
        'View your eggs',
      );
      assert.equal(gpsCalls, 0);
    }
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
