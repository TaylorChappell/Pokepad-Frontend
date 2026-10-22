import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { BackendStatus } from '../src/components/BackendStatus';
import { ServiceStatusMonitor, type ServiceStatus } from '../src/services/service-status';

const healthy: ServiceStatus = { ready: true, services: { rewards: true, payouts: true } };
const paused: ServiceStatus = { ready: true, services: { rewards: false, payouts: false } };

test('a brief stale heartbeat or failed request never becomes a paused notice', () => {
  for (const transient of [paused, null]) {
    const monitor = new ServiceStatusMonitor();
    assert.equal(monitor.record(healthy, 0), null);
    assert.equal(monitor.record(transient, 30000), null);
    assert.equal(monitor.confirming, true);
    assert.equal(monitor.record(healthy, 40000), null);
    assert.equal(monitor.confirming, false);
  }
});

test('persistent pauses need a fresh confirmation, and recovery clears them immediately', () => {
  const monitor = new ServiceStatusMonitor();
  assert.equal(monitor.record(paused, 0), null);
  for (const now of [1, 100, 2000, 9999]) assert.equal(monitor.record(paused, now), null);
  assert.match(monitor.record(paused, 10000)!.title, /Rewards & Pokémon sales/);
  assert.equal(monitor.confirming, false);
  assert.equal(monitor.record(healthy, 10001), null);
});

test('network failures and different service pauses cannot confirm one another', () => {
  const monitor = new ServiceStatusMonitor();
  assert.equal(monitor.record(paused, 0), null);
  assert.equal(monitor.record(null, 10000), null);
  assert.match(monitor.record(null, 20000)!.title, /trouble connecting/);
  assert.doesNotMatch(monitor.notice!.details.join(' '), /sales|paused/);
  monitor.record(healthy, 21000);
  monitor.record(paused, 22000);
  const walking = { ready: true, services: { walking: false } };
  assert.equal(monitor.record(walking, 32000), null);
  assert.match(monitor.record(walking, 42000)!.title, /Walking/);
});

test('a failed check cannot clear a confirmed outage or turn it into a false recovery', () => {
  const monitor = new ServiceStatusMonitor();
  monitor.record(paused, 0);
  const confirmed = monitor.record(paused, 10000);
  assert.equal(monitor.record(null, 20000), confirmed);
  assert.equal(monitor.record(paused, 30000)!.title, confirmed!.title);
  assert.equal(monitor.confirming, false);
});

test('old observations after tab suspension or a clock rollback cannot confirm a new outage', () => {
  for (const resumedAt of [120000, -1]) {
    const monitor = new ServiceStatusMonitor();
    monitor.record(paused, 0);
    assert.equal(monitor.record(paused, resumedAt), null);
    assert.match(monitor.record(paused, resumedAt + 10000)!.title, /paused/);
  }
});

function setup(t: Parameters<Parameters<typeof test>[1]>[0]) {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://example.test/',
    pretendToBeVisual: true,
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  const root = createRoot(document.getElementById('root')!);
  t.after(async () => {
    await act(async () => root.unmount());
    t.mock.timers.reset();
    dom.window.close();
  });
  return { root, dom };
}

test('the mounted banner silently rechecks a brief pause and stops polling on unmount', async (t) => {
  const { root, dom } = setup(t);
  let checks = 0;
  const loadStatus = async () => (++checks === 1 ? paused : healthy);
  await act(async () => root.render(React.createElement(BackendStatus, { loadStatus })));
  assert.equal(document.querySelector('.backend-status'), null);
  await act(async () => t.mock.timers.tick(9999));
  assert.equal(checks, 1);
  await act(async () => t.mock.timers.tick(1));
  assert.equal(checks, 2);
  assert.equal(document.querySelector('.backend-status'), null);
  await act(async () => root.unmount());
  await act(async () => {
    t.mock.timers.tick(120000);
    dom.window.dispatchEvent(new dom.window.Event('focus'));
  });
  assert.equal(checks, 2);
});

test('a confirmed pause is visible, check again verifies recovery, and repeated network errors stay distinct', async (t) => {
  const { root, dom } = setup(t);
  let result: ServiceStatus | null = paused;
  const loadStatus = async () => {
    if (result === null) throw new Error('Temporary timeout');
    return result;
  };
  await act(async () => root.render(React.createElement(BackendStatus, { loadStatus })));
  await act(async () => t.mock.timers.tick(10000));
  assert.match(document.body.textContent!, /Rewards & Pokémon sales are paused/);
  result = healthy;
  await act(async () => (document.querySelector('button') as HTMLButtonElement).click());
  assert.equal(document.querySelector('.backend-status'), null);
  result = null;
  await act(async () => dom.window.dispatchEvent(new dom.window.Event('focus')));
  assert.equal(document.querySelector('.backend-status'), null);
  await act(async () => t.mock.timers.tick(10000));
  assert.match(document.body.textContent!, /Having trouble connecting/);
  assert.doesNotMatch(document.body.textContent!, /sales are paused/);
});

test('StrictMode and overlapping focus checks cannot apply an aborted response', async (t) => {
  const { root, dom } = setup(t);
  const requests: { signal: AbortSignal; resolve: (s: ServiceStatus) => void }[] = [];
  const loadStatus = (signal: AbortSignal) =>
    new Promise<ServiceStatus>((resolve) => requests.push({ signal, resolve }));
  await act(async () =>
    root.render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(BackendStatus, { loadStatus }),
      ),
    ),
  );
  assert.equal(requests.length, 2);
  assert.equal(requests[0].signal.aborted, true);
  await act(async () => dom.window.dispatchEvent(new dom.window.Event('focus')));
  assert.equal(requests.length, 2, 'only one active request per mounted effect');
  await act(async () => requests[1].resolve(healthy));
  await act(async () => requests[0].resolve(paused));
  await act(async () => t.mock.timers.tick(10000));
  assert.equal(requests.length, 2, 'the old response must not schedule a confirmation');
  assert.equal(document.querySelector('.backend-status'), null);
  await act(async () => t.mock.timers.tick(20000));
  assert.equal(requests.length, 3);
  await act(async () => root.unmount());
  assert.equal(requests[2].signal.aborted, true);
  await act(async () => requests[2].resolve(paused));
});
