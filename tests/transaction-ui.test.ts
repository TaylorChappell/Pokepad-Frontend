import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { TransactionStatus } from '../src/components/TransactionStatus';
import { API_BASE } from '../src/services/http';
import {
  TransactionController,
  useTransactionFlow,
  type PendingTransaction,
  type TransactionConfirmation,
} from '../src/services/transactions';

const pending: PendingTransaction = {
  wallet: 'trainer-one',
  kind: 'launch',
  requestId: 'request-1',
  intentId: 'intent-1',
  preparePath: '/v1/coins/prepare',
  confirmPath: '/v1/coins/confirm',
  body: {},
  signingStarted: true,
  signature: 'signature-1',
  chain: 'solana:devnet',
};

test('transaction feedback has no resume controls, saved-request panel or signature field', () => {
  for (const record of [null, pending, { ...pending, signature: undefined }]) {
    const html = renderToStaticMarkup(
      React.createElement(TransactionStatus, {
        pending: record,
        status: record ? 'Waiting for confirmation…' : '',
        error: 'Please try again.',
      }),
    );
    assert.match(html, /role="alert"/);
    assert.doesNotMatch(html, /<button|<input|Continue|Saved transaction|Check confirmation/i);
    if (record?.signature) assert.match(html, /solscan.io\/tx\/signature-1\?cluster=devnet/);
  }
});

test('pending transactions check automatically, deliver completion once, and stop on unmount', async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test/' });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  localStorage.setItem(`kanto.pending:${API_BASE}:trainer-one:launch`, JSON.stringify(pending));
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let checks = 0;
  const completed: TransactionConfirmation[] = [];
  t.mock.method(
    TransactionController.prototype,
    'confirm',
    async function (this: TransactionController) {
      checks++;
      this.state = { ...this.state, pending: null };
      return { status: 'confirmed', signature: pending.signature, coinId: 'coin-1' };
    },
  );
  function Probe() {
    const transaction = useTransactionFlow('trainer-one', 'launch', (result) => {
      completed.push(result);
    });
    return React.createElement(TransactionStatus, transaction);
  }
  const root = createRoot(document.getElementById('root')!);
  try {
    await act(async () =>
      root.render(React.createElement(React.StrictMode, null, React.createElement(Probe))),
    );
    assert.equal(checks, 0);
    await act(async () => t.mock.timers.tick(4000));
    assert.equal(checks, 1);
    assert.equal(completed.length, 1);
    assert.equal(completed[0].coinId, 'coin-1');
    await act(async () => t.mock.timers.tick(8000));
    assert.equal(checks, 1);
  } finally {
    await act(async () => root.unmount());
    t.mock.timers.tick(8000);
    assert.equal(checks, 1);
    t.mock.timers.reset();
    dom.window.close();
  }
});

test('a delayed confirmation cannot notify a different wallet after an account switch', async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test/' });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  localStorage.setItem(`kanto.pending:${API_BASE}:trainer-one:launch`, JSON.stringify(pending));
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let resolve!: (value: TransactionConfirmation) => void;
  const notified: string[] = [];
  t.mock.method(
    TransactionController.prototype,
    'confirm',
    () =>
      new Promise<TransactionConfirmation>((done) => {
        resolve = done;
      }),
  );
  function Probe({ wallet }: { wallet: string }) {
    useTransactionFlow(wallet, 'launch', () => {
      notified.push(wallet);
    });
    return null;
  }
  const root = createRoot(document.getElementById('root')!);
  try {
    await act(async () => root.render(React.createElement(Probe, { wallet: 'trainer-one' })));
    await act(async () => t.mock.timers.tick(4000));
    await act(async () => root.render(React.createElement(Probe, { wallet: 'trainer-two' })));
    await act(async () => resolve({ status: 'confirmed', signature: pending.signature }));
    assert.deepEqual(notified, []);
  } finally {
    await act(async () => root.unmount());
    t.mock.timers.reset();
    dom.window.close();
  }
});
