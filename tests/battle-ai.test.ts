import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/data/demo';
import {
  createBattle,
  createPlayerTeam,
  chooseRivalAction,
  chooseRivalReplacement,
} from '../src/battle/engine';
import { battleBag } from '../src/battle/rules';
function duel(
  playerSpecies: number,
  playerMoves: string[],
  rivalSpecies: number[],
  rivalMoves: string[][],
) {
  const base = createInitialState().pokemon[0];
  const player = rivalSpecies.map((_, i) => ({
    ...base,
    id: 'player-' + i,
    speciesId: playerSpecies,
    level: 50,
    moves: playerMoves,
    health: 9999,
  }));
  const rival = createPlayerTeam(
    rivalSpecies.map((id, i) => ({
      ...base,
      id: 'rival-' + i,
      speciesId: id,
      level: 50,
      moves: rivalMoves[i],
      health: 9999,
    })),
  );
  return createBattle(player, rival, 'Master');
}
test('AI takes a reliable knockout and does not consume the combat RNG', () => {
  const state = duel(7, ['Tackle'], [25, 4], [['Thunderbolt', 'Growl'], ['Ember']]);
  state.player[0].hp = 1;
  const before = JSON.stringify(state);
  assert.deepEqual(
    chooseRivalAction(state, () => {
      throw Error('AI must not see combat RNG');
    }),
    { kind: 'move', index: 0 },
  );
  assert.equal(JSON.stringify(state), before);
});
test('AI switches out of a losing type matchup, respects traps, and chooses a strong replacement', () => {
  const state = duel(9, ['Surf'], [4, 3, 25], [['Ember'], ['Razor Leaf'], ['Thunderbolt']]);
  state.bags!.rival = battleBag({ items: 'none', levels: 'original' });
  state.turn = 4;
  state.lastRivalSwitch = 0;
  const action = chooseRivalAction(state);
  assert.equal(action.kind, 'switch');
  assert.notEqual(action.index, 0);
  state.rival[0].trapped = 1;
  assert.equal(chooseRivalAction(state).kind, 'move');
  state.rival[0].hp = 0;
  const index = chooseRivalReplacement(state);
  assert.ok(index === 1 || index === 2);
  assert.ok(state.rival[index].hp > 0);
});
test('AI heals when it can survive and revives a useful reserve with the same finite item budget', () => {
  const healing = duel(7, ['Growl'], [25], [['Growl']]);
  healing.rival[0].hp = 1;
  assert.deepEqual(chooseRivalAction(healing), { kind: 'item', item: 'potion', index: 0 });
  healing.bags!.rival.potion = 0;
  assert.equal(chooseRivalAction(healing).kind, 'move');
  const revive = duel(9, ['Growl'], [129, 25, 4], [['Splash'], ['Thunderbolt'], ['Ember']]);
  revive.rival[1].hp = 0;
  revive.rival[2].hp = 0;
  assert.deepEqual(chooseRivalAction(revive), { kind: 'item', item: 'revive', index: 1 });
});
