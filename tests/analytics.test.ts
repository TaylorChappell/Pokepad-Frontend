import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/data/demo';
import { accountAnalyticsEvents, summarizeLaunchpad } from '../src/pages/Analytics';

test('analytics totals use one currency and keep unallocated funds separate', () => {
  const state = createInitialState(1700000000000);
  state.coins = state.coins.slice(0, 2).map((coin, index) => ({
    ...coin,
    marketCap: index ? 20 : 10,
    volume: index ? 4 : 2,
    marketCapUsd: index ? 3000 : 1500,
    volumeUsd: index ? 600 : 300,
    vault: index ? 0.5 : 1.25,
  }));
  const summary = summarizeLaunchpad(state);
  assert.equal(summary.currency, 'USD');
  assert.equal(summary.combinedMarketCap, 4500);
  assert.equal(summary.combinedVolume, 900);
  assert.equal(summary.availableRewardFunds, 1.75);
  assert.equal(
    summary.modes.reduce((sum, entry) => sum + entry.count, 0),
    2,
  );
  delete state.coins[1].volumeUsd;
  const incomplete = summarizeLaunchpad(state);
  assert.equal(incomplete.currency, 'SOL');
  assert.equal(incomplete.combinedMarketCap, 30);
  assert.equal(incomplete.combinedVolume, 6);
});

test('account analytics shows recorded outcomes in order and does not invent community events', () => {
  const state = createInitialState(1700000000000);
  state.pokemon[0].shiny = true;
  state.activity = [
    {
      id: 'egg',
      title: 'Charmander hatched!',
      detail: 'Rare egg opened.',
      kind: 'reward',
      createdAt: 100,
      pokemonId: 4,
      href: '/pokemon/' + state.pokemon[0].id,
    },
    {
      id: 'pack',
      title: 'Pikachu joined your team!',
      detail: 'Standard pack opened.',
      kind: 'reward',
      createdAt: 200,
      pokemonId: 25,
      href: '/pokemon/pack',
    },
    {
      id: 'received',
      title: 'Received an egg',
      detail: 'From a community coin.',
      kind: 'reward',
      createdAt: 300,
      href: '/rewards',
    },
  ];
  const events = accountAnalyticsEvents(state);
  assert.deepEqual(
    events.map((event) => event.id),
    ['received', 'pack', 'egg'],
  );
  assert.deepEqual(
    events.map((event) => event.kind),
    ['other', 'pack', 'egg'],
  );
  assert.equal(events[2].shiny, true);
  assert.equal(events.length, state.activity.length);
});
