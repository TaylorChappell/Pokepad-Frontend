import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserWalletStorage, watchWalletStorage } from '../src/services/wallet-storage';
import { JSDOM } from 'jsdom';

const key = 'kanto.wallet-session:v1:test-api';
const signedOut = 'kanto.explicitly-signed-out';

test('cross-tab listeners only react to wallet records in shared storage and clean up', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const dom = new JSDOM('', { url: 'https://kanto.test' });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  let changes = 0;
  const stop = watchWalletStorage(key, signedOut, () => {
    changes++;
  });
  const send = (changedKey: string | null, storageArea = dom.window.localStorage) =>
    dom.window.dispatchEvent(
      new dom.window.StorageEvent('storage', { key: changedKey, storageArea }),
    );
  try {
    send('unrelated');
    send(key, dom.window.sessionStorage);
    assert.equal(changes, 0);
    send(key);
    send(signedOut);
    send(null);
    assert.equal(changes, 3);
    stop();
    send(key);
    assert.equal(changes, 3);
  } finally {
    stop();
    dom.window.close();
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
function store() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

test('a verified session survives a fresh browser tab and migrates existing tab sessions', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const persistent = store(),
    tabOne = store(),
    tabTwo = store();
  const saved = JSON.stringify({
    wallet: 'test-wallet',
    token: 'test-token',
    expiresAt: '2030-01-01',
  });
  tabOne.setItem(key, saved);
  try {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: persistent, sessionStorage: tabOne },
    });
    const first = createBrowserWalletStorage(key, signedOut)()!;
    assert.equal(first.getItem(key), saved);
    assert.equal(tabOne.getItem(key), null);
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: persistent, sessionStorage: tabTwo },
    });
    const second = createBrowserWalletStorage(key, signedOut)()!;
    assert.equal(second.getItem(key), saved, 'fresh tabs reuse the session for server validation');
    first.setItem(signedOut, '1');
    first.removeItem(key);
    assert.equal(second.getItem(key), null);
    assert.equal(second.getItem(signedOut), '1');
    tabTwo.setItem(key, saved);
    const reopened = createBrowserWalletStorage(key, signedOut)()!;
    assert.equal(reopened.getItem(key), null, 'old per-tab data cannot undo a logout');
    assert.equal(tabTwo.getItem(key), null);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('an old tab cannot replace a newer shared account and restricted storage still has a tab fallback', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const persistent = store(),
    tab = store();
  persistent.setItem(key, 'new-account-session');
  tab.setItem(key, 'old-account-session');
  tab.setItem(signedOut, '1');
  try {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: persistent, sessionStorage: tab },
    });
    const shared = createBrowserWalletStorage(key, signedOut)()!;
    assert.equal(shared.getItem(key), 'new-account-session');
    assert.equal(shared.getItem(signedOut), null);
    assert.equal(tab.getItem(signedOut), null);
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        get localStorage() {
          throw new Error('Blocked');
        },
        sessionStorage: tab,
      },
    });
    const fallback = createBrowserWalletStorage(key, signedOut)()!;
    fallback.setItem(key, 'tab-session');
    assert.equal(tab.getItem(key), 'tab-session');
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
