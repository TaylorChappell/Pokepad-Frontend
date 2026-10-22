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
import { apiRequest, onUnauthorized, setAccessToken, setSessionEnabled } from './http';

export type WalletName = 'Phantom' | 'MetaMask';
export interface WalletSession {
  status: 'checking' | 'anonymous' | 'connecting' | 'authenticated';
  wallet: string | null;
  provider: WalletName | null;
  expiresAt: string | null;
  /** Cookie restoration authenticates browsing, but a provider must reconnect before signing. */
  signingReady?: boolean;
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
      // The installed SDK registers its Wallet Standard adapter before resolving.
      await createSolanaClient({ dapp: { name: 'Kanto', url: window.location.origin } });
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
    storage: () => (typeof window === 'undefined' ? undefined : window.sessionStorage),
    ...overrides,
  };
  let session: WalletSession = { ...anonymous(), status: 'checking' };
  let connected: { wallet: SolanaWallet; account: WalletAccount } | null = null;
  let stopWalletEvents: (() => void) | undefined;
  let generation = 0;
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
  function clearConnection() {
    connected = null;
    stopWalletEvents?.();
    stopWalletEvents = undefined;
  }
  function clearSession(explicit: boolean) {
    clearConnection();
    deps.setAccessToken(null);
    deps.setSessionEnabled(false);
    if (explicit) rememberSignedOut(true);
    emit(anonymous());
  }
  const stopUnauthorized = deps.onUnauthorized(() => {
    generation++;
    clearSession(true);
  });
  async function restoreWalletSession() {
    const attempt = ++generation;
    try {
      if (deps.storage()?.getItem(signedOutKey)) {
        clearSession(false);
        return;
      }
    } catch {
      /* Cookies may still restore the session. */
    }
    try {
      const value = await deps.request<{
        authenticated: boolean;
        wallet: string | null;
        expiresAt: string | null;
      }>('/v1/auth/session', { auth: false, credentials: 'include' });
      if (attempt !== generation) return;
      clearConnection();
      deps.setAccessToken(null);
      if (
        value?.authenticated === true &&
        validAddress(value.wallet) &&
        typeof value.expiresAt === 'string' &&
        Number.isFinite(Date.parse(value.expiresAt))
      ) {
        deps.setSessionEnabled(true);
        emit({
          status: 'authenticated',
          wallet: value.wallet,
          provider: null,
          expiresAt: value.expiresAt,
          signingReady: false,
        });
      } else clearSession(false);
    } catch (error) {
      if (attempt === generation) clearSession(false);
      throw error;
    }
  }
  async function disconnectWallet() {
    const attempt = ++generation,
      previous = connected;
    clearConnection();
    // Construct the revocation while the current bearer is still available.
    const revoke = deps.request('/v1/auth/logout', { method: 'POST', json: {} });
    deps.setAccessToken(null);
    deps.setSessionEnabled(false);
    rememberSignedOut(true);
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
      clearConnection();
      connected = { wallet, account };
      stopWalletEvents = wallet.features['standard:events'].on('change', (change) => {
        if (
          change.accounts &&
          !change.accounts.some((item) => item.address === account.address && validAccount(item))
        )
          void disconnectWallet().catch(() => {});
      });
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
      // Verify the memory bearer independently of third-party cookies before announcing success.
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
    connectWallet,
    disconnectWallet,
    signAndSendPrepared,
    dispose() {
      generation++;
      clearConnection();
      stopUnauthorized();
      listeners.clear();
    },
  };
}
const controller = createWalletController();
export const currentWalletSession = controller.currentWalletSession;
export const subscribeWalletSession = controller.subscribeWalletSession;
export const restoreWalletSession = controller.restoreWalletSession;
export const connectWallet = controller.connectWallet;
export const disconnectWallet = controller.disconnectWallet;
export const signAndSendPrepared = controller.signAndSendPrepared;
