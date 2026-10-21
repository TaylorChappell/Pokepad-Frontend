import test from 'node:test';
import assert from 'node:assert/strict';
import bs58 from 'bs58';
import { createBattleClient, monetaryTerms, battleWagerLabel } from '../src/services/battles';
import { BattleFundingController, type FundingRecord } from '../src/services/battle-funding';
import { ApiError, type apiRequest, type ApiRequestOptions } from '../src/services/http';
const signature = bs58.encode(new Uint8Array(64).fill(8));
const prepared = {
  intentId: 'deposit-intent',
  transactionBase64: 'AA==',
  blockhash: 'block',
  lastValidBlockHeight: 100,
  chain: 'solana:devnet' as const,
  status: 'prepared',
};
function memory() {
  let value: FundingRecord | null = null;
  return {
    load: () => (value ? structuredClone(value) : null),
    save: (_wallet: string, _room: string, next: FundingRecord | null) => {
      value = next ? structuredClone(next) : null;
    },
  };
}
test('SOL and token rooms echo reviewed exact raw terms and explicit monetary consent on join', async () => {
  const calls: { path: string; options?: ApiRequestOptions }[] = [];
  const client = createBattleClient((async (path, options) => {
    calls.push({ path, options });
    return {};
  }) as typeof apiRequest);
  const sol = monetaryTerms('sol', '0.100000001')!;
  assert.deepEqual(sol, { wagerAmount: '100000001' });
  const token = monetaryTerms('token', '9007199254740993.000001', {
    mint: 'verified-mint',
    decimals: 6,
  })!;
  assert.equal(token.wagerAmount, '9007199254740993000001');
  await client.create(['pokemon-1'], 'token', 'invite', 'operation-1', token);
  await client.join('room-1', ['pokemon-2'], 'token', 'secret-code', token);
  assert.deepEqual(calls[0].options?.json, {
    pokemonIds: ['pokemon-1'],
    wager: 'token',
    visibility: 'invite',
    requestId: 'operation-1',
    acceptPokemonRisk: false,
    ...token,
    acceptMonetaryRisk: true,
  });
  assert.deepEqual(calls[1].options?.json, {
    pokemonIds: ['pokemon-2'],
    wager: 'token',
    inviteCode: 'secret-code',
    acceptPokemonRisk: false,
    ...token,
    acceptMonetaryRisk: true,
  });
  assert.equal(
    battleWagerLabel({
      wager: 'sol',
      wagerAmount: sol.wagerAmount,
      wagerDecimals: 9,
      wagerSymbol: 'SOL',
    }),
    '0.100000001 SOL',
  );
  assert.throws(() => monetaryTerms('token', '1'), /available wager token/);
  assert.throws(() => client.create(['one'], 'sol', 'public', 'missing-terms'), /valid wager/);
  assert.throws(() => monetaryTerms('sol', '0.0000000001'), /decimal/);
});
test('room previews send a private invitation without guessing the host’s stake or team', async () => {
  const calls: { path: string; options?: ApiRequestOptions }[] = [];
  const client = createBattleClient((async (path, options) => {
    calls.push({ path, options });
    return {};
  }) as typeof apiRequest);
  const abort = new AbortController();
  await client.preview('room/id', 'private+code', abort.signal);
  assert.equal(calls[0].path, '/v1/battles/room%2Fid/preview?inviteCode=private%2Bcode');
  assert.equal(calls[0].options?.signal, abort.signal);
  assert.equal(calls[0].options?.json, undefined);
});
test('worker escrow initialization waits retain one request id and cannot submit funds early', async () => {
  const storage = memory(),
    bodies: unknown[] = [];
  let initialized = false,
    signs = 0;
  const request = (async (path, options) => {
    if (path.endsWith('/prepare')) {
      bodies.push(options?.json);
      if (!initialized) throw new ApiError('Preparing the escrow', 409, 'ESCROW_INITIALIZING');
      return prepared;
    }
    return { status: 'confirmed', signature };
  }) as typeof apiRequest;
  const sign = async (_intent: unknown, onSigning?: () => void, submitPath?: string) => {
    assert.equal(submitPath, '/v1/battles/room-1/escrow/submit');
    onSigning?.();
    signs++;
    return signature;
  };
  const first = new BattleFundingController('wallet-1', 'room-1', { ...storage, request, sign });
  await first.run('deposit');
  assert.equal(signs, 0);
  assert.ok(storage.load()?.requestId);
  initialized = true;
  const resumed = new BattleFundingController('wallet-1', 'room-1', { ...storage, request, sign });
  assert.equal((await resumed.check())?.status, 'confirmed');
  assert.deepEqual(bodies[0], bodies[1]);
  assert.equal(signs, 1);
  assert.equal(storage.load(), null);
});
test('an unknown deposit submission is never sent twice and recovers its signature from the server', async () => {
  const storage = memory();
  let signs = 0,
    known = false;
  const request = (async (path) =>
    path.endsWith('/confirm')
      ? { status: 'confirmed', signature }
      : { ...prepared, ...(known ? { status: 'submitted', signature } : {}) }) as typeof apiRequest;
  const sign = async (_intent: unknown, onSigning?: () => void) => {
    onSigning?.();
    signs++;
    throw new Error('Wallet response interrupted');
  };
  const controller = new BattleFundingController('wallet-1', 'room-1', {
    ...storage,
    request,
    sign,
  });
  await controller.run('deposit');
  assert.equal((await controller.check())?.status, 'pending');
  assert.equal(signs, 1);
  known = true;
  assert.equal((await controller.check())?.status, 'confirmed');
  assert.equal(signs, 1);
});
test('refunds use a distinct persisted action and pending deposits cannot turn into another payment', async () => {
  const storage = memory();
  let fail = true;
  const payloads: any[] = [];
  const request = (async (_path, options) => {
    payloads.push(options?.json);
    if (fail) throw new ApiError('Offline', 0);
    return { ...prepared, status: 'expired' };
  }) as typeof apiRequest;
  const controller = new BattleFundingController('wallet-1', 'room-1', { ...storage, request });
  await controller.run('deposit');
  await controller.run('refund');
  assert.equal(payloads.length, 1);
  assert.match(controller.state.error, /Resolve your saved/);
  fail = false;
  await controller.check();
  assert.equal(controller.state.pending, null);
  await controller.run('refund');
  assert.equal(payloads.at(-1)?.action, 'refund');
});
