import test from 'node:test';
import assert from 'node:assert/strict';
import bs58 from 'bs58';
import { getWallets } from '@wallet-standard/app';
import type { Wallet, WalletAccount } from '@wallet-standard/base';
import { createWalletController, type PreparedTransaction } from '../src/services/wallet';
import {
  apiRequest,
  ApiError,
  onUnauthorized,
  setAccessToken,
  setSessionEnabled,
  type ApiRequestOptions,
} from '../src/services/http';

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const expiresAt = () => new Date(Date.now() + 3600000).toISOString();
const token = 'T'.repeat(43);
const message =
  'kanto.example wants you to sign in with your Solana account:\n\nSign in to Kanto.\nUnicode: Pokémon ⚡\nNonce: exact-byte-test\n';
const prepared: PreparedTransaction = {
  intentId: 'intent-1',
  transactionBase64: Buffer.alloc(160, 7).toString('base64'),
  mint: 'mint',
  blockhash: 'blockhash',
  lastValidBlockHeight: 500,
  chain: 'solana:mainnet',
};
function fixture(
  options: {
    name?: 'Phantom' | 'MetaMask';
    registered?: boolean;
    request?: (path: string, init: ApiRequestOptions) => Promise<unknown>;
  } = {},
) {
  const publicKey = new Uint8Array(32).fill(7);
  const account: WalletAccount = {
    address: bs58.encode(publicKey),
    publicKey,
    chains: ['solana:mainnet'],
    features: ['solana:signMessage', 'solana:signAndSendTransaction', 'solana:signTransaction'],
  };
  const events = new Set<(change: { accounts: readonly WalletAccount[] }) => void>();
  const requests: Array<{ path: string; init: ApiRequestOptions }> = [];
  const stored = new Map<string, string>();
  const tokens: Array<string | null> = [],
    enabled: boolean[] = [];
  const signedMessages: Uint8Array[] = [];
  let disconnectCalls = 0,
    metaMaskRegistrations = 0,
    unauthorized: (() => void) | undefined;
  const features: any = {
    'standard:connect': { version: '1.0.0', connect: async () => ({ accounts: [account] }) },
    'standard:disconnect': {
      version: '1.0.0',
      disconnect: async () => {
        disconnectCalls++;
      },
    },
    'standard:events': {
      version: '1.0.0',
      on: (_name: string, callback: (change: { accounts: readonly WalletAccount[] }) => void) => {
        events.add(callback);
        return () => events.delete(callback);
      },
    },
    'solana:signMessage': {
      version: '1.0.0',
      signMessage: async ({ message: bytes }: { message: Uint8Array }) => {
        signedMessages.push(bytes.slice());
        return [{ signedMessage: bytes.slice(), signature: new Uint8Array(64).fill(9) }];
      },
    },
    'solana:signAndSendTransaction': {
      version: '1.0.0',
      supportedTransactionVersions: ['legacy', 0],
      signAndSendTransaction: async () => [{ signature: new Uint8Array(64).fill(8) }],
    },
  };
  const wallet = {
    name: options.name ?? 'Phantom',
    version: '1.0.0',
    icon: 'data:image/svg+xml;base64,AA==',
    chains: ['solana:mainnet'],
    accounts: [account],
    features,
  } as Wallet;
  let unregister = options.registered === false ? undefined : getWallets().register(wallet);
  const controller = createWalletController({
    wallets: getWallets,
    request: (async (path: string, init: ApiRequestOptions = {}) => {
      requests.push({ path, init });
      if (options.request) return options.request(path, init);
      if (path.endsWith('/challenge'))
        return { challengeId: 'challenge-1', message, expiresAt: expiresAt() };
      if (path.endsWith('/verify'))
        return { authenticated: true, wallet: account.address, token, expiresAt: expiresAt() };
      if (path.endsWith('/session')) return { authenticated: false, wallet: null, expiresAt: null };
      if (path.endsWith('/submit')) return { signature: bs58.encode(new Uint8Array(64).fill(4)) };
      return {};
    }) as typeof apiRequest,
    ensureMetaMask: async () => {
      metaMaskRegistrations++;
      unregister = getWallets().register(wallet);
    },
    setAccessToken: (value) => {
      tokens.push(value);
    },
    setSessionEnabled: (value) => {
      enabled.push(value);
    },
    onUnauthorized: (callback) => {
      unauthorized = callback;
      return () => {
        unauthorized = undefined;
      };
    },
    storage: () => ({
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => {
        stored.set(key, value);
      },
      removeItem: (key) => {
        stored.delete(key);
      },
    }),
  });
  return {
    controller,
    account,
    wallet,
    features,
    requests,
    stored,
    tokens,
    enabled,
    signedMessages,
    emitAccounts(accounts: readonly WalletAccount[]) {
      for (const event of events) event({ accounts });
    },
    expire() {
      unauthorized?.();
    },
    eventCount: () => events.size,
    disconnectCalls: () => disconnectCalls,
    metaMaskRegistrations: () => metaMaskRegistrations,
    dispose() {
      controller.dispose();
      unregister?.();
    },
  };
}

