import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/data/demo';
import { createAccountUpdates } from '../src/services/account-updates';
import type { AppSnapshot } from '../src/types';

test('background updates discover new state without overlapping or overwriting newer actions and wallets', async () => {
  const state = createInitialState();
  let resolve!: (snapshot: AppSnapshot) => void;
  let reads = 0,
    revision = 0,
    allowed = true;
  const applied: AppSnapshot[] = [];
  const updates = createAccountUpdates({
    wallet: state.profile.wallet,
    load: () => {
      reads++;
      return new Promise((r) => {
        resolve = r;
      });
    },
    canRefresh: () => allowed,
    revision: () => revision,
    apply: (s) => applied.push(s),
  });
  const first = updates.refresh();
  await updates.refresh();
  assert.equal(reads, 1);
  revision++;
  resolve(state);
  await first;
  assert.equal(applied.length, 0, 'a newer action invalidates an earlier read');
  allowed = false;
  await updates.refresh();
  assert.equal(reads, 1, 'hidden or busy accounts do not poll');
  allowed = true;
  const second = updates.refresh();
  resolve(state);
  await second;
  assert.equal(applied.length, 1);
  const wrong = updates.refresh();
  resolve({ ...state, profile: { ...state.profile, wallet: 'other-wallet' } });
  await wrong;
  assert.equal(applied.length, 1);
  const old = updates.refresh();
  updates.stop();
  resolve(state);
  await old;
  assert.equal(applied.length, 1, 'disconnect prevents stale account restoration');
});

test('a failed background read keeps the current UI and permits a later retry', async () => {
  const state = createInitialState();
  let fail = true,
    count = 0;
  const updates = createAccountUpdates({
    wallet: state.profile.wallet,
    load: async () => {
      if (fail) throw new Error('offline');
      return state;
    },
    canRefresh: () => true,
    revision: () => 0,
    apply: () => count++,
  });
  await updates.refresh();
  assert.equal(count, 0);
  fail = false;
  await updates.refresh();
  assert.equal(count, 1);
});
