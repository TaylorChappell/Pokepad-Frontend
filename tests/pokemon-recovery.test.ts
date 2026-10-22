import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/data/demo';
import { applyAction } from '../src/state/model';
import { migrateSnapshot } from '../src/services/api';
import { getPokemonHealth, getPokemonStats } from '../src/data/stats';
import { DEMO_RECOVERY_MS } from '../src/state/recovery';
import { gymPrize } from '../src/game/gym-policy';

const now = Date.UTC(2026, 9, 22, 12);
test('server deadlines project full health exactly at expiry, but never while locked', () => {
  const p = {
    ...createInitialState(now).pokemon[0],
    health: 0,
    recoverAt: now + 1000,
    locked: false,
  };
  assert.equal(getPokemonHealth(p, now).current, 0);
  assert.equal(getPokemonHealth(p, now).remainingMs, 1000);
  assert.equal(getPokemonHealth(p, now + 999).current, 0);
  assert.equal(getPokemonHealth(p, now + 1000).current, getPokemonStats(p).hp);
  assert.equal(getPokemonHealth({ ...p, locked: true }, now + 1000).current, 0);
  for (const recoverAt of [null, undefined, NaN, -1]) {
    assert.equal(getPokemonHealth({ ...p, recoverAt }, now).current, 0);
    assert.equal(getPokemonHealth({ ...p, recoverAt }, now).remainingMs, null);
  }
});

test('demo gym injuries persist one deadline across replay and reload, then recover completely', () => {
  const state = createInitialState(now),
    p = state.pokemon[0];
  p.locked = false;
  const result = {
    type: 'gym.demo.finish' as const,
    id: 'recovery-match',
    coinId: 'char',
    strength: 0,
    prize: gymPrize(0),
    winner: false,
    health: [{ id: p.id, hp: 0 }],
  };
  const injured = applyAction(state, result, now);
  assert.equal(injured.pokemon[0].health, 0);
  assert.equal(injured.pokemon[0].recoverAt, now + DEMO_RECOVERY_MS);
  const replay = applyAction(injured, result, now + 20000);
  assert.equal(replay.pokemon[0].recoverAt, injured.pokemon[0].recoverAt);
  const reload = migrateSnapshot(JSON.parse(JSON.stringify(replay)), now + 60000)!;
  assert.equal(reload.pokemon[0].health, 0);
  assert.equal(reload.pokemon[0].recoverAt, injured.pokemon[0].recoverAt);
  const recovered = applyAction(reload, { type: 'sync' }, now + DEMO_RECOVERY_MS);
  assert.equal(recovered.pokemon[0].health, getPokemonStats(p).hp);
  assert.equal(recovered.pokemon[0].recoverAt, undefined);
  assert.equal(
    applyAction(recovered, result, now + DEMO_RECOVERY_MS + 1).pokemon[0].health,
    getPokemonStats(p).hp,
  );
});

test('Revive consumes one owned item, restores half HP, and keeps the original full-recovery deadline', () => {
  const state = createInitialState(now),
    p = state.pokemon[0];
  Object.assign(p, { health: 0, recoverAt: now + DEMO_RECOVERY_MS, locked: false });
  state.bag!.revive = 1;
  const action = { type: 'pokemon.item' as const, id: p.id, item: 'revive' as const };
  const revived = applyAction(state, action, now + 1000);
  assert.equal(revived.bag!.revive, 0);
  assert.equal(revived.pokemon[0].health, Math.max(1, Math.floor(getPokemonStats(p).hp / 2)));
  assert.equal(revived.pokemon[0].recoverAt, p.recoverAt);
  assert.throws(() => applyAction(revived, action, now + 2000), /cannot be used/);
  assert.throws(() => applyAction(state, action, now + DEMO_RECOVERY_MS), /cannot be used/);
  assert.equal(state.bag!.revive, 1);
  const recovered = applyAction(revived, { type: 'sync' }, now + DEMO_RECOVERY_MS);
  assert.equal(recovered.pokemon[0].health, getPokemonStats(p).hp);
});

test('legacy demo injuries receive one recovery deadline and expired saves heal on load', () => {
  const state = createInitialState(now),
    p = state.pokemon[0];
  p.health = 0;
  p.locked = false;
  const migrated = migrateSnapshot(state, now)!;
  assert.equal(migrated.pokemon[0].recoverAt, now + DEMO_RECOVERY_MS);
  assert.equal(migrateSnapshot(migrated, now + 1000)!.pokemon[0].recoverAt, now + DEMO_RECOVERY_MS);
  const expired = migrateSnapshot(migrated, now + DEMO_RECOVERY_MS)!;
  assert.equal(expired.pokemon[0].health, getPokemonStats(p).hp);
  assert.equal(expired.pokemon[0].recoverAt, undefined);
});