test('Phantom signs the exact UTF-8 server message and keeps its bearer out of browser storage', async () => {
  const f = fixture();
  try {
    await f.controller.connectWallet('Phantom');
    assert.equal(f.controller.currentWalletSession().status, 'authenticated');
    assert.equal(f.controller.currentWalletSession().signingReady, true);
    assert.deepEqual(f.signedMessages[0], new TextEncoder().encode(message));
    const proof = f.requests.find((request) => request.path.endsWith('/verify'))!.init.json as any;
    assert.equal(bs58.decode(proof.signature).length, 64);
    assert.equal(f.tokens.at(-1), token);
    assert.equal(f.enabled.at(-1), true);
    assert.equal(JSON.stringify([...f.stored]).includes(token), false);
    assert.equal(f.stored.size, 0);
    await f.controller.disconnectWallet();
    assert.equal(f.tokens.at(-1), null);
    assert.equal(f.enabled.at(-1), false);
    assert.deepEqual([...f.stored], [['kanto.explicitly-signed-out', '1']]);
    assert.equal(f.disconnectCalls(), 1);
    assert.equal(f.eventCount(), 0);
  } finally {
    f.dispose();
  }
});

test('MetaMask adapter registration is awaited before selecting its Solana wallet', async () => {
  const f = fixture({ name: 'MetaMask', registered: false });
  try {
    await f.controller.connectWallet('MetaMask');
    assert.equal(f.metaMaskRegistrations(), 1);
    assert.equal(f.controller.currentWalletSession().provider, 'MetaMask');
  } finally {
    f.dispose();
  }
});

test('missing providers, inconsistent public keys, and modified messages never reach server verification', async () => {
  const absent = fixture({ registered: false });
  try {
    await assert.rejects(absent.controller.connectWallet('Phantom'), /Solana-enabled/);
    assert.equal(absent.controller.currentWalletSession().status, 'anonymous');
    assert.equal(absent.requests.length, 0);
  } finally {
    absent.dispose();
  }
  const mismatch = fixture();
  try {
    mismatch.features['standard:connect'].connect = async () => ({
      accounts: [{ ...mismatch.account, address: bs58.encode(new Uint8Array(32).fill(8)) }],
    });
    await assert.rejects(mismatch.controller.connectWallet('Phantom'), /valid Solana account/);
    assert.equal(mismatch.requests.length, 0);
  } finally {
    mismatch.dispose();
  }
  const modified = fixture();
  try {
    modified.features['solana:signMessage'].signMessage = async () => [
      {
        signedMessage: new TextEncoder().encode(message.trim()),
        signature: new Uint8Array(64).fill(9),
      },
    ];
    await assert.rejects(modified.controller.connectWallet('Phantom'), /different message/);
    assert.equal(
      modified.requests.some((request) => request.path.endsWith('/verify')),
      false,
    );
  } finally {
    modified.dispose();
  }
});

