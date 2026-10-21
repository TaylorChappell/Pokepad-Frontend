import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GYM_MANUALS,
  drawGymManual,
  gymPrize,
  manualDropChance,
  manualPool,
} from '../src/game/gym-policy';
import { moveByName } from '../src/data/moves';
import { createInitialState } from '../src/data/demo';
import { applyAction } from '../src/state/model';
test('manual reward tiers contain supported moves and never guarantee a drop; every win is one badge', () => {
  assert.equal(new Set(GYM_MANUALS.map((m) => m.move)).size, 30);
  for (const m of GYM_MANUALS) assert.equal(moveByName(m.move).name, m.move);
  for (const [strength, size, chance] of [
    [1199, 0, 0],
    [1200, 10, 0.25],
    [1800, 20, 0.4],
    [2400, 30, 0.6],
  ]) {
    assert.equal(manualPool(strength).length, size);
    assert.equal(manualDropChance(strength), chance);
    assert.equal(gymPrize(strength).badges, 1);
    assert.equal(
      drawGymManual(strength, () => chance),
      null,
    );
    if (size) {
      let draws = [chance - 0.001, 0.99999];
      assert.equal(
        drawGymManual(strength, () => draws.shift()!),
        manualPool(strength).at(-1)!.move,
      );
    }
  }
  assert.equal(
    drawGymManual(0, () => {
      throw Error('Weak gym cannot roll');
    }),
    null,
  );
});
test('demo manuals consume one copy only after valid learning, with a required replacement for full movesets', () => {
  const s = createInitialState(),
    p = s.pokemon[0];
  p.moves = ['Tackle', 'Growl', 'Ember', 'Scratch'];
  p.locked = false;
  s.gymProgress!.manuals = { Rest: 1 };
  assert.throws(() => applyAction(s, { type: 'pokemon.manual', id: p.id, move: 'Rest' }), /forget/);
  assert.equal(s.gymProgress!.manuals.Rest, 1);
  assert.throws(
    () => applyAction(s, { type: 'pokemon.manual', id: p.id, move: 'Psychic', slot: 0 }),
    /do not have/,
  );
  const next = applyAction(s, { type: 'pokemon.manual', id: p.id, move: 'Rest', slot: 2 });
  assert.equal(next.pokemon[0].moves[2], 'Rest');
  assert.equal(next.gymProgress!.manuals.Rest, 0);
  assert.throws(
    () =>
      applyAction(next, { type: 'pokemon.manual', id: next.pokemon[1].id, move: 'Rest', slot: 0 }),
    /do not have/,
  );
});
