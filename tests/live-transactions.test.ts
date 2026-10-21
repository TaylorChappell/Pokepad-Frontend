import test from 'node:test';
import assert from 'node:assert/strict';
import bs58 from 'bs58';
import {
  TransactionController,
  decimalToRaw,
  type PendingTransaction,
  type TransactionRequest,
} from '../src/services/transactions';
import { ApiError, type apiRequest } from '../src/services/http';
const signature = bs58.encode(new Uint8Array(64).fill(3));
const prepared = {
  intentId: 'intent-1',
  mint: 'mint-1',
  chain: 'solana:devnet' as const,
  transactionBase64: 'AA==',
  blockhash: 'block',
  lastValidBlockHeight: 42,
  status: 'prepared',
};
const request: TransactionRequest = {
  preparePath: '/v1/coins/prepare',
  confirmPath: '/v1/coins/confirm',
  body: { assetId: 'asset-1', mode: 'Mixed', launchKind: 'trainer' },
};
function memory() {
  let saved: PendingTransaction | null = null;
  return {
    read: () => (saved ? structuredClone(saved) : null),
    save: (_wallet: string, _kind: string, value: PendingTransaction | null) => {
      saved = value ? structuredClone(value) : null;
    },
  };
}
test('raw trade units retain lamports and token precision without floating point rounding', () => {
  assert.equal(decimalToRaw('1.000000001', 9), '1000000001');
  assert.equal(decimalToRaw('9007199254740993.1', 6), '9007199254740993100000');
  assert.equal(decimalToRaw('0.000001', 6), '1');
  for (const amount of ['0', '-1', '1e9', '0.0000000001', 'NaN'])
    assert.throws(() => decimalToRaw(amount, 9));
});
test('ambiguous prepare persists exact body and requestId across reload before any wallet signing', async () => {
  const store = memory();
  const bodies: unknown[] = [];
  let fail = true,
    signs = 0;
  const transport = (async (path, options) => {
    if (path === request.preparePath) {
      bodies.push(options?.json);
      if (fail) {
        fail = false;
        throw new ApiError('Network interrupted', 0);
      }
      return prepared;
    }
    return { status: 'confirmed', signature, coinId: 'coin-1' };
  }) as typeof apiRequest;
  const sign = async (_intent: unknown, onSigning?: () => void) => {
    onSigning?.();
    signs++;
    return signature;
  };
  const first = new TransactionController('wallet-1', 'launch', {
    ...store,
    request: transport,
    sign,
  });
  assert.equal(await first.execute(request), null);
  assert.equal(signs, 0);
  assert.ok(store.read()?.requestId);
  assert.equal(store.read()?.intentId, undefined);
  const restored = new TransactionController('wallet-1', 'launch', {
    ...store,
    request: transport,
    sign,
  });
  assert.equal((await restored.confirm())?.status, 'confirmed');
  assert.deepEqual(bodies[0], bodies[1]);
  assert.equal(signs, 1);
  assert.equal(store.read(), null);
});
test('pending confirmations and reload recovery never ask the wallet to send twice', async () => {
  const store = memory();
  let signs = 0,
    confirmations = 0;
  const paths: string[] = [];
  const transport = (async (path) => {
    paths.push(path);
    if (path === request.preparePath) return prepared;
    if (path.startsWith('/v1/transactions/'))
      return { ...prepared, status: 'submitted', signature };
    return { status: ++confirmations === 1 ? 'pending' : 'confirmed', signature };
  }) as typeof apiRequest;
  const sign = async (_intent: unknown, onSigning?: () => void) => {
    onSigning?.();
    signs++;
    return signature;
  };
  const first = new TransactionController('wallet-1', 'launch', {
    ...store,
    request: transport,
    sign,
  });
  assert.equal((await first.execute(request))?.status, 'pending');
  const next = new TransactionController('wallet-1', 'launch', {
    ...store,
    request: transport,
    sign,
  });
  assert.equal((await next.confirm())?.status, 'confirmed');
  assert.equal(signs, 1);
  assert.equal(paths.filter((path) => path === request.preparePath).length, 1);
});
test('an interrupted wallet send stays recoverable and is never automatically re-signed', async () => {
  const store = memory();
  let signs = 0;
  const transport = (async () => prepared) as typeof apiRequest;
  const controller = new TransactionController('wallet-1', 'launch', {
    ...store,
    request: transport,
    sign: async (_intent, onSigning) => {
      onSigning?.();
      signs++;
      throw new Error('Wallet disconnected after approval');
    },
  });
  await controller.execute(request);
  assert.equal(controller.state.pending?.signingStarted, true);
  assert.equal((await controller.confirm())?.status, 'pending');
  assert.equal(signs, 1);
  assert.match(controller.state.status, /will not send another/);
});
test('wallet rejection preserves the prepared intent and definitive expiry releases the UI', async () => {
  const store = memory();
  let expired = false;
  const transport = (async () => ({
    ...prepared,
    status: expired ? 'expired' : 'prepared',
  })) as typeof apiRequest;
  const controller = new TransactionController('wallet-1', 'launch', {
    ...store,
    request: transport,
    sign: async (_intent, onSigning) => {
      onSigning?.();
      throw Object.assign(new Error('Rejected'), { code: 4001 });
    },
  });
  await controller.execute(request);
  assert.equal(controller.state.pending?.signingStarted, false);
  assert.equal(controller.state.pending?.intentId, prepared.intentId);
  expired = true;
  await controller.confirm();
  assert.equal(controller.state.pending, null);
  assert.match(controller.state.error, /expired/);
});
test('double clicks share one preparation and cannot mutate the saved review', async () => {
  const store = memory();
  let release!: (value: unknown) => void;
  let count = 0;
  const transport = (async () => {
    count++;
    return new Promise((resolve) => {
      release = resolve;
    });
  }) as typeof apiRequest;
  const controller = new TransactionController('wallet-1', 'launch', {
    ...store,
    request: transport,
  });
  const input = structuredClone(request);
  const first = controller.execute(input);
  input.body.mode = 'Eggs';
  assert.equal(await controller.execute(input), null);
  assert.equal(store.read()?.body.mode, 'Mixed');
  assert.equal(count, 1);
  release({ ...prepared, status: 'expired' });
  await first;
});