test('a stale cookie restore cannot resurrect an explicitly disconnected wallet', async () => {
  const pending = deferred<any>();
  const f = fixture({
    request: async (path) => (path.endsWith('/session') ? pending.promise : {}),
  });
  try {
    const restoring = f.controller.restoreWalletSession();
    await f.controller.disconnectWallet();
    pending.resolve({ authenticated: true, wallet: f.account.address, expiresAt: expiresAt() });
    await restoring;
    assert.equal(f.controller.currentWalletSession().status, 'anonymous');
    assert.equal(f.tokens.at(-1), null);
    const previousRequests = f.requests.length;
    await f.controller.restoreWalletSession();
    assert.equal(f.requests.length, previousRequests);
  } finally {
    f.dispose();
  }
});

test('failed restoration leaves public browsing anonymous and restored cookies require signing-provider reconnection', async () => {
  const failure = fixture({
    request: async () => {
      throw new Error('Network unavailable');
    },
  });
  try {
    await assert.rejects(failure.controller.restoreWalletSession(), /Network/);
    assert.equal(failure.controller.currentWalletSession().status, 'anonymous');
    assert.equal(failure.enabled.at(-1), false);
  } finally {
    failure.dispose();
  }
  let restoredWallet = '';
  const restored = fixture({
    request: async () => ({ authenticated: true, wallet: restoredWallet, expiresAt: expiresAt() }),
  });
  restoredWallet = restored.account.address;
  try {
    await restored.controller.restoreWalletSession();
    assert.equal(restored.controller.currentWalletSession().signingReady, false);
    await assert.rejects(restored.controller.signAndSendPrepared(prepared), /Reconnect/);
  } finally {
    restored.dispose();
  }
});

test('disconnect during provider connection or verification cannot install a stale signer or token', async () => {
  const provider = deferred<any>();
  const first = fixture();
  try {
    first.features['standard:connect'].connect = () => provider.promise;
    const connecting = first.controller.connectWallet('Phantom');
    await first.controller.disconnectWallet();
    provider.resolve({ accounts: [first.account] });
    await assert.rejects(connecting, /connection changed/);
    assert.equal(first.eventCount(), 0);
    assert.equal(
      first.requests.some((request) => request.path.endsWith('/challenge')),
      false,
    );
  } finally {
    first.dispose();
  }
  const verify = deferred<any>(),
    entered = deferred<void>();
  let wallet = '';
  const second = fixture({
    request: async (path) => {
      if (path.endsWith('/challenge'))
        return { challengeId: 'id', message, expiresAt: expiresAt() };
      if (path.endsWith('/verify')) {
        entered.resolve();
        return verify.promise;
      }
      return {};
    },
  });
  wallet = second.account.address;
  try {
    const connecting = second.controller.connectWallet('Phantom');
    await entered.promise;
    await second.controller.disconnectWallet();
    verify.resolve({ authenticated: true, wallet, token, expiresAt: expiresAt() });
    await assert.rejects(connecting, /connection changed/);
    assert.equal(second.controller.currentWalletSession().status, 'anonymous');
    assert.equal(second.tokens.includes(token), false);
  } finally {
    second.dispose();
  }
});

test('provider account changes and authorization expiry clear the connected account immediately', async () => {
  const f = fixture();
  try {
    await f.controller.connectWallet('Phantom');
    f.emitAccounts([]);
    assert.equal(f.controller.currentWalletSession().status, 'anonymous');
    assert.equal(f.tokens.at(-1), null);
    assert.equal(f.eventCount(), 0);
    await f.controller.connectWallet('Phantom');
    f.expire();
    assert.equal(f.controller.currentWalletSession().status, 'anonymous');
    assert.equal(f.enabled.at(-1), false);
  } finally {
    f.dispose();
  }
});

