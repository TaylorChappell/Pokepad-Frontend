import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattleClient, newestBattleRoom, type BattleRoom } from '../src/services/battles';
import type { ApiRequestOptions } from '../src/services/http';
import type { BattleAction } from '../src/battle/engine';

function transport() {
  const calls: { path: string; options?: ApiRequestOptions }[] = [];
  const request = async <T>(path: string, options?: ApiRequestOptions): Promise<T> => {
    calls.push({ path, options });
    return { id: 'room', revision: 2, submitted: true, state: null } as T;
  };
  return { api: createBattleClient(request), calls };
}

test('online commands send only an intent, server turn and retry ID; never a client winner or engine state', async () => {
  const { api, calls } = transport();
  const action = { kind: 'move', index: 1, winner: 'player', state: { hp: 999 } } as BattleAction;
  const reply = await api.command('room', 8, action, 'same-request');
  await api.command('room', 8, action, 'same-request');
  assert.equal(reply.submitted, true);
  assert.deepEqual(calls[0].options?.json, {
    turn: 8,
    phase: 'turn',
    action: { kind: 'move', index: 1 },
    requestId: 'same-request',
  });
  assert.deepEqual(calls[1].options?.json, calls[0].options?.json);
  assert.equal(calls[0].path, '/v1/battles/room/commands');
});

test('room creation and joining declare the same wager format and explicit Pokémon transfer consent', async () => {
  const { api, calls } = transport();
  await api.create(['one', 'two', 'three'], 'pokemon', 'invite', 'new-room-request');
  await api.join('room', ['four', 'five', 'six'], 'pokemon', 'private-invitation');
  assert.deepEqual(calls[0].options?.json, {
    pokemonIds: ['one', 'two', 'three'],
    wager: 'pokemon',
    visibility: 'invite',
    requestId: 'new-room-request',
    acceptPokemonRisk: true,
  });
  assert.deepEqual(calls[1].options?.json, {
    pokemonIds: ['four', 'five', 'six'],
    wager: 'pokemon',
    acceptPokemonRisk: true,
    inviteCode: 'private-invitation',
  });
  await api.create(['one'], 'friendly', 'public', 'friendly-request');
  assert.equal((calls[2].options?.json as { acceptPokemonRisk: boolean }).acceptPokemonRisk, false);
});

test('a stale reconnect poll cannot unlock an already submitted command or overwrite a settled result', () => {
  const current = { id: 'room', revision: 8, submitted: true, status: 'active' } as BattleRoom;
  const stale = { ...current, revision: 7, submitted: false };
  assert.equal(newestBattleRoom(current, stale), current);
  const settled = {
    ...current,
    revision: 10,
    status: 'finished',
    winnerWallet: 'winner',
  } as BattleRoom;
  assert.equal(newestBattleRoom(current, settled), settled);
  assert.equal(newestBattleRoom(settled, current), settled);
});

test('reconnect reads are abortable and forfeit sends no fabricated outcome', async () => {
  const { api, calls } = transport();
  const controller = new AbortController();
  await api.read('room', controller.signal);
  await api.leave('room');
  assert.equal(calls[0].options?.signal, controller.signal);
  assert.deepEqual(calls[1].options?.json, {});
  assert.equal(calls[1].path, '/v1/battles/room/leave');
});

test('a forced replacement command keeps its phase distinct from a normal move on the same turn', async () => {
  const { api, calls } = transport();
  await api.command('room', 8, { kind: 'replace', index: 2 }, 'replacement-request', 'replacement');
  assert.deepEqual(calls[0].options?.json, {
    turn: 8,
    phase: 'replacement',
    action: { kind: 'replace', index: 2 },
    requestId: 'replacement-request',
  });
});

test('review acceptance binds the viewed version and item commands send no fabricated supplies', async () => {
  const { api, calls } = transport();
  await api.ready('room', 3, true, 'sol');
  assert.deepEqual(calls[0].options?.json, {
    version: 3,
    accepted: true,
    acceptPokemonRisk: false,
    acceptMonetaryRisk: true,
  });
  await api.propose('room', 3, { rules: { items: 'none', levels: 'level50' } });
  assert.deepEqual(calls[1].options?.json, {
    version: 3,
    rules: { items: 'none', levels: 'level50' },
  });
  await api.command(
    'room',
    1,
    { kind: 'item', item: 'revive', index: 2, quantity: 999 } as BattleAction,
    'item-request',
  );
  assert.deepEqual(calls[2].options?.json, {
    turn: 1,
    phase: 'turn',
    action: { kind: 'item', item: 'revive', index: 2 },
    requestId: 'item-request',
  });
});
