import test from 'node:test';
import assert from 'node:assert/strict';
import { monetaryBattleResult } from '../src/battle/result';
import type { BattleRoom } from '../src/services/battles';

test('combat victory never claims a monetary payout before escrow confirmation', () => {
  const room = { wager: 'sol', status: 'finished', state: { winner: 'player' } } as BattleRoom;
  assert.match(monetaryBattleResult(room), /syncing/);
  for (const status of ['funded', 'funding', 'settling'] as const) {
    room.escrow = { status } as BattleRoom['escrow'];
    assert.match(monetaryBattleResult(room), /pending confirmation/);
    assert.doesNotMatch(monetaryBattleResult(room), /are confirmed/);
  }
  room.escrow = { status: 'settled' } as BattleRoom['escrow'];
  assert.match(monetaryBattleResult(room), /winnings are confirmed/);
  room.state!.winner = 'rival';
  assert.match(monetaryBattleResult(room), /rival is confirmed/);
  room.state!.winner = 'draw';
  assert.match(monetaryBattleResult(room), /return is confirmed/);
  room.escrow!.status = 'refund-available';
  assert.match(monetaryBattleResult(room), /reclaim your deposit/);
  room.escrow!.status = 'refunded';
  assert.match(monetaryBattleResult(room), /refund is confirmed/);
});
