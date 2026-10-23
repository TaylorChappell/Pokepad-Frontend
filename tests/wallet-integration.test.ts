import test from 'node:test';
import assert from 'node:assert/strict';
import bs58 from 'bs58';
import { getWallets } from '@wallet-standard/app';
import type { Wallet, WalletAccount } from '@wallet-standard/base';
import { createWalletController, type PreparedTransaction } from '../src/services/wallet';
import {
  API_BASE,
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
    stored?: Map<string, string>;
    storageUnavailable?: boolean;
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
  const stored = options.stored ?? new Map<string, string>();
  const connectInputs: Array<{ silent?: boolean } | undefined> = [];
  let accounts: readonly WalletAccount[] = [account];
  const tokens: Array<string | null> = [],
    enabled: boolean[] = [];
  const signedMessages: Uint8Array[] = [];
  let disconnectCalls = 0,
    metaMaskRegistrations = 0,
    unauthorized: (() => void) | undefined,
    storageChanged: (() => void) | undefined;
  const features: any = {
    'standard:connect': {
      version: '1.0.0',
      connect: async (input?: { silent?: boolean }) => {
        connectInputs.push(input);
        return { accounts: [account] };
      },
    },
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
    get accounts() {
      return accounts;
    },
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
      if (path.endsWith('/session'))
        return tokens.at(-1) === token ||
          new Headers(init.headers).get('Authorization') === `Bearer ${token}`
          ? { authenticated: true, wallet: account.address, expiresAt: expiresAt() }
          : { authenticated: false, wallet: null, expiresAt: null };
      if (path.endsWith('/submit')) return { signature: bs58.encode(new Uint8Array(64).fill(4)) };
      return {};
    }) as typeof apiRequest,
    ensureMetaMask: async () => {
      metaMaskRegistrations++;
      unregister ??= getWallets().register(wallet);
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
    onStorageChange: (callback) => {
      storageChanged = callback;
      return () => {
        storageChanged = undefined;
      };
    },
    storage: () => {
      if (options.storageUnavailable) throw new Error('Storage disabled');
      return {
        getItem: (key) => stored.get(key) ?? null,
        setItem: (key, value) => {
          stored.set(key, value);
        },
        removeItem: (key) => {
          stored.delete(key);
        },
      };
    },
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
    connectInputs,
    setAccounts(value: readonly WalletAccount[]) {
      accounts = value;
    },
    register() {
      unregister ??= getWallets().register(wallet);
    },
    emitAccounts(accounts: readonly WalletAccount[]) {
      for (const event of events) event({ accounts });
    },
    expire() {
      unauthorized?.();
    },
    syncStoredSession() {
      storageChanged?.();
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

test('Phantom signs the exact UTF-8 message and saves a verified tab session until logout', async () => {
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
    const saved = JSON.parse(f.stored.get(`kanto.wallet-session:v1:${API_BASE}`)!);
    assert.equal(saved.token, token);
    assert.equal(saved.wallet, f.account.address);
    assert.equal(saved.provider, 'Phantom');
    assert.ok(Date.parse(saved.expiresAt) > Date.now());
    assert.equal(f.stored.size, 1);
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

test('failed restoration leaves public browsing anonymous and valid cookies reuse an authorized provider', async () => {
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
    assert.equal(restored.controller.currentWalletSession().signingReady, true);
    assert.equal(restored.connectInputs.length, 0);
    assert.equal(restored.signedMessages.length, 0);
    assert.equal(bs58.decode(await restored.controller.signAndSendPrepared(prepared)).length, 64);
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

test('real provider account switches and authorization expiry clear the connected account immediately', async () => {
  const f = fixture();
  try {
    await f.controller.connectWallet('Phantom');
    const publicKey = new Uint8Array(32).fill(8);
    f.emitAccounts([{ ...f.account, publicKey, address: bs58.encode(publicKey) }]);
    assert.equal(f.controller.currentWalletSession().status, 'anonymous');
    assert.equal(f.tokens.at(-1), null);
    assert.equal(f.eventCount(), 0);
    await f.controller.connectWallet('Phantom');
    f.expire();
    assert.equal(f.controller.currentWalletSession().status, 'anonymous');
    assert.equal(f.enabled.at(-1), false);
    assert.equal(f.stored.has(`kanto.wallet-session:v1:${API_BASE}`), false);
  } finally {
    f.dispose();
  }
});

test('a temporary empty provider account list keeps sign-in while suspending signing', async () => {
  const f = fixture();
  try {
    await f.controller.connectWallet('Phantom');
    f.emitAccounts([]);
    assert.equal(f.controller.currentWalletSession().status, 'authenticated');
    assert.equal(f.controller.currentWalletSession().signingReady, false);
    assert.equal(f.tokens.at(-1), token);
    assert.equal(f.stored.has(`kanto.wallet-session:v1:${API_BASE}`), true);
    assert.equal(
      f.requests.some((r) => r.path.endsWith('/logout')),
      false,
    );
    await assert.rejects(f.controller.signAndSendPrepared(prepared), /Reconnect/);
    f.emitAccounts([f.account]);
    assert.equal(f.controller.currentWalletSession().signingReady, true);
    assert.equal(f.eventCount(), 1);
    assert.equal(f.signedMessages.length, 1);
    assert.equal(f.disconnectCalls(), 0);
    await f.controller.disconnectWallet();
    assert.equal(f.controller.currentWalletSession().status, 'anonymous');
  } finally {
    f.dispose();
  }
});

test('resuming a suspended Phantom provider reconnects silently without a new sign-in', async () => {
  const f = fixture();
  try {
    await f.controller.connectWallet('Phantom');
    f.setAccounts([]);
    f.emitAccounts([]);
    await Promise.all([f.controller.resumeWalletSession(), f.controller.resumeWalletSession()]);
    assert.equal(f.controller.currentWalletSession().signingReady, true);
    assert.deepEqual(f.connectInputs, [undefined, { silent: true }]);
    assert.equal(f.signedMessages.length, 1);
    assert.equal(f.requests.filter((r) => r.path.endsWith('/challenge')).length, 1);
    assert.equal(f.eventCount(), 1);
    await f.controller.resumeWalletSession();
    assert.equal(
      f.connectInputs.length,
      2,
      'normal page changes never reconnect an attached wallet',
    );
  } finally {
    f.dispose();
  }
});

test('a provider interruption invalidates an in-flight signed transaction even if the account returns', async () => {
  const f = fixture();
  const signing = deferred<any>();
  try {
    delete f.features['solana:signAndSendTransaction'];
    f.features['solana:signTransaction'] = {
      version: '1.0.0',
      signTransaction: () => signing.promise,
    };
    await f.controller.connectWallet('Phantom');
    const pending = f.controller.signAndSendPrepared(prepared);
    f.emitAccounts([]);
    f.emitAccounts([f.account]);
    signing.resolve([{ signedTransaction: new Uint8Array(160) }]);
    await assert.rejects(pending, /changed before submission/);
    assert.equal(
      f.requests.some((r) => r.path.endsWith('/submit')),
      false,
    );
    assert.equal(f.controller.currentWalletSession().status, 'authenticated');
  } finally {
    f.dispose();
  }
});

test('logout in another tab clears the current session without revoking or resurrecting anything', async () => {
  const f = fixture();
  try {
    await f.controller.connectWallet('Phantom');
    f.stored.delete(`kanto.wallet-session:v1:${API_BASE}`);
    f.stored.set('kanto.explicitly-signed-out', '1');
    f.syncStoredSession();
    assert.equal(f.controller.currentWalletSession().status, 'anonymous');
    assert.equal(f.tokens.at(-1), null);
    assert.equal(f.eventCount(), 0);
    assert.equal(
      f.requests.some((r) => r.path.endsWith('/logout')),
      false,
    );
    const count = f.requests.length;
    await f.controller.resumeWalletSession();
    assert.equal(f.requests.length, count);
  } finally {
    f.dispose();
  }
});

test('a shared sign-in is server-verified and a cross-tab logout wins over a pending restore', async () => {
  const pending = deferred<any>();
  const stored = await savedLogin();
  const f = fixture({ stored, request: async () => pending.promise });
  try {
    f.syncStoredSession();
    assert.equal(f.controller.currentWalletSession().status, 'checking');
    assert.equal(f.tokens.includes(token), false, 'shared storage alone cannot authenticate');
    stored.delete(sessionKey);
    stored.set('kanto.explicitly-signed-out', '1');
    f.syncStoredSession();
    pending.resolve({ authenticated: true, wallet: f.account.address, expiresAt: expiresAt() });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(f.controller.currentWalletSession().status, 'anonymous');
    assert.equal(f.tokens.includes(token), false);
    assert.equal(f.signedMessages.length, 0);
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

test('sign-in confirms the bearer without cookies, reports progress and tolerates account reordering', async () => {
  const f = fixture();
  const steps: string[] = [];
  const stop = f.controller.subscribeWalletSession((s) => {
    if (s.step) steps.push(s.step);
  });
  try {
    await f.controller.connectWallet('Phantom');
    assert.deepEqual(steps.slice(0, 3), ['opening', 'signing', 'verifying']);
    const check = f.requests.find((r) => r.path.endsWith('/session'))!;
    assert.equal(check.init.credentials, 'omit');
    f.emitAccounts([{ ...f.account, address: 'another-account' }, f.account]);
    assert.equal(f.controller.currentWalletSession().status, 'authenticated');
  } finally {
    stop();
    f.dispose();
  }
});

test('an accepted signature without a usable server session never announces a successful login', async () => {
  let address = '';
  const f = fixture({
    request: async (path) => {
      if (path.endsWith('/challenge'))
        return { challengeId: 'id', message, expiresAt: expiresAt() };
      if (path.endsWith('/verify'))
        return { authenticated: true, wallet: address, token, expiresAt: expiresAt() };
      return { authenticated: false, wallet: null };
    },
  });
  address = f.account.address;
  const statuses: string[] = [];
  const stop = f.controller.subscribeWalletSession((s) => statuses.push(s.status));
  try {
    await assert.rejects(f.controller.connectWallet('Phantom'), /couldn’t keep you signed in/);
    assert.ok(!statuses.includes('authenticated'));
    assert.equal(f.tokens.at(-1), null);
    assert.equal(f.stored.size, 0);
  } finally {
    stop();
    f.dispose();
  }
});

async function savedLogin(name: 'Phantom' | 'MetaMask' = 'Phantom') {
  const first = fixture({ name });
  try {
    await first.controller.connectWallet(name);
    return first.stored;
  } finally {
    first.dispose();
  }
}
const sessionKey = `kanto.wallet-session:v1:${API_BASE}`;

test('refresh validates the saved bearer without cookies and silently restores Phantom without signing again', async () => {
  const f = fixture({ stored: await savedLogin() });
  f.setAccounts([]);
  try {
    await f.controller.restoreWalletSession();
    assert.equal(f.controller.currentWalletSession().status, 'authenticated');
    assert.equal(f.controller.currentWalletSession().signingReady, true);
    assert.equal(f.controller.currentWalletSession().restoringProvider, false);
    assert.deepEqual(f.connectInputs, [{ silent: true }]);
    assert.equal(f.signedMessages.length, 0);
    assert.deepEqual(
      f.requests.map(({ path }) => path),
      ['/v1/auth/session'],
    );
    assert.equal(f.requests[0].init.credentials, 'omit');
    assert.equal(new Headers(f.requests[0].init.headers).get('Authorization'), `Bearer ${token}`);
    assert.equal(f.tokens.at(-1), token);
    assert.equal(f.eventCount(), 1);
    await f.controller.restoreWalletSession();
    assert.equal(f.eventCount(), 1);
    await f.controller.disconnectWallet();
    assert.equal(f.stored.has(sessionKey), false);
    const requests = f.requests.length;
    await f.controller.restoreWalletSession();
    assert.equal(f.requests.length, requests);
    assert.equal(f.controller.currentWalletSession().status, 'anonymous');
  } finally {
    f.dispose();
  }
});

test('MetaMask refresh awaits registration and reuses its restored account without opening a connection prompt', async () => {
  const stored = await savedLogin('MetaMask');
  const f = fixture({ name: 'MetaMask', registered: false, stored });
  try {
    await f.controller.restoreWalletSession();
    assert.equal(f.metaMaskRegistrations(), 1);
    assert.equal(f.controller.currentWalletSession().provider, 'MetaMask');
    assert.equal(f.controller.currentWalletSession().signingReady, true);
    assert.equal(f.connectInputs.length, 0);
    assert.equal(f.signedMessages.length, 0);
  } finally {
    f.dispose();
  }
  const locked = fixture({ name: 'MetaMask', stored });
  locked.setAccounts([]);
  try {
    await locked.controller.restoreWalletSession();
    assert.equal(locked.controller.currentWalletSession().status, 'authenticated');
    assert.equal(locked.controller.currentWalletSession().signingReady, false);
    assert.equal(locked.controller.currentWalletSession().restoringProvider, false);
    assert.equal(locked.connectInputs.length, 0);
    assert.equal(locked.signedMessages.length, 0);
  } finally {
    locked.dispose();
  }
});

test('server-rejected or mismatched saved sessions cannot authenticate or connect a provider', async () => {
  for (const result of [
    { authenticated: false, wallet: null, expiresAt: null },
    {
      authenticated: true,
      wallet: bs58.encode(new Uint8Array(32).fill(8)),
      expiresAt: expiresAt(),
    },
    {
      authenticated: true,
      wallet: bs58.encode(new Uint8Array(32).fill(7)),
      expiresAt: '2000-01-01',
    },
  ]) {
    const f = fixture({ stored: await savedLogin(), request: async () => result });
    try {
      await f.controller.restoreWalletSession();
      assert.equal(f.controller.currentWalletSession().status, 'anonymous');
      assert.equal(f.stored.has(sessionKey), false);
      assert.equal(f.tokens.includes(token), false);
      assert.equal(f.connectInputs.length, 0);
      assert.equal(f.eventCount(), 0);
    } finally {
      f.dispose();
    }
  }
});

test('expired, malformed and other-API saved records are never sent as credentials', async () => {
  const initial = await savedLogin();
  const valid = JSON.parse(initial.get(sessionKey)!);
  for (const [key, value] of [
    [sessionKey, JSON.stringify({ ...valid, expiresAt: '2000-01-01' })],
    [sessionKey, '{bad json'],
    [sessionKey, JSON.stringify({ ...valid, token: 'invalid token' })],
    ['kanto.wallet-session:v1:https://another-api.example', JSON.stringify(valid)],
  ]) {
    const f = fixture({ stored: new Map([[key, value]]) });
    try {
      await f.controller.restoreWalletSession();
      assert.equal(f.controller.currentWalletSession().status, 'anonymous');
      assert.equal(new Headers(f.requests[0].init.headers).has('Authorization'), false);
      assert.equal(f.tokens.includes(token), false);
    } finally {
      f.dispose();
    }
  }
});

test('locked or different Phantom accounts keep authenticated browsing without installing a mismatched signer', async () => {
  for (const locked of [true, false]) {
    const f = fixture({ stored: await savedLogin() });
    const publicKey = new Uint8Array(32).fill(8);
    const other = { ...f.account, publicKey, address: bs58.encode(publicKey) };
    f.setAccounts([other]);
    f.features['standard:connect'].connect = async (input: { silent?: boolean }) => {
      assert.equal(input.silent, true);
      if (locked) throw new Error('Wallet locked');
      return { accounts: [other] };
    };
    try {
      await f.controller.restoreWalletSession();
      assert.equal(f.controller.currentWalletSession().status, 'authenticated');
      assert.equal(f.controller.currentWalletSession().wallet, f.account.address);
      assert.equal(f.controller.currentWalletSession().signingReady, false);
      assert.equal(f.controller.currentWalletSession().restoringProvider, false);
      assert.equal(f.stored.has(sessionKey), true);
      assert.equal(f.signedMessages.length, 0);
      await assert.rejects(f.controller.signAndSendPrepared(prepared), /Reconnect/);
    } finally {
      f.dispose();
    }
  }
});

test('restoration waits for delayed wallet registration without adding duplicate wallet listeners', async () => {
  const f = fixture({ stored: await savedLogin(), registered: false });
  try {
    const pending = f.controller.restoreWalletSession();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(f.controller.currentWalletSession().restoringProvider, true);
    f.register();
    await pending;
    assert.equal(f.controller.currentWalletSession().signingReady, true);
    assert.equal(f.eventCount(), 1);
  } finally {
    f.dispose();
  }
});

test('logout during silent wallet restoration cancels pending work and cannot resurrect the session', async () => {
  const f = fixture({ stored: await savedLogin() });
  const pending = deferred<{ accounts: WalletAccount[] }>();
  const entered = deferred<void>();
  f.setAccounts([]);
  f.features['standard:connect'].connect = () => {
    entered.resolve();
    return pending.promise;
  };
  try {
    const restoring = f.controller.restoreWalletSession();
    await entered.promise;
    await f.controller.disconnectWallet();
    await restoring;
    pending.resolve({ accounts: [f.account] });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(f.controller.currentWalletSession().status, 'anonymous');
    assert.equal(f.stored.has(sessionKey), false);
    assert.equal(f.tokens.at(-1), null);
    assert.equal(f.eventCount(), 0);
  } finally {
    f.dispose();
  }
});

test('temporary network failure preserves a saved credential for retry but definitive rejection clears it', async () => {
  const stored = await savedLogin();
  const offline = fixture({
    stored,
    request: async () => {
      throw new ApiError('Unavailable', 503);
    },
  });
  try {
    await assert.rejects(offline.controller.restoreWalletSession(), /Unavailable/);
    assert.equal(offline.controller.currentWalletSession().status, 'anonymous');
    assert.equal(offline.tokens.includes(token), false);
    assert.equal(stored.has(sessionKey), true);
  } finally {
    offline.dispose();
  }
  const retry = fixture({ stored });
  try {
    await retry.controller.restoreWalletSession();
    assert.equal(retry.controller.currentWalletSession().status, 'authenticated');
  } finally {
    retry.dispose();
  }
  const revoked = fixture({
    stored,
    request: async () => {
      throw new ApiError('Expired', 401);
    },
  });
  try {
    await assert.rejects(revoked.controller.restoreWalletSession(), /Expired/);
    assert.equal(revoked.controller.currentWalletSession().status, 'anonymous');
    assert.equal(stored.has(sessionKey), false);
  } finally {
    revoked.dispose();
  }
});

test('unavailable session storage does not prevent normal sign-in or logout', async () => {
  const f = fixture({ storageUnavailable: true });
  try {
    await f.controller.connectWallet('Phantom');
    assert.equal(f.controller.currentWalletSession().status, 'authenticated');
    assert.equal(f.controller.currentWalletSession().signingReady, true);
    await f.controller.disconnectWallet();
    assert.equal(f.controller.currentWalletSession().status, 'anonymous');
  } finally {
    f.dispose();
  }
});

test('a returned mobile proof uses its original server challenge and still verifies the resulting bearer', async () => {
  const f = fixture();
  try {
    await f.controller.connectWallet('Phantom', {
      wallet: f.account.address,
      challengeId: 'mobile-original-challenge',
      message,
      signature: new Uint8Array(64).fill(9),
    });
    assert.equal(f.controller.currentWalletSession().status, 'authenticated');
    assert.equal(
      f.requests.some((r) => r.path.endsWith('/challenge')),
      false,
    );
    assert.equal(f.signedMessages.length, 0, 'does not ask for a second, different signature');
    assert.equal(
      (f.requests.find((r) => r.path.endsWith('/verify'))!.init.json as any).challengeId,
      'mobile-original-challenge',
    );
    assert.equal(f.requests.at(-1)?.path, '/v1/auth/session');
  } finally {
    f.dispose();
  }
});
