import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/data/demo';
import {
  applyAction,
  collectionValue,
  profileName,
  EVOLUTION_CANDY,
  WALK_BOOST_MS_PER_KM,
  getEvolutionStatus,
  pendingMove,
  secureRandomIndex,
} from '../src/state/model';
import { migrateSnapshot } from '../src/services/api';
import { gymRankings } from '../src/state/gyms';
import { POKEMON } from '../src/data/pokemon';
import { MOVES, MOVE_OPTIONS } from '../src/data/moves';
import type { AppSnapshot, Action } from '../src/types';
const now = Date.UTC(2026, 9, 20, 12);
const totalFunded = (s: AppSnapshot) =>
  Math.round(
    (s.coins.reduce((n, c) => n + c.vault, 0) +
      s.pokemon.reduce((n, p) => n + p.backing + p.evolutionReserve, 0) +
      s.rewards
        .filter((r) => !r.openedAt)
        .reduce((n, r) => n + r.backing + r.evolutionReserve, 0)) *
      1e9,
  );
test('reward opening transfers its funded value and evolution budget exactly once', () => {
  const initial = createInitialState(now),
    r = initial.rewards.find((r) => r.id === 'egg-ready')!;
  const next = applyAction(initial, { type: 'reward.open', id: r.id }, now);
  assert.equal(next.pokemon.length, initial.pokemon.length + 1);
  assert.equal(next.pokemon.at(-1)?.backing, r.backing);
  assert.equal(next.pokemon.at(-1)?.evolutionReserve, r.evolutionReserve);
  assert.equal(totalFunded(next), totalFunded(initial));
  assert.ok(next.discovered.includes(r.outcomeSpeciesId!));
  assert.deepEqual(next.coins, initial.coins);
  assert.equal(initial.rewards.find((x) => x.id === r.id)?.openedAt, undefined);
  assert.throws(() => applyAction(next, { type: 'reward.open', id: r.id }, now), /already/);
  assert.throws(
    () => applyAction(initial, { type: 'reward.open', id: 'egg-standard' }, now),
    /still incubating/,
  );
});
test('walking preview reduces timers, adds a ready notification, and rejects invalid distances', () => {
  let s = createInitialState(now);
  const original = s.rewards.find((r) => r.id === 'egg-standard')!.readyAt;
  s = applyAction(s, { type: 'walk.progress', km: 0.5 }, now);
  assert.equal(
    s.rewards.find((r) => r.id === 'egg-standard')?.readyAt,
    original - 0.5 * WALK_BOOST_MS_PER_KM,
  );
  s = applyAction(s, { type: 'walk.progress', km: 1 }, now);
  assert.equal(s.rewards.find((r) => r.id === 'egg-standard')?.readyAt, now);
  assert.ok(s.notifications.some((n) => n.id === 'ready-egg-standard' && !n.read));
  assert.throws(() => applyAction(s, { type: 'walk.progress', km: Infinity }, now));
  assert.throws(() => applyAction(s, { type: 'walk.progress', km: -1 }, now));
});
test('funded evolution increases value, spends Rare Candy, and conserves every lamport', () => {
  const initial = createInitialState(now),
    p = initial.pokemon.find((p) => p.id === 'bulbasaur')!;
  const status = getEvolutionStatus(initial, p);
  assert.equal(status.canEvolve, true);
  assert.equal(status.fundingNeeded, 0);
  assert.equal(status.reserved, 0.04);
  const next = applyAction(initial, { type: 'pokemon.evolve', id: p.id }, now),
    evolved = next.pokemon.find((p) => p.id === 'bulbasaur')!;
  assert.equal(evolved.backing, 0.12);
  assert.equal(evolved.speciesId, 2);
  assert.equal(evolved.rareCandy, p.rareCandy - EVOLUTION_CANDY);
  assert.equal(evolved.evolutionReserve, 0.06);
  assert.equal(totalFunded(next), totalFunded(initial));
  assert.ok(next.discovered.includes(1) && next.discovered.includes(2));
  assert.throws(() => applyAction(initial, { type: 'pokemon.evolve', id: 'gengar' }, now), /final/);
  assert.throws(
    () => applyAction(initial, { type: 'pokemon.evolve', id: 'partner' }, now),
    /Rare Candy/,
  );
});
test('evolution cannot create money when its origin vault and reserve are insufficient', () => {
  const initial = createInitialState(now),
    p = initial.pokemon.find((p) => p.id === 'bulbasaur')!,
    coin = initial.coins.find((c) => c.id === 'bulb')!;
  p.evolutionReserve = 0;
  coin.vault = 0.01;
  assert.equal(getEvolutionStatus(initial, p).canEvolve, false);
  const before = structuredClone(initial);
  assert.throws(
    () => applyAction(initial, { type: 'pokemon.evolve', id: p.id }, now),
    /fund the evolution/,
  );
  assert.deepEqual(initial, before);
  coin.vault = 0.04;
  const next = applyAction(initial, { type: 'pokemon.evolve', id: p.id }, now);
  assert.equal(next.coins.find((c) => c.id === 'bulb')!.vault, 0);
  assert.equal(next.pokemon.find((p) => p.id === 'bulbasaur')!.backing, 0.12);
  assert.equal(totalFunded(next), totalFunded(initial));
});
test('Eevee evolution uses three equal server-style branches and ignores a supplied target', () => {
  const outcomes: number[] = [];
  for (let index = 0; index < 3; index++) {
    const initial = createInitialState(now);
    let calls = 0;
    const next = applyAction(
      initial,
      { type: 'pokemon.evolve', id: 'eevee', target: 6 } as Action,
      now,
      (length) => {
        assert.equal(length, 3);
        calls++;
        return index;
      },
    );
    const eevee = next.pokemon.find((p) => p.id === 'eevee')!;
    outcomes.push(eevee.speciesId);
    assert.equal(calls, 1);
    assert.equal(eevee.backing, 0.225);
    assert.equal(totalFunded(next), totalFunded(initial));
  }
  assert.deepEqual(
    [...outcomes].sort((a, b) => a - b),
    [134, 135, 136],
  );
  assert.throws(
    () =>
      applyAction(createInitialState(now), { type: 'pokemon.evolve', id: 'eevee' }, now, () => 3),
    /invalid/,
  );
  for (let i = 0; i < 10; i++) assert.ok([0, 1, 2].includes(secureRandomIndex(3)));
});
test('a ready earned move fills an empty slot once; arbitrary move learning is rejected', () => {
  const initial = createInitialState(now),
    p = initial.pokemon.find((p) => p.id === 'partner')!;
  assert.equal(pendingMove(p)?.move, 'Ember');
  const next = applyAction(
    initial,
    { type: 'pokemon.learn', id: p.id, offerId: 'partner-ember-9' },
    now,
  );
  assert.deepEqual(next.pokemon.find((p) => p.id === 'partner')!.moves, [
    'Scratch',
    'Growl',
    'Ember',
  ]);
  assert.equal(pendingMove(next.pokemon.find((p) => p.id === 'partner')!), undefined);
  assert.throws(
    () => applyAction(next, { type: 'pokemon.learn', id: p.id, offerId: 'partner-ember-9' }, now),
    /no longer/,
  );
  assert.throws(
    () =>
      applyAction(
        initial,
        { type: 'pokemon.learn', id: p.id, offerId: 'invented-flamethrower', replaceIndex: 0 },
        now,
      ),
    /no longer/,
  );
});
test('full move sets require a replacement and declined offers never reappear', () => {
  const initial = createInitialState(now),
    p = initial.pokemon.find((p) => p.id === 'bulbasaur')!,
    offer = pendingMove(p)!;
  assert.throws(
    () => applyAction(initial, { type: 'pokemon.learn', id: p.id, offerId: offer.id }, now),
    /forget/,
  );
  const learned = applyAction(
    initial,
    { type: 'pokemon.learn', id: p.id, offerId: offer.id, replaceIndex: 1 },
    now,
  );
  assert.deepEqual(learned.pokemon.find((p) => p.id === 'bulbasaur')!.moves, [
    'Tackle',
    'Razor Leaf',
    'Vine Whip',
    'Sleep Powder',
  ]);
  let declined = applyAction(
    initial,
    { type: 'pokemon.declineMove', id: p.id, offerId: offer.id },
    now,
  );
  declined = applyAction(declined, { type: 'sync' }, now + 60000);
  assert.equal(pendingMove(declined.pokemon.find((p) => p.id === 'bulbasaur')!), undefined);
  assert.equal(
    declined.pokemon.find((p) => p.id === 'bulbasaur')!.moveOffers[0].status,
    'declined',
  );
  declined.pokemon
    .find((p) => p.id === 'bulbasaur')!
    .moveOffers.push({ ...offer, id: 'duplicate-offer', status: 'pending' });
  assert.equal(pendingMove(declined.pokemon.find((p) => p.id === 'bulbasaur')!), undefined);
  assert.throws(
    () =>
      applyAction(
        declined,
        { type: 'pokemon.learn', id: p.id, offerId: offer.id, replaceIndex: 0 },
        now,
      ),
    /no longer/,
  );
});
test('listing blocks equip/redemption; redemption keeps discoveries and releases unused evolution budget', () => {
  const initial = createInitialState(now),
    listed = applyAction(initial, { type: 'pokemon.list', id: 'bulbasaur', amount: 0.5 }, now);
  assert.throws(
    () => applyAction(listed, { type: 'pokemon.equip', id: 'bulbasaur' }, now),
    /Unlist/,
  );
  assert.throws(() => applyAction(listed, { type: 'pokemon.redeem', id: 'bulbasaur' }, now));
  const unlisted = applyAction(listed, { type: 'pokemon.unlist', id: 'bulbasaur' }, now);
  const redeemed = applyAction(unlisted, { type: 'pokemon.redeem', id: 'bulbasaur' }, now);
  assert.equal(
    redeemed.pokemon.find((p) => p.id === 'bulbasaur'),
    undefined,
  );
  assert.ok(redeemed.discovered.includes(1));
  assert.equal(redeemed.coins.find((c) => c.id === 'bulb')!.vault, 5.64);
  assert.equal(totalFunded(initial) - totalFunded(redeemed), 80_000_000);
  assert.throws(() =>
    applyAction(initial, { type: 'pokemon.list', id: 'partner', amount: 1 }, now),
  );
});
test('support moves one actual inventory contribution between gyms, ignoring listing prices', () => {
  const initial = createInitialState(now),
    value = collectionValue(initial),
    before = gymRankings(initial);
  let next = applyAction(initial, { type: 'pokemon.list', id: 'gengar', amount: 9999 }, now);
  assert.equal(collectionValue(next), value);
  next = applyAction(next, { type: 'gym.support', id: 'geng' }, now);
  const after = gymRankings(next);
  assert.ok(
    Math.abs(
      before.find((g) => g.coinId === 'char')!.score -
        after.find((g) => g.coinId === 'char')!.score -
        value,
    ) < 1e-10,
  );
  assert.ok(
    Math.abs(
      after.find((g) => g.coinId === 'geng')!.score -
        before.find((g) => g.coinId === 'geng')!.score -
        value,
    ) < 1e-10,
  );
  assert.throws(() => applyAction(initial, { type: 'gym.support', id: 'snorlax' }, now), /active/);
  assert.throws(() => applyAction(initial, { type: 'gym.support', id: 'bulb' }, now), /Hold/);
});
test('starter eligibility is strictly above 1% and future value is funded', () => {
  const initial = createInitialState(now);
  initial.profile.starterChosen = false;
  initial.coins.find((c) => c.main)!.holding = 1e7;
  assert.throws(
    () => applyAction(initial, { type: 'starter.choose', speciesId: 25 }, now),
    /above 1%/,
  );
  initial.coins.find((c) => c.main)!.holding = 1e7 + 1;
  const next = applyAction(initial, { type: 'starter.choose', speciesId: 25 }, now),
    starter = next.pokemon.at(-1)!;
  assert.equal(starter.speciesId, 25);
  assert.equal(starter.backing, 0);
  assert.equal(starter.evolutionReserve, 0.02);
  assert.equal(starter.starter, true);
  assert.equal(totalFunded(next), totalFunded(initial));
  starter.rareCandy = EVOLUTION_CANDY;
  const evolved = applyAction(next, { type: 'pokemon.evolve', id: starter.id }, now).pokemon.find(
    (p) => p.id === starter.id,
  )!;
  assert.equal(evolved.backing, 0.02);
  assert.equal(evolved.starter, false);
  assert.throws(() => applyAction(next, { type: 'starter.choose', speciesId: 1 }, now), /already/);
});
test('coin launches require an owned eligible instance, support an independent image and safe social links', () => {
  const s = createInitialState(now);
  const action: Action = {
    type: 'coin.create',
    name: 'Squirtle Club',
    ticker: 'SC',
    description: 'Test club',
    pokemonInstanceId: 'blastoise',
    mode: 'Mixed',
    image: 'data:image/png;base64,AAAA',
    socials: { website: 'https://example.com', x: 'https://x.com/trainer' },
  };
  const next = applyAction(s, action, now),
    coin = next.coins[0];
  assert.equal(coin.pokemonId, 9);
  assert.equal(coin.launchPokemonId, 'blastoise');
  assert.equal(coin.image, action.image);
  assert.equal(coin.socials?.website, 'https://example.com/');
  assert.equal(coin.vault, 0);
  assert.ok(gymRankings(next).some((g) => g.coin.id === coin.id && g.score === 0));
  assert.throws(
    () => applyAction(s, { ...action, pokemonInstanceId: 'not-owned' }, now),
    /no longer/,
  );
  assert.throws(
    () => applyAction(s, { ...action, pokemonInstanceId: undefined }, now),
    /Choose a Pokémon/,
  );
  assert.throws(
    () => applyAction(s, { ...action, socials: { website: 'javascript:alert(1)' } }, now),
    /http/,
  );
  assert.throws(
    () => applyAction(s, { ...action, image: 'data:image/svg+xml;base64,AAAA' }, now),
    /PNG/,
  );
  s.pokemon.find((p) => p.id === 'blastoise')!.listed = 0.4;
  assert.throws(() => applyAction(s, action, now), /Unlist/);
  s.pokemon = [];
  const trainer = applyAction(s, { ...action, pokemonInstanceId: undefined }, now).coins[0];
  assert.equal(trainer.launchKind, 'trainer');
  assert.equal(trainer.pokemonId, 0);
  assert.equal(trainer.trainer?.character, s.profile.character);
});
test('profile defaults to pixel style and legacy saves migrate without minting evolution backing', () => {
  let s = createInitialState(now);
  assert.equal(s.profile.artStyle, 'pixel');
  assert.equal(profileName(s), '7kPj…N4mQ');
  s = applyAction(
    s,
    { type: 'profile.update', patch: { displayName: ' Ash ', artStyle: 'drawn' } },
    now,
  );
  assert.equal(profileName(s), 'Ash');
  assert.equal(s.profile.artStyle, 'drawn');
  assert.throws(() =>
    applyAction(s, { type: 'profile.update', patch: { displayName: 'a'.repeat(25) } }, now),
  );
  const old = JSON.parse(JSON.stringify(createInitialState(now)));
  old.version = 1;
  delete old.profile.artStyle;
  for (const p of old.pokemon) {
    p.stardust = p.rareCandy;
    delete p.rareCandy;
    delete p.evolutionReserve;
    delete p.moveOffers;
  }
  for (const r of old.rewards) delete r.evolutionReserve;
  const migrated = migrateSnapshot(old)!;
  assert.equal(migrated.version, 2);
  assert.equal(migrated.profile.artStyle, 'pixel');
  assert.equal(migrated.pokemon[0].rareCandy, 420);
  assert.equal(migrated.pokemon[0].evolutionReserve, 0);
  assert.deepEqual(migrated.coins, old.coins);
  assert.equal(migrateSnapshot({ version: 1 }), null);
});
test('all 151 Kanto species and offered moves resolve to catalogue entries', () => {
  assert.deepEqual(
    POKEMON.map((p) => p.id),
    Array.from({ length: 151 }, (_, i) => i + 1),
  );
  for (const p of POKEMON)
    for (const next of p.evolvesTo) assert.ok(POKEMON.some((p) => p.id === next));
  for (const moves of Object.values(MOVE_OPTIONS))
    for (const name of moves)
      assert.ok(
        MOVES.some((m) => m.name === name),
        name,
      );
});
