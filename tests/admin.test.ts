import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { AppContext } from '../src/state/AppContext';
import { createInitialState } from '../src/data/demo';
import { AdminPage } from '../src/pages/Admin';
import { adminApi, adminMutation, type AdminOverview } from '../src/services/admin';
import { battleAvailability } from '../src/components/BattleTeamPicker';
import { type apiRequest } from '../src/services/http';
const overview: AdminOverview = {
  at: new Date().toISOString(),
  network: 'devnet',
  metrics: {
    trainers: 4,
    active_trainers: 2,
    restricted_trainers: 0,
    active_coins: 1,
    volume_lamports: '2000000000',
    pokemon: 8,
    gifts: 4,
    battles: 0,
    pending_payouts: 0,
    failed_payouts: 0,
    rewards_received_lamports: '1000000000',
    rewards_available_lamports: '1000000000',
    rewards_paid_lamports: '0',
    rewards_reserved_lamports: '0',
    oldest_pending_payout_at: null,
  },
  services: [
    {
      id: 'worker',
      name: 'Background worker',
      state: 'stale',
      detail: 'Waiting for a fresh check.',
      checkedAt: null,
    },
  ],
  jobs: [],
  treasury: { balanceLamports: null, expectedLamports: null, discrepancyCount: 0 },
};
async function harness(admin = true) {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://example.test/#/admin',
    pretendToBeVisual: true,
  });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const key of [
    'window',
    'document',
    'HTMLElement',
    'HTMLInputElement',
    'HTMLTextAreaElement',
    'MutationObserver',
    'localStorage',
    'sessionStorage',
    'Image',
    'Event',
  ]) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value: (dom.window as any)[key],
      configurable: true,
      writable: true,
    });
  }
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root')!),
    state = createInitialState();
  state.admin = admin;
  const context = {
    state,
    mode: 'live',
    session: { status: 'authenticated', wallet: state.profile.wallet, signingReady: true },
    now: Date.now(),
    busy: false,
    toast: () => {},
    act: async () => null,
    reload: async () => state,
    connectWallet: async () => {},
    disconnectWallet: async () => {},
  } as NonNullable<React.ContextType<typeof AppContext>>;
  await act(async () =>
    root.render(
      React.createElement(AppContext.Provider, { value: context }, React.createElement(AdminPage)),
    ),
  );
  const click = async (text: string) => {
    const button = [...document.querySelectorAll('button')].find(
      (b) => (b.getAttribute('aria-label') || b.textContent?.trim()) === text,
    );
    assert.ok(button, 'Button ' + text);
    await act(async () =>
      button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })),
    );
  };
  return {
    dom,
    state,
    context,
    root,
    click,
    async close() {
      await act(async () => root.unmount());
      dom.window.close();
      for (const [key, value] of previous) {
        if (value) Object.defineProperty(globalThis, key, value);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}
test('admin data is not requested for non-admin trainers', async (t) => {
  let calls = 0;
  t.mock.method(adminApi, 'overview', async () => {
    calls++;
    return overview;
  });
  const h = await harness(false);
  try {
    assert.match(document.body.textContent!, /Admin access only/);
    assert.equal(calls, 0);
  } finally {
    await h.close();
  }
});
test('control room shows stale status honestly and reaches gifts, users, main token and logs', async (t) => {
  t.mock.method(adminApi, 'overview', async () => overview);
  t.mock.method(adminApi, 'users', async () => ({ items: [], next: null }));
  t.mock.method(adminApi, 'logs', async () => ({ items: [], next: null }));
  t.mock.method(adminApi, 'main', async () => ({ mint: null, coin: null }));
  const h = await harness();
  try {
    assert.match(document.body.textContent!, /Control room/);
    assert.match(document.body.textContent!, /Out of date/);
    assert.match(document.body.textContent!, /2 SOL/);
    await h.click('Gifts');
    assert.match(document.body.textContent!, /Gift · cannot be sold/);
    assert.match(document.body.textContent!, /20 minutes/);
    assert.equal(document.querySelectorAll('.admin-kind-picker button').length, 2);
    await h.click('Packs');
    assert.match(document.body.textContent!, /Ready to open as soon as it arrives/);
    assert.equal(
      document.querySelector<HTMLButtonElement>('.admin-actions .primary')!.disabled,
      true,
    );
    await h.click('Send Pokémon');
    assert.equal(document.querySelectorAll('select')[0].options.length, 151);
    assert.match(document.body.textContent!, /no Gift badge/);
    assert.match(document.body.textContent!, /Review Pokémon/);
    await h.click('Trainers');
    assert.match(document.body.textContent!, /No trainers match/);
    await h.click('Main token');
    assert.match(document.body.textContent!, /No main token is connected/);
    assert.match(document.body.textContent!, /Pikachu/);
    assert.match(document.body.textContent!, /30%Creator20%Platform50%Rewards/);
    await h.click('Logs');
    assert.match(document.body.textContent!, /No matching events/);
    await h.click('Admin audit');
    assert.match(document.body.textContent!, /Audit records cannot be edited/);
  } finally {
    await h.close();
  }
});
test('gift request retry reuses its ID across reload and successful follow-up is a new gift', async () => {
  const dom = new JSDOM('', { url: 'https://example.test' });
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: dom.window.sessionStorage,
    configurable: true,
  });
  const keys: string[] = [];
  let fail = true;
  const transport = (async (_path, options) => {
    keys.push(new Headers(options?.headers).get('Idempotency-Key')!);
    if (fail) throw new Error('Connection lost');
    return { ok: true };
  }) as typeof apiRequest;
  const body = { wallet: 'test', kind: 'pack', tier: 'Epic', quantity: 1, reason: 'Thanks' };
  try {
    await assert.rejects(adminMutation('owner', '/gifts', body, transport));
    fail = false;
    await adminMutation('owner', '/gifts', body, transport);
    assert.equal(keys[0], keys[1]);
    await adminMutation('owner', '/gifts', body, transport);
    assert.notEqual(keys[1], keys[2]);
  } finally {
    dom.window.close();
    Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
});
test('gift Pokémon remain available for friendly battles but not Pokémon stakes', () => {
  const p = { ...createInitialState().pokemon[0], gift: true, locked: false, health: 999 };
  assert.equal(battleAvailability(p, false), null);
  assert.equal(battleAvailability(p, true), 'Gifts cannot be staked');
  const direct = { ...p, gift: false, adminIssued: true };
  assert.equal(battleAvailability(direct, false), null);
  assert.equal(battleAvailability(direct, true), 'Cannot be staked');
});

test('main-token setup requires a verified preview before confirmation', async (t) => {
  t.mock.method(adminApi, 'overview', async () => overview);
  t.mock.method(adminApi, 'main', async () => ({ mint: null, coin: null }));
  let inspected = '';
  let imported: any = null;
  t.mock.method(adminApi, 'preview', async (mint: string) => {
    inspected = mint;
    return {
      currentMint: null,
      coin: {
        mint,
        creatorWallet: 'C'.repeat(32),
        name: 'Kanto',
        symbol: 'KANTO',
        signature: 'launch-signature',
        launchSlot: 100,
        launchedAt: 1700000000000,
        description: '',
        verifiedAt: new Date().toISOString(),
        splits: { creator: 30, platform: 20, rewards: 50 },
      },
    };
  });
  t.mock.method(adminApi, 'mutate', async (_wallet: string, path: string, body: any) => {
    imported = { path, body };
    return {};
  });
  const h = await harness();
  try {
    await h.click('Main token');
    assert.ok(!document.body.textContent?.includes('Confirm main token'));
    const input = document.querySelector<HTMLInputElement>('.admin-form input')!;
    const mint = 'A'.repeat(32);
    await act(async () => {
      Object.getOwnPropertyDescriptor(h.dom.window.HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        mint,
      );
      input.dispatchEvent(new h.dom.window.Event('input', { bubbles: true }));
      input.dispatchEvent(new h.dom.window.Event('change', { bubbles: true }));
    });
    await act(async () =>
      document
        .querySelector('form')!
        .dispatchEvent(new h.dom.window.Event('submit', { bubbles: true, cancelable: true })),
    );
    assert.equal(inspected, mint);
    assert.equal(imported, null);
    await h.click('Confirm main token');
    assert.equal(imported.path, '/main-token');
    assert.equal(imported.body.mint, mint);
    assert.equal(imported.body.signature, 'launch-signature');
    assert.equal(imported.body.expectedMint, null);
    assert.equal(imported.body.mode, 'Mixed');
  } finally {
    await h.close();
  }
});
