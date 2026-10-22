import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { parseCoinMarket } from '../src/services/coin-market';
import { CoinMarketActivity } from '../src/components/CoinMarketActivity';
const payload = (mint = 'mint') => ({
  mint,
  updatedAt: Date.now(),
  indexedAt: Date.now(),
  syncing: false,
  holderCount: 1,
  holdersCurrent: true,
  trades: [
    {
      id: 'trade',
      signature: 'signature',
      wallet: 'holder-wallet',
      displayName: 'Leaf',
      side: 'buy',
      solAmount: 1.25,
      tokenAmount: 500,
      createdAt: Date.now() - 60000,
    },
  ],
  holders: [
    {
      wallet: 'holder-wallet',
      displayName: 'Leaf',
      tokenAmount: 500,
      sharePercent: 0.25,
      heldSince: Date.now() - 3600000,
    },
  ],
});
async function mount() {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://frontend.example',
    pretendToBeVisual: true,
  });
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Event', 'MouseEvent'])
    Object.defineProperty(globalThis, key, {
      value: (dom.window as any)[key],
      configurable: true,
      writable: true,
    });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const previousFetch = globalThis.fetch;
  const requests: { url: string; init: any; resolve: (response: Response) => void }[] = [];
  globalThis.fetch = ((url: any, init: any) =>
    new Promise<Response>((resolve) =>
      requests.push({ url: String(url), init, resolve }),
    )) as typeof fetch;
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(dom.window.document.getElementById('root')!);
  const render = async (mint = 'mint', kind: 'Transactions' | 'Holders' = 'Transactions') =>
    act(async () =>
      root.render(
        React.createElement(CoinMarketActivity, { mint, kind, base: 'https://api.example' }),
      ),
    );
  const respond = async (index: number, body: unknown, status = 200) =>
    act(async () => requests[index].resolve(Response.json(body, { status })));
  return {
    dom,
    root,
    requests,
    render,
    respond,
    close: async () => {
      await act(async () => root.unmount());
      dom.window.close();
      globalThis.fetch = previousFetch;
    },
  };
}
test('coin feeds reject cross-coin, malformed, negative and nonfinite market records', () => {
  assert.equal(parseCoinMarket(payload(), 'mint').trades[0].solAmount, 1.25);
  for (const broken of [
    { ...payload(), mint: 'other' },
    { ...payload(), holderCount: -1 },
    { ...payload(), trades: [{ ...payload().trades[0], solAmount: Infinity }] },
    { ...payload(), holders: [{ ...payload().holders[0], sharePercent: 101 }] },
  ])
    assert.throws(() => parseCoinMarket(broken, 'mint'), /unavailable/);
});
test('live tables request actual records, expose trainer and transaction links, and refresh without losing rows', async () => {
  const app = await mount();
  try {
    await app.render();
    assert.match(app.dom.window.document.body.textContent || '', /Loading transactions/);
    assert.equal(app.requests[0].url, 'https://api.example/v1/coins/mint/market');
    assert.equal(app.requests[0].init.credentials, 'omit');
    await app.respond(0, payload());
    assert.match(app.dom.window.document.body.textContent || '', /Leaf.*1\.25.*500/);
    assert.ok(app.dom.window.document.querySelector('a[href="#/trainer/holder-wallet"]'));
    assert.ok(app.dom.window.document.querySelector('a[href="https://solscan.io/tx/signature"]'));
    await act(async () => app.dom.window.dispatchEvent(new app.dom.window.Event('focus')));
    await app.respond(1, { error: { message: 'Unavailable' } }, 503);
    assert.match(app.dom.window.document.body.textContent || '', /Updates are delayed/);
    assert.equal(app.dom.window.document.querySelectorAll('tbody tr').length, 1);
    await app.render('mint', 'Holders');
    assert.match(app.dom.window.document.body.textContent || '', /Leaf.*500.*0\.25%/);
  } finally {
    await app.close();
  }
});
test('failed initial reads have a retry and late responses cannot leak records across coin navigation', async () => {
  const app = await mount();
  try {
    await app.render();
    await app.respond(0, { error: { message: 'Unavailable' } }, 503);
    assert.match(app.dom.window.document.body.textContent || '', /Trades couldn’t be loaded/);
    await act(async () => app.dom.window.document.querySelector('button')!.click());
    assert.equal(app.requests.length, 2);
    await app.render('next');
    assert.equal(app.requests[1].init.signal.aborted, true);
    await app.respond(2, {
      ...payload('next'),
      trades: [],
      holders: [],
      holderCount: 0,
      syncing: true,
    });
    await app.respond(1, payload());
    assert.match(app.dom.window.document.body.textContent || '', /Trade history is catching up/);
    assert.doesNotMatch(app.dom.window.document.body.textContent || '', /Leaf/);
  } finally {
    await app.close();
  }
});
