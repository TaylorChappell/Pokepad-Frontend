import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createRoot } from 'react-dom/client';
import { AppProvider } from '../src/state/AppContext';
import { WalletConnection } from '../src/components/WalletConnection';
import { WalletGate } from '../src/components/WalletGate';
import { SidebarBuddy } from '../src/components/SidebarBuddy';
import { serviceNotice } from '../src/components/BackendStatus';
import { createInitialState } from '../src/data/demo';
import type { WalletSession } from '../src/services/wallet';

test('notices explain player actions rather than internal services', () => {
  const notice = serviceNotice({ ready: true, services: { rewards: false, payouts: false } })!;
  assert.equal(notice.title, 'Rewards & Pokémon sales are paused');
  assert.match(notice.details.join(' '), /eggs and packs/);
  assert.match(notice.details.join(' '), /Selling Pokémon for SOL/);
  assert.equal(serviceNotice({ ready: true, services: { rewards: true, payouts: true } }), null);
  assert.match(serviceNotice({ ready: true, services: { walking: false } })!.details[0], /Walking/);
});

test('failed sign-in keeps its dialog and error; success opens each private route without a page reset', async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://example.test/#/pokemon',
    pretendToBeVisual: true,
  });
  for (const key of [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'MutationObserver',
    'localStorage',
    'Image',
  ])
    Object.defineProperty(globalThis, key, {
      value: (dom.window as any)[key],
      configurable: true,
      writable: true,
    });
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  });
  let session: WalletSession = {
    status: 'anonymous',
    wallet: null,
    provider: null,
    expiresAt: null,
  };
  const listeners = new Set<(s: WalletSession) => void>();
  const emit = (next: WalletSession) => {
    session = next;
    listeners.forEach((fn) => fn(next));
  };
  const state = createInitialState();
  const publicState = {
    ...state,
    profile: { ...state.profile, wallet: '', equippedId: null },
    pokemon: [],
    rewards: [],
    notifications: [],
    activity: [],
  };
  let fail = true,
    loads = 0;
  const wallet = {
    currentWalletSession: () => session,
    subscribeWalletSession: (fn: (s: WalletSession) => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    restoreWalletSession: async () => {},
    disconnectWallet: async () =>
      emit({ status: 'anonymous', wallet: null, provider: null, expiresAt: null }),
    connectWallet: async () => {
      emit({
        status: 'connecting',
        wallet: null,
        provider: 'Phantom',
        expiresAt: null,
        step: 'signing',
      });
      await Promise.resolve();
      if (fail) {
        emit({ status: 'anonymous', wallet: null, provider: null, expiresAt: null });
        throw new Error('Your sign-in request expired. Please try again.');
      }
      emit({
        status: 'authenticated',
        wallet: state.profile.wallet,
        provider: 'Phantom',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        signingReady: true,
      });
    },
  };
  const api = {
    mode: 'live' as const,
    load: async () => {
      loads++;
      return session.status === 'authenticated' ? state : publicState;
    },
    dispatch: async () => state,
  };
  const root = createRoot(document.getElementById('root')!);
  const render = async (path: string) => {
    await act(async () => {
      root.render(
        React.createElement(AppProvider, {
          api,
          wallet,
          children: React.createElement(
            React.Fragment,
            null,
            React.createElement(SidebarBuddy, { path }),
            React.createElement(WalletGate, {
              path,
              children: React.createElement('p', { 'data-private': true }, 'Private collection'),
            }),
          ),
        }),
      );
    });
  };
  try {
    for (const path of [
      '/portfolio',
      '/rewards',
      '/pokemon',
      '/pokemon/any',
      '/battles',
      '/create',
    ]) {
      await render(path);
      assert.ok(document.querySelector('.trainer-gate'), path);
      assert.equal(document.querySelector('[data-private]'), null);
    }
    assert.equal(document.querySelector('.sidebar-buddy'), null);
    assert.doesNotMatch(document.body.textContent!, /Equip a Pokémon/);
    await act(async () => {
      (document.querySelector('.trainer-connect-button') as HTMLButtonElement).click();
    });
    assert.ok(document.querySelector('img[src$="wallets/phantom.svg"]'));
    assert.ok(document.querySelector('img[src$="wallets/metamask.svg"]'));
    const before = loads;
    await act(async () => {
      (document.querySelector('.wallet-provider.phantom') as HTMLButtonElement).click();
    });
    assert.equal(loads, before, 'a failed anonymous attempt must not reload and unmount the page');
    assert.match(document.querySelector('[role="alert"]')!.textContent!, /request expired/);
    assert.ok(document.querySelector('[role="dialog"]'));
    fail = false;
    await act(async () => {
      (document.querySelector('.wallet-provider.phantom') as HTMLButtonElement).click();
    });
    assert.equal(loads, before + 1);
    assert.equal(document.querySelector('.trainer-gate'), null);
    assert.ok(document.querySelector('[data-private]'));
    assert.ok(document.querySelector('.sidebar-buddy'));
    assert.equal(document.querySelector('[role="dialog"]'), null);
    await act(async () => {
      await wallet.disconnectWallet();
    });
    assert.equal(document.querySelector('[data-private]'), null);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
