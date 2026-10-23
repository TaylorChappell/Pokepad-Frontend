import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { getWallets } from '@wallet-standard/app';
import type { Wallet, WalletAccount } from '@wallet-standard/base';
import { apiRequest } from './http';
import { isMobileBrowser } from './phantom-mobile';

const PREFIX = 'kanto.phantom-link:v1:';
const SESSION = PREFIX + 'session';
const TTL = 5 * 60_000;
const SESSION_TTL = 7 * 24 * 60 * 60_000;
const encoder = new TextEncoder();
interface LinkSession {
  secret: string; // Ephemeral encryption key, never the wallet's signing key.
  phantomKey: string;
  session: string;
  wallet: string;
  expiresAt: number;
}
interface Pending {
  id: string;
  kind: 'connect' | 'login' | 'signMessage' | 'signTransaction';
  expiresAt: number;
  returnTo: string;
  secret: string;
  connection?: LinkSession;
  challenge?: { challengeId: string; message: string; expiresAt: string };
}
export interface MobileSignInProof {
  wallet: string;
  challengeId: string;
  message: string;
  signature: Uint8Array;
}
export interface PhantomApproval {
  href: string;
  title: string;
  opened: boolean;
  cancel: () => void;
}
let approval: PhantomApproval | null = null;
const listeners = new Set<() => void>();
export const getPhantomApproval = () => approval;
export const subscribePhantomApproval = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
function publish(value: PhantomApproval | null) {
  approval = value;
  listeners.forEach((fn) => fn());
}
export function markPhantomOpened() {
  if (approval) publish({ ...approval, opened: true });
}
function storage() {
  try {
    const result = window.localStorage;
    const probe = PREFIX + 'probe';
    result.setItem(probe, '1');
    result.removeItem(probe);
    return result;
  } catch {
    throw new Error('Allow website storage in your browser before connecting Phantom.');
  }
}
function read<T>(key: string): T | null {
  try {
    return JSON.parse(storage().getItem(key) || 'null');
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  storage().setItem(key, JSON.stringify(value));
}
function bytes(value: unknown, length?: number) {
  if (typeof value !== 'string' || value.length > 30_000)
    throw new Error('Invalid Phantom response.');
  const result = bs58.decode(value);
  if ((length && result.length !== length) || bs58.encode(result) !== value)
    throw new Error('Invalid Phantom response.');
  return result;
}
function id() {
  return bs58.encode(nacl.randomBytes(24));
}
function secretKey() {
  return bs58.encode(nacl.box.keyPair().secretKey);
}
function validReturn(value: string) {
  return /^#\/[\s\S]*$/.test(value) ? value : '#/discover';
}
function persist(pending: Omit<Pending, 'id' | 'expiresAt'>): Pending {
  const saved = storage();
  for (const key of Object.keys(saved)) {
    if (!key.startsWith(PREFIX) || key === SESSION) continue;
    const record = read<{ expiresAt?: number }>(key);
    if (!record || !record.expiresAt || record.expiresAt <= Date.now()) saved.removeItem(key);
  }
  const value = { ...pending, id: id(), expiresAt: Date.now() + TTL };
  write(PREFIX + value.id, value);
  return value;
}
function callbackUrl(request: Pending) {
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set('kanto_phantom', request.id);
  return url.href;
}
function link(request: Pending, method: string, payload?: object) {
  const url = new URL('https://phantom.com/ul/v1/' + method);
  const publicKey = nacl.box.keyPair.fromSecretKey(bytes(request.secret, 32)).publicKey;
  url.searchParams.set('dapp_encryption_public_key', bs58.encode(publicKey));
  url.searchParams.set('redirect_link', callbackUrl(request));
  if (method === 'connect') {
    url.searchParams.set('app_url', window.location.origin);
    url.searchParams.set('cluster', 'mainnet-beta');
  } else {
    const session = request.connection!;
    const shared = nacl.box.before(bytes(session.phantomKey, 32), bytes(session.secret, 32));
    const nonce = nacl.randomBytes(24);
    url.searchParams.set('nonce', bs58.encode(nonce));
    url.searchParams.set(
      'payload',
      bs58.encode(
        nacl.box.after(
          encoder.encode(JSON.stringify({ ...payload, session: session.session })),
          nonce,
          shared,
        ),
      ),
    );
  }
  return url.href;
}
function decode(params: URLSearchParams, pending: Pending): Record<string, unknown> {
  if (params.has('errorCode'))
    throw new Error(
      'Phantom approval was cancelled or could not be completed. Try connecting again.',
    );
  const shared = nacl.box.before(
    bytes(pending.connection?.phantomKey || params.get('phantom_encryption_public_key'), 32),
    bytes(pending.secret, 32),
  );
  const plain = nacl.box.open.after(
    bytes(params.get('data')),
    bytes(params.get('nonce'), 24),
    shared,
  );
  if (!plain)
    throw new Error('Kanto could not verify the response from Phantom. Please connect again.');
  const value = JSON.parse(new TextDecoder().decode(plain));
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid Phantom response.');
  return value;
}
export function useExternalPhantom() {
  if (typeof window === 'undefined' || !isMobileBrowser(window.navigator)) return false;
  const host = window as Window & {
    phantom?: { solana?: { isPhantom?: boolean } };
    solana?: { isPhantom?: boolean };
  };
  const injected = host.phantom?.solana?.isPhantom || host.solana?.isPhantom;
  return (
    !injected &&
    !getWallets()
      .get()
      .some((wallet) => wallet.name === 'Phantom' && wallet !== mobileWallet)
  );
}
export function startPhantomSignIn() {
  if (window.location.protocol !== 'https:')
    throw new Error('Open Kanto over HTTPS to connect Phantom.');
  const request = persist({
    kind: 'connect',
    secret: secretKey(),
    returnTo: validReturn(window.location.hash),
  });
  return link(request, 'connect');
}
function connection(): LinkSession | null {
  const saved = read<LinkSession>(SESSION);
  try {
    if (!saved || saved.expiresAt <= Date.now() || !saved.session || saved.session.length > 10_000)
      return null;
    bytes(saved.secret, 32);
    bytes(saved.phantomKey, 32);
    bytes(saved.wallet, 32);
    return saved;
  } catch {
    return null;
  }
}
export function clearPhantomSession() {
  approval?.cancel();
  storage().removeItem(SESSION);
}
export function hasPhantomCallback() {
  return new URLSearchParams(window.location.search).has('kanto_phantom');
}
export type PhantomCallbackResult =
  | { kind: 'login'; href: string; returnTo: string; cancel: () => void }
  | { kind: 'proof'; proof: MobileSignInProof; returnTo: string }
  | { kind: 'delivered'; returnTo: string };
/** Called once before mounting the app. Every callback is single-use and origin/storage bound. */
export async function consumePhantomCallback(
  request: typeof apiRequest = apiRequest,
): Promise<PhantomCallbackResult> {
  const params = new URLSearchParams(window.location.search);
  const requestId = params.get('kanto_phantom') || '';
  // Remove encrypted response data before any page navigation or external request.
  window.history.replaceState(window.history.state, '', window.location.pathname + '#/discover');
  if (!/^[1-9A-HJ-NP-Za-km-z]{20,40}$/.test(requestId))
    throw new Error('This Phantom request is not valid. Connect again from Kanto.');
  const pending = read<Pending>(PREFIX + requestId);
  if (!pending || pending.id !== requestId || pending.expiresAt <= Date.now()) {
    storage().removeItem(PREFIX + requestId);
    throw new Error(
      'This request has expired, or opened in a different browser. Open Kanto in your default browser and connect again.',
    );
  }
  if (pending.kind === 'signMessage' || pending.kind === 'signTransaction') {
    // Only the original, still-open tab can finish or submit a signed transaction.
    // Store encrypted data, not a bearer token or plaintext signed transaction.
    write(PREFIX + requestId + ':result', {
      expiresAt: pending.expiresAt,
      params: Object.fromEntries(
        ['nonce', 'data', 'errorCode']
          .filter((key) => params.has(key))
          .map((key) => [key, params.get(key)]),
      ),
    });
    storage().removeItem(PREFIX + requestId);
    return { kind: 'delivered', returnTo: validReturn(pending.returnTo) };
  }
  storage().removeItem(PREFIX + requestId);
  const payload = decode(params, pending);
  if (pending.kind === 'connect') {
    bytes(payload.public_key, 32);
    bytes(params.get('phantom_encryption_public_key'), 32);
    if (typeof payload.session !== 'string' || !payload.session || payload.session.length > 10_000)
      throw new Error('Phantom did not return a valid connection.');
    const session: LinkSession = {
      wallet: payload.public_key as string,
      secret: pending.secret,
      phantomKey: params.get('phantom_encryption_public_key')!,
      session: payload.session,
      expiresAt: Date.now() + SESSION_TTL,
    };
    const challenge = await request<NonNullable<Pending['challenge']>>('/v1/auth/challenge', {
      method: 'POST',
      auth: false,
      credentials: 'include',
      json: { wallet: session.wallet },
    });
    if (
      !challenge?.challengeId ||
      typeof challenge.message !== 'string' ||
      !challenge.message.length ||
      challenge.message.length > 8192 ||
      !Number.isFinite(Date.parse(challenge.expiresAt)) ||
      Date.parse(challenge.expiresAt) <= Date.now()
    )
      throw new Error('Kanto could not prepare your sign-in. Please try again.');
    const next = persist({ ...pending, kind: 'login', connection: session, challenge });
    return {
      kind: 'login',
      returnTo: validReturn(pending.returnTo),
      href: link(next, 'signMessage', {
        message: bs58.encode(encoder.encode(challenge.message)),
        display: 'utf8',
      }),
      cancel: () => storage().removeItem(PREFIX + next.id),
    };
  }
  const session = pending.connection,
    challenge = pending.challenge;
  if (
    !session ||
    !challenge ||
    !Number.isFinite(Date.parse(challenge.expiresAt)) ||
    Date.parse(challenge.expiresAt) <= Date.now()
  )
    throw new Error('Your sign-in expired. Connect again.');
  const signature = bytes(payload.signature, 64);
  if (
    !nacl.sign.detached.verify(
      encoder.encode(challenge.message),
      signature,
      bytes(session.wallet, 32),
    )
  )
    throw new Error('The signed message does not match your wallet. Connect again.');
  write(SESSION, session);
  registerMobilePhantom();
  return {
    kind: 'proof',
    returnTo: validReturn(pending.returnTo),
    proof: {
      wallet: session.wallet,
      challengeId: challenge.challengeId,
      message: challenge.message,
      signature,
    },
  };
}
function requestApproval(
  session: LinkSession,
  kind: 'signMessage' | 'signTransaction',
  payload: object,
): Promise<Record<string, unknown>> {
  if (approval)
    return Promise.reject(new Error('Finish or cancel your current Phantom approval first.'));
  const pending = persist({
    kind,
    secret: session.secret,
    connection: session,
    returnTo: validReturn(window.location.hash),
  });
  const key = PREFIX + pending.id;
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (value?: Record<string, unknown>, error?: Error) => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      window.removeEventListener('storage', check);
      window.removeEventListener('focus', check);
      storage().removeItem(key);
      storage().removeItem(key + ':result');
      publish(null);
      if (error) reject(error);
      else resolve(value!);
    };
    const check = () => {
      try {
        const result = read<{ params: Record<string, string> }>(key + ':result');
        if (Date.now() >= pending.expiresAt)
          return finish(
            undefined,
            new Error('Phantom approval timed out. Nothing was sent. Please try again.'),
          );
        if (result) finish(decode(new URLSearchParams(result.params), pending));
      } catch (error) {
        finish(undefined, error instanceof Error ? error : new Error('Invalid Phantom response.'));
      }
    };
    const timer = setInterval(check, 500);
    window.addEventListener('storage', check);
    window.addEventListener('focus', check);
    publish({
      href: link(pending, kind, payload),
      title: kind === 'signTransaction' ? 'Approve your transaction' : 'Confirm your sign-in',
      opened: false,
      cancel: () => finish(undefined, new Error('Phantom approval cancelled. Nothing was sent.')),
    });
  });
}
let mobileWallet: Wallet | undefined;
/** Adapter keeps the existing transaction validation and backend submission path intact. */
export function registerMobilePhantom() {
  if (typeof window === 'undefined' || mobileWallet || !useExternalPhantom() || !connection())
    return;
  const events = new Set<(event: { accounts: WalletAccount[] }) => void>();
  const accounts = (): WalletAccount[] => {
    const current = connection();
    return current
      ? [
          {
            address: current.wallet,
            publicKey: bytes(current.wallet, 32),
            chains: ['solana:mainnet'],
            features: ['solana:signMessage', 'solana:signTransaction'],
          },
        ]
      : [];
  };
  function matching(account: WalletAccount) {
    const current = connection();
    if (!current || current.wallet !== account.address)
      throw new Error('Reconnect Phantom before approving this request.');
    return current;
  }
  mobileWallet = {
    version: '1.0.0',
    name: 'Phantom',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=',
    chains: ['solana:mainnet'],
    get accounts() {
      return accounts();
    },
    features: {
      'standard:connect': { version: '1.0.0', connect: async () => ({ accounts: accounts() }) },
      'standard:events': {
        version: '1.0.0',
        on: (_event: string, fn: (event: { accounts: WalletAccount[] }) => void) => {
          events.add(fn);
          return () => events.delete(fn);
        },
      },
      'standard:disconnect': {
        version: '1.0.0',
        disconnect: async () => {
          clearPhantomSession();
          events.forEach((fn) => fn({ accounts: [] }));
        },
      },
      'solana:signMessage': {
        version: '1.0.0',
        signMessage: async (...inputs: { account: WalletAccount; message: Uint8Array }[]) => {
          if (inputs.length !== 1) throw new Error('Approve one message at a time.');
          const { account, message } = inputs[0];
          const current = matching(account);
          const result = await requestApproval(current, 'signMessage', {
            message: bs58.encode(message),
            display: 'utf8',
          });
          const signature = bytes(result.signature, 64);
          if (!nacl.sign.detached.verify(message, signature, bytes(current.wallet, 32)))
            throw new Error('Phantom returned a different message signature.');
          return [{ signature, signedMessage: message, signatureType: 'ed25519' }];
        },
      },
      'solana:signTransaction': {
        version: '1.0.0',
        supportedTransactionVersions: ['legacy', 0],
        signTransaction: async (
          ...inputs: { account: WalletAccount; transaction: Uint8Array; chain?: string }[]
        ) => {
          if (inputs.length !== 1) throw new Error('Approve one transaction at a time.');
          const { account, transaction, chain } = inputs[0];
          if (chain !== 'solana:mainnet')
            throw new Error('This Phantom connection is on Solana mainnet.');
          const current = matching(account);
          const result = await requestApproval(current, 'signTransaction', {
            transaction: bs58.encode(transaction),
          });
          return [{ signedTransaction: bytes(result.transaction) }];
        },
      },
    },
  };
  getWallets().register(mobileWallet);
}
