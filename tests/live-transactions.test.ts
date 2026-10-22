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
test('a failed preparation is discarded and a retry uses a new request and current details', async () => {
  const store = memory();
  const bodies: Record<string, unknown>[] = [];
  let fail = true,
    signs = 0;
  const transport = (async (path, options) => {
    if (path === request.preparePath) {
      bodies.push(options?.json as Record<string, unknown>);
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
  assert.equal(store.read(), null);
  assert.equal(first.state.pending, null);
  const restored = new TransactionController('wallet-1', 'launch', {
    ...store,
    request: transport,
    sign,
  });
  assert.equal(await restored.confirm(), null);
  assert.equal(
    (await restored.execute({ ...request, body: { ...request.body, mode: 'Eggs' } }))?.status,
    'confirmed',
  );
  assert.notEqual(bodies[0].requestId, bodies[1].requestId);
  assert.equal(bodies[1].mode, 'Eggs');
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
  assert.match(controller.state.status, /updates automatically/);
});
test('wallet rejection discards the intent immediately, including its signing marker', async () => {
  const store = memory();
  const transport = (async () => prepared) as typeof apiRequest;
  const controller = new TransactionController('wallet-1', 'launch', {
    ...store,
    request: transport,
    sign: async (_intent, onSigning) => {
      onSigning?.();
      throw Object.assign(new Error('Rejected'), { code: 4001 });
    },
  });
  await controller.execute(request);
  assert.equal(controller.state.pending, null);
  assert.equal(store.read(), null);
  assert.equal(await controller.confirm(), null);
  assert.match(controller.state.status, /Cancelled/);
});
test('every preparation error clears the request, including server errors and timeouts', async () => {
  for (const status of [0, 400, 401, 403, 404, 408, 409, 422, 500, 503]) {
    const store = memory();
    const controller = new TransactionController('wallet-1', 'launch', {
      ...store,
      request: async () => {
        throw new ApiError('Could not prepare', status);
      },
      sign: async () => {
        assert.fail('A failed preparation must never reach the wallet');
      },
    });
    await controller.execute(request);
    assert.equal(controller.state.pending, null, `status ${status}`);
    assert.equal(store.read(), null);
    assert.equal(controller.state.busy, false);
    assert.equal(controller.state.status, '');
    assert.equal(controller.state.error, 'Could not prepare');
  }
});
test('unsigned saved requests from older versions are removed without preparation or signing', async () => {
  for (const intentId of [undefined, prepared.intentId]) {
    const store = memory();
    store.save('wallet-1', 'launch', {
      ...request,
      wallet: 'wallet-1',
      kind: 'launch',
      requestId: 'old',
      intentId,
    });
    const controller = new TransactionController('wallet-1', 'launch', {
      ...store,
      request: async () => {
        assert.fail('An old draft must not be resumed');
      },
      sign: async () => {
        assert.fail('An old draft must not be signed');
      },
    });
    assert.equal(store.read(), null);
    assert.equal(await controller.confirm(), null);
  }
});
test('failed and expired submissions clear after the server establishes their outcome', async () => {
  for (const status of ['failed', 'expired']) {
    const store = memory();
    store.save('wallet-1', 'launch', {
      ...request,
      wallet: 'wallet-1',
      kind: 'launch',
      requestId: 'sent',
      intentId: prepared.intentId,
      signingStarted: true,
      signature,
    });
    const controller = new TransactionController('wallet-1', 'launch', {
      ...store,
      request: (async () => ({ ...prepared, status, signature })) as typeof apiRequest,
      sign: async () => {
        assert.fail('A submitted transaction must not be re-signed');
      },
    });
    await controller.confirm();
    assert.equal(controller.state.pending, null);
    assert.equal(store.read(), null);
    assert.match(controller.state.error, new RegExp(status));
  }
});
test('confirmation network errors retain a submitted transaction without allowing another send', async () => {
  const store = memory();
  let reachable = false,
    signs = 0;
  const controller = new TransactionController('wallet-1', 'launch', {
    ...store,
    request: (async (path) => {
      if (path === request.preparePath) return prepared;
      if (!reachable) throw new ApiError('Connection lost', 500);
      return { ...prepared, status: 'confirmed', signature };
    }) as typeof apiRequest,
    sign: async (_intent, onSigning) => {
      onSigning?.();
      signs++;
      return signature;
    },
  });
  await controller.execute(request);
  assert.equal(store.read()?.signature, signature);
  assert.equal(await controller.execute(request), null);
  reachable = true;
  assert.deepEqual(await controller.confirm(), {
    status: 'confirmed',
    signature,
    mint: prepared.mint,
    coinId: prepared.mint,
  });
  assert.equal(signs, 1);
  assert.equal(store.read(), null);
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
