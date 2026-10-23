import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { getWallets } from '@wallet-standard/app';
import {
  startPhantomSignIn,
  consumePhantomCallback,
  getPhantomApproval,
  useExternalPhantom,
  clearPhantomSession,
} from '../src/services/phantom-deeplink';
import type { apiRequest } from '../src/services/http';

const PREFIX = 'kanto.phantom-link:v1:';
function browser() {
  getWallets();
  const dom = new JSDOM('', { url: 'https://kanto.test/#/walk' });
  Object.defineProperty(dom.window.navigator, 'userAgent', { value: 'Mozilla iPhone' });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  return dom;
}
const signing = nacl.sign.keyPair();
const phantom = nacl.box.keyPair();
const wallet = bs58.encode(signing.publicKey);
const message =
  'kanto.test wants you to sign in with your Solana account:\n' +
  wallet +
  '\n\nPokémon trainer sign-in. Nonce: 123';
function response(dom: JSDOM, request: string, value: object) {
  const link = new URL(request);
  const shared = nacl.box.before(
    bs58.decode(link.searchParams.get('dapp_encryption_public_key')!),
    phantom.secretKey,
  );
  const nonce = nacl.randomBytes(24);
  const redirect = new URL(link.searchParams.get('redirect_link')!);
  redirect.searchParams.set('phantom_encryption_public_key', bs58.encode(phantom.publicKey));
  redirect.searchParams.set('nonce', bs58.encode(nonce));
  redirect.searchParams.set(
    'data',
    bs58.encode(nacl.box.after(new TextEncoder().encode(JSON.stringify(value)), nonce, shared)),
  );
  dom.window.history.replaceState(null, '', redirect);
  return redirect.href;
}
const request = (async (path: string, options: any) => {
  assert.equal(path, '/v1/auth/challenge');
  assert.equal(options.auth, false);
  assert.equal(options.json.wallet, wallet);
  return {
    challengeId: 'challenge-1',
    message,
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
  };
}) as typeof apiRequest;
async function connect(dom: JSDOM) {
  const link = startPhantomSignIn();
  const url = new URL(link);
  assert.equal(url.pathname, '/ul/v1/connect');
  assert.equal(url.searchParams.get('app_url'), 'https://kanto.test');
  assert.equal(url.searchParams.has('secret'), false);
  assert.equal(new URL(url.searchParams.get('redirect_link')!).hash, '');
  response(dom, link, { public_key: wallet, session: 'opaque-phantom-session' });
  const result = await consumePhantomCallback(request);
  assert.equal(dom.window.location.search, '', 'callback data is stripped from browser history');
  assert.equal(result.kind, 'login');
  if (result.kind !== 'login') throw Error('Expected login');
  return result;
}
test('external-browser sign-in encrypts the exact message, verifies its signature, and restores a matching signer', async () => {
  const dom = browser();
  try {
    assert.equal(useExternalPhantom(), true);
    const next = await connect(dom);
    const url = new URL(next.href);
    const shared = nacl.box.before(
      bs58.decode(url.searchParams.get('dapp_encryption_public_key')!),
      phantom.secretKey,
    );
    const payload = JSON.parse(
      new TextDecoder().decode(
        nacl.box.open.after(
          bs58.decode(url.searchParams.get('payload')!),
          bs58.decode(url.searchParams.get('nonce')!),
          shared,
        )!,
      ),
    );
    assert.equal(payload.session, 'opaque-phantom-session');
    assert.equal(payload.display, 'utf8');
    assert.equal(new TextDecoder().decode(bs58.decode(payload.message)), message);
    assert.equal(next.returnTo, '#/walk');
    const callback = response(dom, next.href, {
      signature: bs58.encode(
        nacl.sign.detached(new TextEncoder().encode(message), signing.secretKey),
      ),
    });
    const final = await consumePhantomCallback(request);
    assert.equal(final.kind, 'proof');
    if (final.kind !== 'proof') throw Error('Expected signature proof');
    assert.equal(final.proof.wallet, wallet);
    assert.equal(final.proof.challengeId, 'challenge-1');
    const adapter = getWallets()
      .get()
      .find((w) => w.name === 'Phantom')!;
    assert.equal(adapter.accounts[0].address, wallet);
    assert.equal(
      useExternalPhantom(),
      true,
      'our adapter must not send users back to the in-app browser',
    );
    dom.window.history.replaceState(null, '', callback);
    await assert.rejects(consumePhantomCallback(request), /expired/);
    clearPhantomSession();
    assert.equal(adapter.accounts.length, 0);
  } finally {
    dom.window.close();
  }
});
test('expired, missing, denied and tampered callbacks cannot create a sign-in', async () => {
  const dom = browser();
  try {
    const link = startPhantomSignIn();
    const callback = new URL(new URL(link).searchParams.get('redirect_link')!);
    const key = PREFIX + callback.searchParams.get('kanto_phantom');
    const pending = JSON.parse(dom.window.localStorage.getItem(key)!);
    dom.window.localStorage.setItem(key, JSON.stringify({ ...pending, expiresAt: 1 }));
    dom.window.history.replaceState(null, '', callback);
    await assert.rejects(consumePhantomCallback(request), /expired/);
    const denied = new URL(new URL(startPhantomSignIn()).searchParams.get('redirect_link')!);
    denied.searchParams.set('errorCode', '4001');
    dom.window.history.replaceState(null, '', denied);
    await assert.rejects(consumePhantomCallback(request), /cancelled/);
    const next = await connect(dom);
    response(dom, next.href, { signature: bs58.encode(new Uint8Array(64).fill(1)) });
    await assert.rejects(consumePhantomCallback(request), /does not match/);
    assert.equal(dom.window.localStorage.getItem(PREFIX + 'session'), null);
    dom.window.history.replaceState(null, '', callback);
    await assert.rejects(consumePhantomCallback(request), /expired/);
  } finally {
    dom.window.close();
  }
});
test('transaction approval stays separate, requires its original tab and rejects cancellations or wrong networks', async () => {
  const dom = browser();
  try {
    const next = await connect(dom);
    response(dom, next.href, {
      signature: bs58.encode(
        nacl.sign.detached(new TextEncoder().encode(message), signing.secretKey),
      ),
    });
    await consumePhantomCallback(request);
    const adapter = getWallets()
      .get()
      .find((w) => w.name === 'Phantom')!;
    const account = adapter.accounts[0];
    const signer = adapter.features['solana:signTransaction'] as any;
    await assert.rejects(
      signer.signTransaction({ account, chain: 'solana:devnet', transaction: new Uint8Array(100) }),
      /mainnet/,
    );
    const signed = signer.signTransaction({
      account,
      chain: 'solana:mainnet',
      transaction: new Uint8Array(100).fill(3),
    });
    const approval = getPhantomApproval()!;
    assert.ok(approval.href.startsWith('https://phantom.com/ul/v1/signTransaction?'));
    const tx = new Uint8Array(100).fill(7);
    response(dom, approval.href, { transaction: bs58.encode(tx) });
    const callback = await consumePhantomCallback(request);
    assert.equal(callback.kind, 'delivered');
    assert.ok(
      getPhantomApproval(),
      'callback alone must not complete or submit the original transaction',
    );
    dom.window.dispatchEvent(new dom.window.Event('focus'));
    assert.deepEqual((await signed)[0].signedTransaction, tx);
    assert.equal(getPhantomApproval(), null);
    const cancelled = signer.signTransaction({ account, chain: 'solana:mainnet', transaction: tx });
    const cancelRequest = new URL(
      new URL(getPhantomApproval()!.href).searchParams.get('redirect_link')!,
    );
    getPhantomApproval()!.cancel();
    await assert.rejects(cancelled, /cancelled/);
    dom.window.history.replaceState(null, '', cancelRequest);
    await assert.rejects(consumePhantomCallback(request), /expired/);
    clearPhantomSession();
  } finally {
    getPhantomApproval()?.cancel();
    dom.window.close();
  }
});