test('transaction recovery callback runs only at signing; account changes prevent sign-only submission', async () => {
  const f = fixture();
  let signing = 0;
  try {
    await f.controller.connectWallet('Phantom');
    await assert.rejects(
      f.controller.signAndSendPrepared({ ...prepared, chain: 'solana:devnet' }, () => signing++),
      /network/,
    );
    assert.equal(signing, 0);
    f.features['solana:signAndSendTransaction'].signAndSendTransaction = async () => {
      assert.equal(signing, 1);
      return [{ signature: new Uint8Array(64).fill(8) }];
    };
    assert.equal(
      bs58.decode(await f.controller.signAndSendPrepared(prepared, () => signing++)).length,
      64,
    );
    delete f.features['solana:signAndSendTransaction'];
    const result = deferred<any>();
    f.features['solana:signTransaction'] = {
      version: '1.0.0',
      signTransaction: () => result.promise,
    };
    const pending = f.controller.signAndSendPrepared(prepared, () => signing++);
    await f.controller.disconnectWallet();
    result.resolve([{ signedTransaction: new Uint8Array(160).fill(2) }]);
    await assert.rejects(pending, /changed before submission/);
    assert.equal(
      f.requests.some((request) => request.path.endsWith('/submit')),
      false,
    );
  } finally {
    f.dispose();
  }
});

test('HTTP handles nested server errors, omits signed-out credentials, and ignores old-session 401 notifications', async () => {
  const originalFetch = globalThis.fetch;
  const old = deferred<Response>();
  let unauthorized = 0;
  const stop = onUnauthorized(() => {
    unauthorized++;
  });
  try {
    setSessionEnabled(true);
    setAccessToken('old-token');
    globalThis.fetch = async (_url, init) => {
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer old-token');
      return old.promise;
    };
    const pending = apiRequest('/v1/private', { base: 'https://api.example' });
    setAccessToken('new-token');
    old.resolve(
      new Response(
        JSON.stringify({ error: { code: 'OLD_SESSION', message: 'Old session expired' } }),
        { status: 401 },
      ),
    );
    await assert.rejects(
      pending,
      (error) =>
        error instanceof ApiError &&
        error.message === 'Old session expired' &&
        error.code === 'OLD_SESSION',
    );
    assert.equal(unauthorized, 0);
    setAccessToken(null);
    setSessionEnabled(false);
    globalThis.fetch = async (_url, init) => {
      assert.equal(new Headers(init?.headers).has('Authorization'), false);
      assert.equal(init?.credentials, 'omit');
      return new Response(JSON.stringify({ value: 1 }), { status: 200 });
    };
    assert.deepEqual(await apiRequest('/v1/bootstrap', { base: 'https://api.example' }), {
      value: 1,
    });
    setSessionEnabled(true);
    setAccessToken('new-token');
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ error: { code: 'SESSION_EXPIRED', message: 'Please reconnect' } }),
        { status: 401 },
      );
    await assert.rejects(
      apiRequest('/v1/private', { base: 'https://api.example' }),
      /Please reconnect/,
    );
    assert.equal(unauthorized, 1);
  } finally {
    globalThis.fetch = originalFetch;
    stop();
    setAccessToken(null);
    setSessionEnabled(true);
  }
});

test('sign-only escrow transactions use the scoped battle submit route with the reviewed intent', async () => {
  const f = fixture();
  try {
    await f.controller.connectWallet('Phantom');
    delete f.features['solana:signAndSendTransaction'];
    f.features['solana:signTransaction'] = {
      version: '1.0.0',
      signTransaction: async () => [{ signedTransaction: new Uint8Array(160).fill(2) }],
    };
    await f.controller.signAndSendPrepared(prepared, undefined, '/v1/battles/room-1/escrow/submit');
    const submitted = f.requests.find((item) => item.path.endsWith('/escrow/submit'))!;
    assert.equal(submitted.path, '/v1/battles/room-1/escrow/submit');
    assert.equal((submitted.init.json as { intentId: string }).intentId, prepared.intentId);
    assert.ok((submitted.init.json as { signedTransactionBase64: string }).signedTransactionBase64);
    await assert.rejects(
      f.controller.signAndSendPrepared(prepared, undefined, 'https://outside.example/submit'),
      /Invalid transaction submission/,
    );
  } finally {
    f.dispose();
  }
});
