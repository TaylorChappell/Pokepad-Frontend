import { getWallets } from '@wallet-standard/app';
import type { Wallet, WalletAccount } from '@wallet-standard/base';
import type {
  StandardConnectFeature,
  StandardDisconnectFeature,
  StandardEventsFeature,
} from '@wallet-standard/features';
import type {
  SolanaSignMessageFeature,
  SolanaSignAndSendTransactionFeature,
  SolanaSignTransactionFeature,
} from '@solana/wallet-standard-features';
import bs58 from 'bs58';
import { createBrowserWalletStorage, watchWalletStorage } from './wallet-storage';
import {
  API_BASE,
  apiRequest,
  ApiError,
  onUnauthorized,
  setAccessToken,
  setSessionEnabled,
} from './http';

export type WalletName = 'Phantom' | 'MetaMask';
export interface WalletSession {
  status: 'checking' | 'anonymous' | 'connecting' | 'authenticated';
  wallet: string | null;
  provider: WalletName | null;
  expiresAt: string | null;
  /** Signing is enabled only after the authenticated account matches the wallet provider. */
  signingReady?: boolean;
  restoringProvider?: boolean;
  step?: 'opening' | 'signing' | 'verifying';
}
type SolanaWallet = Wallet & {
  features: StandardConnectFeature &
    StandardEventsFeature &
    SolanaSignMessageFeature &
    Partial<
      StandardDisconnectFeature & SolanaSignAndSendTransactionFeature & SolanaSignTransactionFeature
    >;
};
const signedOutKey = 'kanto.explicitly-signed-out';
const savedSessionKey = `kanto.wallet-session:v1:${API_BASE}`;
interface SavedSession {
  wallet: string;
  provider: WalletName | null;
  expiresAt: string;
  token?: string;
}
const anonymous = (): WalletSession => ({
  status: 'anonymous',
  wallet: null,
  provider: null,
  expiresAt: null,
  signingReady: false,
});
let metamaskReady: Promise<void> | undefined;
async function ensureMetaMask() {
  metamaskReady ??= import('@metamask/connect-solana')
    .then(async ({ createSolanaClient }) => {
      const client = await createSolanaClient({
        dapp: { name: 'Kanto', url: window.location.origin },
      });
      // Adapter registration is delayed by the SDK; explicitly await it before discovery.
      await client.registerWallet();
    })
    .catch((error) => {
      metamaskReady = undefined;
      throw error;
    });
  return metamaskReady;
}
export function isSupportedSolanaWallet(wallet: Wallet): wallet is SolanaWallet {
  const features = wallet.features as Record<string, any>;
  return (
    /^(Phantom|MetaMask)$/i.test(wallet.name) &&
    wallet.chains.some((chain) => chain.startsWith('solana:')) &&
    typeof features['standard:connect']?.connect === 'function' &&
    typeof features['standard:events']?.on === 'function' &&
    typeof features['solana:signMessage']?.signMessage === 'function'
  );
}
function validAddress(address: unknown) {
  if (typeof address !== 'string') return false;
  try {
    const bytes = bs58.decode(address);
    return bytes.length === 32 && bs58.encode(bytes) === address;
  } catch {
    return false;
  }
}
function validAccount(account: WalletAccount) {
  return (
    account.publicKey.length === 32 &&
    bs58.encode(new Uint8Array(account.publicKey)) === account.address &&
    account.chains.some((chain) => chain.startsWith('solana:')) &&
    account.features.includes('solana:signMessage')
  );
}
function withRestoreTimeout<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = () => finish(() => reject(new Error('Wallet restoration interrupted.')));
    const timer = setTimeout(
      () => finish(() => reject(new Error('Wallet restoration timed out.'))),
      3000,
    );
    const finish = (done: () => void) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', stop);
      done();
    };
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop();
    promise.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    );
  });
}
async function findRestoringWallet(
  registry: ReturnType<typeof getWallets>,
  name: WalletName,
  signal: AbortSignal,
) {
  const find = () =>
    registry
      .get()
      .find(
        (wallet) =>
          wallet.name.toLowerCase() === name.toLowerCase() && isSupportedSolanaWallet(wallet),
      ) as SolanaWallet | undefined;
  const available = find();
  if (available) return available;
  let off: (() => void) | undefined;
  try {
    return await withRestoreTimeout(
      new Promise<SolanaWallet>((resolve) => {
        const check = () => {
          const wallet = find();
          if (wallet) resolve(wallet);
        };
        off = registry.on('register', check);
        check();
      }),
      signal,
    );
  } finally {
    off?.();
  }
}
export interface PreparedTransaction {
  intentId: string;
  transactionBase64: string;
  mint: string;
  blockhash: string;
  lastValidBlockHeight: number;
  chain: 'solana:mainnet' | 'solana:devnet';
}
interface ControllerDependencies {
  request: typeof apiRequest;
  wallets: typeof getWallets;
  ensureMetaMask: () => Promise<void>;
  setAccessToken: typeof setAccessToken;
  setSessionEnabled: typeof setSessionEnabled;
  onUnauthorized: typeof onUnauthorized;
  storage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined;
  onStorageChange: (changed: () => void) => () => void;
}
/** Dependency boundary keeps Wallet Standard/HTTP races testable without an installed extension. */
export function createWalletController(overrides: Partial<ControllerDependencies> = {}) {
  const deps: ControllerDependencies = {
    request: apiRequest,
    wallets: getWallets,
    ensureMetaMask,
    setAccessToken,
    setSessionEnabled,
    onUnauthorized,
    storage: createBrowserWalletStorage(savedSessionKey, signedOutKey),
    onStorageChange: overrides.storage
      ? () => () => {}
      : (changed) => watchWalletStorage(savedSessionKey, signedOutKey, changed),
    ...overrides,
  };
  let session: WalletSession = { ...anonymous(), status: 'checking' };
  let connected: { wallet: SolanaWallet; account: WalletAccount } | null = null;
  let stopWalletEvents: (() => void) | undefined;
  let restoringProvider: AbortController | undefined;
  let generation = 0;
  let currentToken: string | null = null;
  let disconnecting: Promise<void> | undefined;
  const listeners = new Set<(session: WalletSession) => void>();
  function rememberSignedOut(value: boolean) {
    try {
      if (value) deps.storage()?.setItem(signedOutKey, '1');
      else deps.storage()?.removeItem(signedOutKey);
    } catch {
      /* Optional browser persistence. */
    }
  }
  function emit(next: WalletSession) {
    session = next;
    listeners.forEach((listener) => listener(next));
  }
  function saveSession(value: SavedSession | null) {
    try {
      if (value) deps.storage()?.setItem(savedSessionKey, JSON.stringify(value));
      else deps.storage()?.removeItem(savedSessionKey);
    } catch {
      // Storage-disabled browsers can still use the HttpOnly cookie or in-memory session.
    }
  }
  function readSavedSession(): SavedSession | null {
    try {
      const value = JSON.parse(deps.storage()?.getItem(savedSessionKey) || 'null');
      if (
        value &&
        validAddress(value.wallet) &&
        (value.provider === null ||
          value.provider === 'Phantom' ||
          value.provider === 'MetaMask') &&
        typeof value.expiresAt === 'string' &&
        Date.parse(value.expiresAt) > Date.now() &&
        (value.token === undefined ||
          (typeof value.token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value.token)))
      )
        return value;
    } catch {
      /* Ignore malformed or unavailable browser storage. */
    }
    saveSession(null);
    return null;
  }
  function clearConnection() {
    restoringProvider?.abort();
    restoringProvider = undefined;
    connected = null;
    stopWalletEvents?.();
    stopWalletEvents = undefined;
  }
  function clearSession(explicit: boolean, forget = true) {
    clearConnection();
    currentToken = null;
    deps.setAccessToken(null);
    deps.setSessionEnabled(false);
    if (forget) saveSession(null);
    if (explicit) rememberSignedOut(true);
    emit(anonymous());
  }
  const stopUnauthorized = deps.onUnauthorized(() => {
    generation++;
    clearSession(true);
  });
  const stopStorage = deps.onStorageChange(() => {
    let signedOut = false;
    try {
      signedOut = !!deps.storage()?.getItem(signedOutKey);
    } catch {
      return;
    }
    const saved = readSavedSession();
    if (!saved || signedOut) {
      generation++;
      clearSession(false, false);
    } else if ((saved.token || null) !== currentToken || saved.wallet !== session.wallet) {
      void restoreWalletSession().catch(() => {});
    }
  });
  function attachProvider(wallet: SolanaWallet, account: WalletAccount) {
    clearConnection();
    connected = { wallet, account };
    stopWalletEvents = wallet.features['standard:events'].on('change', (change) => {
      if (!change.accounts) return;
      const matching = change.accounts.find(
        (item) => item.address === account.address && validAccount(item),
      );
      if (matching) {
        if (session.status === 'authenticated' && session.wallet === matching.address) {
          connected = { wallet, account: matching };
          emit({ ...session, signingReady: true, restoringProvider: false });
        }
        return;
      }
      if (!change.accounts.length && session.status === 'authenticated') {
        // A mobile provider can temporarily lose its connection. Stop signing immediately,
        // but do not revoke the independently verified Kanto session or forget its token.
        generation++;
        connected = null;
        restoringProvider?.abort();
        restoringProvider = undefined;
        emit({ ...session, signingReady: false, restoringProvider: false });
        return;
      }
      // A different exposed account is a real wallet switch, not a temporary disconnect.
      void disconnectWallet().catch(() => {});
    });
  }
  async function restoreProvider(attempt: number, preferred: WalletName | null, address: string) {
    const restore = new AbortController();
    restoringProvider = restore;
    try {
      const registry = deps.wallets();
      if (preferred === 'MetaMask') await withRestoreTimeout(deps.ensureMetaMask(), restore.signal);
      if (attempt !== generation) return;
      const wallet = preferred
        ? await findRestoringWallet(registry, preferred, restore.signal)
        : (registry
            .get()
            .find(
              (item) =>
                isSupportedSolanaWallet(item) &&
                item.accounts.some(
                  (account) => validAccount(account) && account.address === address,
                ),
            ) as SolanaWallet | undefined);
      if (!wallet || attempt !== generation) return;
      let account = wallet.accounts.find((item) => validAccount(item) && item.address === address);
      // Phantom implements silent authorization. The MetaMask adapter ignores the
      // silent flag, so only reuse accounts restored by its existing SDK session.
      if (!account && wallet.name.toLowerCase() === 'phantom') {
        const result = await withRestoreTimeout(
          wallet.features['standard:connect'].connect({ silent: true }),
          restore.signal,
        );
        account = result.accounts.find((item) => validAccount(item) && item.address === address);
      }
      if (!account || attempt !== generation) return;
      attachProvider(wallet, account);
      const provider: WalletName = wallet.name.toLowerCase() === 'phantom' ? 'Phantom' : 'MetaMask';
      const saved = readSavedSession();
      if (saved?.wallet === address) saveSession({ ...saved, provider });
      emit({ ...session, provider, signingReady: true, restoringProvider: false });
    } catch {
      // A locked/unavailable extension must not discard a valid Kanto sign-in.
    } finally {
      if (restoringProvider === restore) restoringProvider = undefined;
      if (attempt === generation && session.status === 'authenticated' && session.restoringProvider)
        emit({ ...session, restoringProvider: false });
    }
  }
  async function restoreWalletSession() {
    const attempt = ++generation;
    clearConnection();
    currentToken = null;
    deps.setAccessToken(null);
    deps.setSessionEnabled(false);
    emit({ ...anonymous(), status: 'checking' });
    try {
      if (deps.storage()?.getItem(signedOutKey)) {
        clearSession(false);
        return;
      }
    } catch {
      /* Cookies may still restore the session. */
    }
    const saved = readSavedSession();
    try {
      const value = await deps.request<{
        authenticated: boolean;
        wallet: string | null;
        expiresAt: string | null;
      }>('/v1/auth/session', {
        auth: false,
        credentials: saved?.token ? 'omit' : 'include',
        ...(saved?.token ? { headers: { Authorization: `Bearer ${saved.token}` } } : {}),
      });
      if (attempt !== generation) return;
      clearConnection();
      deps.setAccessToken(null);
      if (
        value?.authenticated === true &&
        validAddress(value.wallet) &&
        typeof value.expiresAt === 'string' &&
        Date.parse(value.expiresAt) > Date.now() &&
        (!saved?.token || saved.wallet === value.wallet)
      ) {
        const provider = saved?.wallet === value.wallet ? saved.provider : null;
        deps.setAccessToken(saved?.token || null);
        currentToken = saved?.token || null;
        deps.setSessionEnabled(true);
        saveSession({
          wallet: value.wallet!,
          provider,
          expiresAt: value.expiresAt,
          ...(saved?.token ? { token: saved.token } : {}),
        });
        emit({
          status: 'authenticated',
          wallet: value.wallet,
          provider,
          expiresAt: value.expiresAt,
          signingReady: false,
          restoringProvider: true,
        });
        await restoreProvider(attempt, provider, value.wallet!);
      } else clearSession(false);
    } catch (error) {
      if (attempt === generation)
        clearSession(false, error instanceof ApiError && [401, 403].includes(error.status));
      throw error;
    }
  }
  async function resumeWalletSession() {
    if (session.status === 'checking' || session.status === 'connecting') return;
    try {
      if (deps.storage()?.getItem(signedOutKey)) {
        if (session.status === 'authenticated') {
          generation++;
          clearSession(false, false);
        }
        return;
      }
    } catch {
      /* Storage-disabled browsers can keep their in-memory session. */
    }
    const saved = readSavedSession();
    if (saved?.token && (saved.token !== currentToken || saved.wallet !== session.wallet)) {
      await restoreWalletSession();
      return;
    }
    if (session.status !== 'authenticated') return;
    if (!session.expiresAt || Date.parse(session.expiresAt) <= Date.now()) {
      generation++;
      clearSession(true);
      return;
    }
    if (!session.signingReady && !session.restoringProvider) {
      emit({ ...session, restoringProvider: true });
      await restoreProvider(generation, session.provider, session.wallet!);
    }
  }
  async function disconnectWallet() {
    const attempt = ++generation,
      previous = connected;
    clearConnection();
    currentToken = null;
    // Construct the revocation while the current bearer is still available.
    const revoke = deps.request('/v1/auth/logout', { method: 'POST', json: {} });
    deps.setAccessToken(null);
    deps.setSessionEnabled(false);
    rememberSignedOut(true);
    saveSession(null);
    emit(anonymous());
    const work = (async () => {
      try {
        await revoke;
      } finally {
        if (attempt === generation)
          await previous?.wallet.features['standard:disconnect']?.disconnect().catch(() => {});
      }
    })();
    disconnecting = work;
    try {
      await work;
    } finally {
      if (disconnecting === work) disconnecting = undefined;
    }
  }
  async function connectWallet(name: WalletName) {
    if ((session as WalletSession).status === 'connecting') return;
    if (session.status === 'authenticated') await disconnectWallet().catch(() => {});
    else if (disconnecting) await disconnecting.catch(() => {});
    if (session.status === 'connecting') return;
    const attempt = ++generation;
    const current = () => {
      if (attempt !== generation)
        throw new Error('Your wallet connection changed. Please connect again.');
    };
    emit({
      status: 'connecting',
      wallet: null,
      provider: name,
      step: 'opening',
      expiresAt: null,
      signingReady: false,
    });
    try {
      const registry = deps.wallets();
      if (name === 'MetaMask') await deps.ensureMetaMask();
      current();
      const wallet = registry
        .get()
        .find(
          (item) => item.name.toLowerCase() === name.toLowerCase() && isSupportedSolanaWallet(item),
        ) as SolanaWallet | undefined;
      if (!wallet)
        throw new Error(
          `Open Kanto inside ${name}'s mobile browser, or install its Solana-enabled browser extension.`,
        );
      const { accounts } = await wallet.features['standard:connect'].connect();
      current();
      const account = accounts.find(validAccount);
      if (!account)
        throw new Error(
          'Select a valid Solana account in your wallet. Ethereum accounts cannot sign in to Kanto.',
        );
      attachProvider(wallet, account);
      const challenge = await deps.request<{
        challengeId: string;
        message: string;
        expiresAt: string;
      }>('/v1/auth/challenge', {
        method: 'POST',
        json: { wallet: account.address },
        auth: false,
        credentials: 'include',
      });
      current();
      if (
        !challenge ||
        typeof challenge.challengeId !== 'string' ||
        typeof challenge.message !== 'string' ||
        !challenge.message.length ||
        challenge.message.length > 8192
      )
        throw new Error('The server returned an invalid sign-in challenge.');
      emit({ ...session, step: 'signing' });
      const message = new TextEncoder().encode(challenge.message);
      const [proof] = await wallet.features['solana:signMessage'].signMessage({ account, message });
      current();
      if (
        !proof ||
        proof.signature.length !== 64 ||
        (proof.signatureType && proof.signatureType !== 'ed25519') ||
        proof.signedMessage.length !== message.length ||
        !proof.signedMessage.every((byte, i) => byte === message[i])
      )
        throw new Error('The wallet signed a different message. Please reconnect.');
      if (connected?.account.address !== account.address)
        throw new Error('Your wallet account changed. Please connect again.');
      emit({ ...session, step: 'verifying' });
      const verified = await deps.request<{
        authenticated: true;
        wallet: string;
        token: string;
        expiresAt: string;
      }>('/v1/auth/verify', {
        method: 'POST',
        json: { challengeId: challenge.challengeId, signature: bs58.encode(proof.signature) },
        auth: false,
        credentials: 'include',
      });
      current();
      if (
        verified?.authenticated !== true ||
        verified.wallet !== account.address ||
        typeof verified.token !== 'string' ||
        !/^[A-Za-z0-9_-]{43}$/.test(verified.token) ||
        !Number.isFinite(Date.parse(verified.expiresAt)) ||
        Date.parse(verified.expiresAt) <= Date.now()
      )
        throw new Error('Wallet verification did not match the connected account.');
      deps.setAccessToken(verified.token);
      deps.setSessionEnabled(true);
      // Verify the bearer independently of third-party cookies before announcing success.
      const confirmed = await deps.request<{ authenticated: boolean; wallet: string | null }>(
        '/v1/auth/session',
        { credentials: 'omit' },
      );
      current();
      if (!confirmed?.authenticated || confirmed.wallet !== account.address)
        throw new Error(
          'Your signature was accepted, but Kanto couldn’t keep you signed in. Please try connecting again.',
        );
      rememberSignedOut(false);
      currentToken = verified.token;
      saveSession({
        wallet: verified.wallet,
        provider: name,
        expiresAt: verified.expiresAt,
        token: verified.token,
      });
      emit({
        status: 'authenticated',
        wallet: verified.wallet,
        provider: name,
        expiresAt: verified.expiresAt,
        signingReady: true,
      });
    } catch (error) {
      if (attempt === generation) clearSession(false);
      throw error;
    }
  }
  async function signAndSendPrepared(
    prepared: PreparedTransaction,
    onSigning?: () => void,
    submitPath?: string,
  ): Promise<string> {
    if (submitPath && !/^\/v1\/battles\/[^/]+\/escrow\/submit$/.test(submitPath))
      throw new Error('Invalid transaction submission endpoint.');
    const active = connected,
      attempt = generation;
    if (!active || session.status !== 'authenticated' || active.account.address !== session.wallet)
      throw new Error('Reconnect your wallet before signing a transaction.');
    if (!active.account.chains.includes(prepared.chain))
      throw new Error('Switch your wallet to the transaction’s Solana network.');
    const transaction = Uint8Array.from(atob(prepared.transactionBase64), (character) =>
      character.charCodeAt(0),
    );
    if (transaction.length < 64 || transaction.length > 5000)
      throw new Error('The server returned an invalid transaction.');
    const send = active.wallet.features['solana:signAndSendTransaction'];
    if (send) {
      onSigning?.();
      const [result] = await send.signAndSendTransaction({
        account: active.account,
        transaction,
        chain: prepared.chain,
        options: { commitment: 'confirmed' },
      });
      if (attempt !== generation)
        throw new Error(
          'Your wallet changed. The transaction may already have been submitted; check its status.',
        );
      if (!result || result.signature.length !== 64)
        throw new Error('The wallet did not return a transaction signature.');
      return bs58.encode(result.signature);
    }
    const sign = active.wallet.features['solana:signTransaction'];
    if (!sign) throw new Error('This wallet cannot sign Solana transactions.');
    onSigning?.();
    const [result] = await sign.signTransaction({
      account: active.account,
      transaction,
      chain: prepared.chain,
    });
    if (
      attempt !== generation ||
      connected?.account.address !== active.account.address ||
      session.wallet !== active.account.address
    )
      throw new Error('Your wallet changed before submission.');
    if (!result || result.signedTransaction.length < 64 || result.signedTransaction.length > 5000)
      throw new Error('The wallet returned an invalid signed transaction.');
    const sent = await deps.request<{ signature: string }>(
      submitPath || `/v1/transactions/${encodeURIComponent(prepared.intentId)}/submit`,
      {
        method: 'POST',
        json: {
          ...(submitPath ? { intentId: prepared.intentId } : {}),
          signedTransactionBase64: btoa(String.fromCharCode(...result.signedTransaction)),
        },
      },
    );
    return sent.signature;
  }
  return {
    currentWalletSession: () => session,
    subscribeWalletSession(listener: (next: WalletSession) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    restoreWalletSession,
    resumeWalletSession,
    connectWallet,
    disconnectWallet,
    signAndSendPrepared,
    dispose() {
      generation++;
      clearConnection();
      stopUnauthorized();
      stopStorage();
      listeners.clear();
    },
  };
}
const controller = createWalletController();
export const currentWalletSession = controller.currentWalletSession;
export const subscribeWalletSession = controller.subscribeWalletSession;
export const restoreWalletSession = controller.restoreWalletSession;
export const resumeWalletSession = controller.resumeWalletSession;
export const connectWallet = controller.connectWallet;
export const disconnectWallet = controller.disconnectWallet;
export const signAndSendPrepared = controller.signAndSendPrepared;
