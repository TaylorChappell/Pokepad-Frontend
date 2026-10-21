import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { EscrowTokenReceipt } from '../src/components/OnlineBattle';
import type { BattleRoom } from '../src/services/battles';

const hostAccount = 'HostTokenPayoutAccount11111111111111111111111';
const guestAccount = 'GuestTokenPayoutAccount1111111111111111111111';
const room: Pick<BattleRoom, 'escrow' | 'yourSeat'> = {
  yourSeat: 0,
  escrow: {
    asset: 'token',
    mint: 'token-mint',
    amount: '1000000',
    address: 'escrow-address',
    chain: 'solana:devnet',
    deposits: { host: true, guest: true },
    status: 'settled',
    recipientTokenAccounts: { host: hostAccount, guest: guestAccount },
  },
};

test('token receipts show only the authenticated seat’s verified destination and never invent one', () => {
  const host = renderToStaticMarkup(React.createElement(EscrowTokenReceipt, { room }));
  assert.match(host, /Your token payout account/);
  assert.match(host, new RegExp(hostAccount));
  assert.doesNotMatch(host, new RegExp(guestAccount));
  assert.match(host, /cluster=devnet/);
  const guest = renderToStaticMarkup(
    React.createElement(EscrowTokenReceipt, { room: { ...room, yourSeat: 1 } }),
  );
  assert.match(guest, new RegExp(guestAccount));
  assert.doesNotMatch(guest, new RegExp(hostAccount));
  for (const escrow of [
    undefined,
    { ...room.escrow!, recipientTokenAccounts: undefined },
    { ...room.escrow!, recipientTokenAccounts: { guest: guestAccount } },
    { ...room.escrow!, asset: 'sol' as const },
  ]) {
    assert.equal(
      renderToStaticMarkup(
        React.createElement(EscrowTokenReceipt, { room: { yourSeat: 0, escrow } }),
      ),
      '',
    );
  }
});

test('token payout copy uses the complete account and reports a denied clipboard honestly', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test' });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let copied = '';
  let denied = false;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        writeText: async (value: string) => {
          if (denied) throw new Error('Permission denied');
          copied = value;
        },
      },
    },
  });
  const root = createRoot(document.getElementById('root')!);
  try {
    await act(async () => root.render(React.createElement(EscrowTokenReceipt, { room })));
    const button = document.querySelector(
      '[aria-label="Copy your token payout account"]',
    ) as HTMLButtonElement;
    await act(async () => button.click());
    assert.equal(copied, hostAccount);
    assert.match(document.querySelector('[role="status"]')!.textContent!, /copied/);
    denied = true;
    await act(async () => button.click());
    assert.match(document.querySelector('[role="status"]')!.textContent!, /Copy unavailable/);
    assert.equal(
      document.querySelector('.battle-token-receipt-address > a')!.textContent,
      hostAccount,
    );
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
});
