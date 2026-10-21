import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/data/demo';
import { applyAction } from '../src/state/model';
import { migrateSnapshot } from '../src/services/api';
import {
  compareBattlePokemon,
  comparePokemonStrength,
  pokemonStrength,
  variantDiscoveries,
  demoPokemonCatalogue,
} from '../src/state/collection';
import { getPokemonStats } from '../src/data/stats';
import { pokemonRewardValue } from '../src/data/rewardPools';
const now = Date.UTC(2026, 9, 21, 12);

test('favourites are per instance and persist across demo save reloads', () => {
  const state = createInitialState(now),
    original = state.pokemon[0],
    copy = { ...original, id: 'second-instance' };
  state.pokemon.push(copy);
  const next = applyAction(
    state,
    { type: 'pokemon.favourite', id: original.id, favourite: true },
    now,
  );
  assert.equal(next.pokemon.find((p) => p.id === original.id)?.favourite, true);
  assert.equal(!!next.pokemon.find((p) => p.id === copy.id)?.favourite, false);
  assert.equal(!!state.pokemon[0].favourite, false);
  const saved = migrateSnapshot(JSON.parse(JSON.stringify(next)))!;
  assert.equal(saved.pokemon.find((p) => p.id === original.id)?.favourite, true);
  const unstarred = applyAction(
    saved,
    { type: 'pokemon.favourite', id: original.id, favourite: false },
    now,
  );
  assert.equal(unstarred.pokemon.find((p) => p.id === original.id)?.favourite, false);
  assert.throws(
    () => applyAction(state, { type: 'pokemon.favourite', id: 'not-owned', favourite: true }, now),
    /inventory/,
  );
});

test('battle ordering prioritises favourites then actual stat strength, never SOL or shininess', () => {
  const template = createInitialState(now).pokemon[0];
  const weak = { ...template, id: 'weak', speciesId: 10, level: 5, backing: 999, favourite: false };
  const strong = {
    ...template,
    id: 'strong',
    speciesId: 150,
    level: 70,
    backing: 0.01,
    favourite: false,
  };
  const favourite = { ...weak, id: 'favourite', favourite: true };
  const shiny = { ...strong, id: 'shiny', shiny: true, backing: 10000 };
  assert.equal(
    pokemonStrength(strong),
    Object.values(getPokemonStats(strong)).reduce((a, b) => a + b, 0),
  );
  assert.equal(pokemonStrength(strong), pokemonStrength(shiny));
  assert.ok(comparePokemonStrength(strong, weak) < 0);
  assert.deepEqual(
    [weak, strong, favourite].sort(compareBattlePokemon).map((p) => p.id),
    ['favourite', 'strong', 'weak'],
  );
  assert.deepEqual(
    [strong, favourite, weak].sort(comparePokemonStrength).map((p) => p.id),
    ['strong', 'favourite', 'weak'],
  );
});

test('variant records survive evolution and redemption without converting unknown records', () => {
  const state = createInitialState(now);
  const eevee = state.pokemon.find((p) => p.speciesId === 133)!;
  state.pokemon = [{ ...eevee, shiny: true, rareCandy: 1100 }];
  state.discovered = [133, 151];
  state.discoveredVariants = undefined;
  state.activity = [];
  state.rewards = [];
  const evolved = applyAction(state, { type: 'pokemon.evolve', id: eevee.id }, now, () => 0);
  const evolvedId = evolved.pokemon[0].speciesId;
  assert.ok([134, 135, 136].includes(evolvedId));
  assert.deepEqual(variantDiscoveries(evolved), {
    normal: [],
    shiny: [133, evolvedId].sort((a, b) => a - b),
    unknown: [151],
  });
  const redeemed = applyAction(evolved, { type: 'pokemon.redeem', id: eevee.id }, now);
  assert.equal(redeemed.pokemon.length, 0);
  assert.deepEqual(variantDiscoveries(redeemed), variantDiscoveries(evolved));
  assert.deepEqual(
    migrateSnapshot(JSON.parse(JSON.stringify(redeemed)))?.discoveredVariants,
    variantDiscoveries(evolved),
  );
});

test('legacy local migration reconstructs explicit opened variants and keeps species-only history unknown', () => {
  const state = createInitialState(now);
  state.pokemon = [];
  state.discovered = [1, 25, 150];
  state.discoveredVariants = undefined;
  state.activity = [];
  state.rewards = [
    { ...state.rewards[0], id: 'known-shiny', openedAt: now, outcomeSpeciesId: 25, shiny: true },
    {
      ...state.rewards[0],
      id: 'legacy-unknown',
      openedAt: now,
      outcomeSpeciesId: 150,
      shiny: undefined,
    },
  ];
  const result = migrateSnapshot(state)!;
  assert.deepEqual(result.discoveredVariants, { normal: [], shiny: [25], unknown: [1, 150] });
  assert.deepEqual(migrateSnapshot(result)?.discoveredVariants, result.discoveredVariants);
});

test('demo catalogue reference totals include every species and never rewrite owned backing', () => {
  const state = createInitialState(now),
    before = state.pokemon.map((p) => p.backing),
    catalogue = demoPokemonCatalogue();
  assert.equal(catalogue.entries.length, 151);
  assert.equal(new Set(catalogue.entries.map((e) => e.speciesId)).size, 151);
  for (const key of ['normal', 'shiny'] as const) {
    const sum = catalogue.entries.reduce(
      (n, e) => n + Math.round((key === 'normal' ? e.normalValue : e.shinyValue) * 1e9),
      0,
    );
    assert.equal(Math.round(catalogue.totals[key] * 1e9), sum);
  }
  assert.equal(
    catalogue.entries.find((e) => e.speciesId === 151)?.shinyValue,
    pokemonRewardValue(151, true),
  );
  assert.deepEqual(
    migrateSnapshot(state)?.pokemon.map((p) => p.backing),
    before,
  );
});
