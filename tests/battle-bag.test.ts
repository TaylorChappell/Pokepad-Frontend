import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/data/demo';
import {
  createBattle,
  createPlayerTeam,
  resolveTurn,
  chooseRivalAction,
} from '../src/battle/engine';
import { battleBag, legalBattleItem, prepareBattleTeam } from '../src/battle/rules';
const calm = () => 0.5;
function match() {
  const team = createInitialState()
    .pokemon.slice(0, 3)
    .map((pokemon, index) => ({ ...pokemon, id: 'p-' + index, moves: ['Growl'], level: 30 }));
  const rival = createPlayerTeam(
    team.map((pokemon, index) => ({ ...pokemon, id: 'r-' + index, moves: ['Growl'] })),
  );
  return createBattle(team, rival, 'Medium');
}
test('items consume a turn and one supply, preserve snapshots, and cannot affect illegal targets', () => {
  const initial = match();
  initial.player[1].hp = 0;
  initial.player[1].status = 'poison';
  const before = JSON.stringify(initial),
    pp = [...initial.player[0].pp];
  const next = resolveTurn(initial, { kind: 'item', item: 'revive', index: 1 }, calm);
  assert.equal(next.turn, 2);
  assert.equal(next.bags!.player.revive, 0);
  assert.equal(next.player[1].hp, Math.floor(next.player[1].stats.hp * 0.5));
  assert.equal(next.player[1].status, 'none');
  assert.deepEqual(next.player[0].pp, pp);
  assert.ok(
    next.events.some((event) => event.kind === 'move' && event.side === 'rival'),
    'Opponent still takes its action',
  );
  assert.ok(
    next.events.some((event) => event.kind === 'item' && event.frame?.bags?.player.revive === 0),
  );
  assert.equal(JSON.stringify(initial), before);
  assert.equal(resolveTurn(next, { kind: 'item', item: 'revive', index: 1 }, calm), next);
  assert.equal(legalBattleItem(initial, 'player', 'potion', 1), false);
  assert.equal(legalBattleItem(initial, 'player', 'potion', -1), false);
  initial.replacementRequired.player = true;
  assert.equal(legalBattleItem(initial, 'player', 'revive', 1), false);
});
test('potions, cures and the bot obey the same bag limits and charged turns cannot be bypassed', () => {
  let current = match();
  current.player[0].hp = 1;
  const healed = resolveTurn(current, { kind: 'item', item: 'potion', index: 0 }, calm);
  assert.equal(healed.player[0].hp, 1 + Math.floor(current.player[0].stats.hp * 0.3));
  assert.equal(healed.bags!.player.potion, 1);
  healed.player[1].status = 'sleep';
  healed.player[1].statusTurns = 3;
  const cured = resolveTurn(healed, { kind: 'item', item: 'full-heal', index: 1 }, calm);
  assert.equal(cured.player[1].status, 'none');
  assert.equal(cured.player[1].statusTurns, 0);
  assert.equal(cured.bags!.player['full-heal'], 0);
  current.rival[0].hp = 1;
  current.rival[0].trapped = 1;
  assert.deepEqual(chooseRivalAction(current, calm), { kind: 'item', item: 'potion', index: 0 });
  current.rival[0].charging = 'Solar Beam';
  assert.equal(legalBattleItem(current, 'rival', 'potion', 0), false);
  current.bags!.player = battleBag({ items: 'none', levels: 'original' });
  assert.equal(legalBattleItem(current, 'player', 'potion', 0), false);
});
test('equal levels change battle snapshots only and preserve the initial health proportion', () => {
  const team = match().player;
  team[0].hp = Math.floor(team[0].stats.hp / 2);
  const original = JSON.stringify(team);
  const equal = prepareBattleTeam(team, { items: 'standard', levels: 'level50' });
  assert.ok(equal.every((pokemon) => pokemon.level === 50));
  assert.ok(Math.abs(equal[0].hp / equal[0].stats.hp - team[0].hp / team[0].stats.hp) < 0.02);
  assert.equal(JSON.stringify(team), original);
});

test('item effects stay on the treated active Pokémon and never appear on the wrong bench target', async () => {
  const { getBattleCue, createBattlePlayback } = await import('../src/battle/presentation');
  const initial = match();
  initial.player[0].hp = 1;
  const healed = resolveTurn(initial, { kind: 'item', item: 'potion', index: 0 }, calm);
  const event = healed.events.find((event) => event.kind === 'item')!;
  assert.equal(getBattleCue(event)?.targetSide, 'player');
  const bench = { ...event, itemTargetId: initial.player[1].id };
  assert.equal(getBattleCue(bench), null);
  const frame = createBattlePlayback(initial, { ...healed, events: [bench] })[0];
  assert.equal(frame.durationMs, 850);
});
