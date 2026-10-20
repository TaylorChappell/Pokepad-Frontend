import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/data/demo';
import { createTrainerDirectory, DEMO_TRAINERS, ownTrainer } from '../src/services/trainers';

test('trainer lookup resolves a registered wallet and never fabricates an unknown profile', async () => {
  const directory = createTrainerDirectory();
  const own = ownTrainer(createInitialState(), true);
  const leaf = DEMO_TRAINERS[0];
  assert.deepEqual(await directory.search(leaf.wallet, own), [leaf]);
  assert.deepEqual(await directory.get(leaf.wallet, own), leaf);
  assert.deepEqual(await directory.search('lEaF', own), [leaf]);
  assert.deepEqual(await directory.search(own.wallet, own), [own]);
  assert.equal(await directory.get('not-a-registered-wallet', own), null);
  assert.deepEqual(await directory.search(leaf.wallet.toLowerCase(), own), []);
  assert.equal((await directory.get(own.wallet, own))?.pokemon.length, own.pokemon.length);
});

test('live directory uses the public trainer API and rejects a mismatched identity', async () => {
  const originalFetch = globalThis.fetch;
  const own = ownTrainer(createInitialState());
  const leaf = DEMO_TRAINERS[0];
  let requested = '';
  let payload: unknown = { trainers: [leaf] };
  globalThis.fetch = async (input) => {
    requested = String(input);
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  try {
    const directory = createTrainerDirectory('https://example.test/');
    assert.deepEqual(await directory.search('Leaf', own), [leaf]);
    assert.equal(requested, 'https://example.test/v1/trainers?query=Leaf');
    payload = { trainer: leaf };
    assert.deepEqual(await directory.get(leaf.wallet, own), leaf);
    assert.equal(requested, 'https://example.test/v1/trainers/' + leaf.wallet);
    await assert.rejects(directory.get(DEMO_TRAINERS[1].wallet, own), /could not be loaded/);
    payload = { trainer: { ...leaf, pokemon: [{ speciesId: 999 }] } };
    await assert.rejects(directory.get(leaf.wallet, own), /could not be loaded/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
