import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/data/demo';
import { migrateSnapshot } from '../src/services/api';
import { applyAction } from '../src/state/model';
const now = Date.UTC(2026, 9, 22, 15);
test('legacy saves automatically select the first acquired Pokémon and preserve a valid choice', () => {
  const state = createInitialState(now);
  const first = [...state.pokemon].sort((a, b) => a.acquiredAt - b.acquiredAt)[0];
  state.profile.equippedId = null;
  assert.equal(migrateSnapshot(state, now)!.profile.equippedId, first.id);
  state.profile.equippedId = 'no-longer-owned';
  assert.equal(migrateSnapshot(state, now)!.profile.equippedId, first.id);
  state.profile.equippedId = state.pokemon[1].id;
  state.pokemon[1].locked = true;
  state.pokemon[1].health = 0;
  assert.equal(migrateSnapshot(state, now)!.profile.equippedId, state.pokemon[1].id);
});
test('first reward becomes the partner and later rewards or starters preserve the chosen partner', () => {
  const state = createInitialState(now);
  state.pokemon = [];
  state.profile.equippedId = null;
  state.rewards.forEach((r) => (r.readyAt = now));
  const opened = applyAction(state, { type: 'reward.open', id: state.rewards[0].id }, now, () => 0);
  assert.equal(opened.profile.equippedId, opened.pokemon[0].id);
  const second = applyAction(
    opened,
    { type: 'reward.open', id: state.rewards[1].id },
    now + 1,
    () => 0,
  );
  assert.equal(second.profile.equippedId, opened.profile.equippedId);
  second.profile.starterChosen = false;
  const starter = applyAction(second, { type: 'starter.choose', speciesId: 4 }, now + 2, () => 0);
  assert.equal(starter.profile.equippedId, opened.profile.equippedId);
});
test('selling a partner selects another and an empty inventory has no invented partner', () => {
  const state = createInitialState(now);
  state.pokemon = state.pokemon.slice(0, 2).map((p) => ({ ...p, starter: false, locked: false }));
  state.profile.equippedId = state.pokemon[0].id;
  const sold = applyAction(state, { type: 'pokemon.redeem', id: state.pokemon[0].id }, now);
  assert.equal(sold.profile.equippedId, state.pokemon[1].id);
  assert.throws(() => applyAction(sold, { type: 'pokemon.equip', id: '' }, now));
  const empty = applyAction(sold, { type: 'pokemon.redeem', id: state.pokemon[1].id }, now);
  assert.equal(empty.profile.equippedId, null);
});
