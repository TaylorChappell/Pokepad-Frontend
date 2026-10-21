import test from 'node:test';
import assert from 'node:assert/strict';
import { completeGymDefenders, GYM_PARTNER_LEVEL } from '../src/game/gym-defenders';
import { getPokemonStats } from '../src/data/stats';
import type { GymDefender } from '../src/game/gym-policy';
import { createInitialState } from '../src/data/demo';
import { gymRankings } from '../src/state/gyms';
const defender: GymDefender = {
  id: 'owned-1',
  speciesId: 1,
  level: 30,
  shiny: false,
  moves: ['Tackle'],
  strength: 300,
  trainerWallet: 'holder',
  trainerName: 'Holder',
};
const coin = { id: 'test-gym', launchKind: 'pokemon', pokemonId: 25, pokemonShiny: true };
test('only one paired Pokémon joins an incomplete gym defence without replacing supporters or creating ownership', () => {
  for (const count of [0, 1, 2, 3]) {
    const supporters = Array.from({ length: count }, (_, i) => ({ ...defender, id: 'owned-' + i }));
    const team = completeGymDefenders(supporters, coin);
    assert.equal(team.length, Math.min(3, count + 1));
    assert.equal(team.filter((p) => p.source === 'partner').length, count < 3 ? 1 : 0);
    assert.equal(new Set(team.map((p) => p.id)).size, team.length);
    assert.deepEqual(team.slice(0, count), supporters);
    assert.equal(supporters.length, count);
    for (const fallback of team.slice(count)) {
      assert.equal(fallback.speciesId, 25);
      assert.equal(fallback.shiny, true);
      assert.equal(fallback.level, GYM_PARTNER_LEVEL);
      assert.equal(fallback.source, 'partner');
      assert.equal(fallback.trainerWallet, '');
      assert.equal(
        fallback.strength,
        Object.values(getPokemonStats(fallback)).reduce((a, b) => a + b, 0),
      );
      assert.ok(fallback.moves.length > 0 && fallback.moves.length <= 4);
    }
    assert.deepEqual(completeGymDefenders(supporters, coin), team, 'Team IDs and stats are stable');
  }
});
test('unpaired and invalid pairs keep real defenders only; live views are not fabricated', () => {
  for (const unpaired of [
    { ...coin, launchKind: 'trainer' },
    { ...coin, pokemonId: 0 },
    { ...coin, pokemonId: 999 },
  ]) {
    assert.deepEqual(completeGymDefenders([], unpaired), []);
    assert.deepEqual(completeGymDefenders([defender], unpaired), [defender]);
  }
  const state = createInitialState();
  state.coins = [{ ...state.coins[0], ...coin, active: true }];
  assert.equal(gymRankings(state)[0].defenders.length, 1);
  state.gyms = [];
  assert.equal(gymRankings(state)[0].defenders.length, 0);
});
