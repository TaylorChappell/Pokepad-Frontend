import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { AppContext } from '../src/state/AppContext';
import { OnlineBattle, type useOnlineBattle } from '../src/components/OnlineBattle';
import { createInitialState } from '../src/data/demo';

test('token battles open search, select only a supported coin and stay in the battle lobby', async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://kanto.test/#/battles',
    pretendToBeVisual: true,
  });
  for (const key of [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'HTMLInputElement',
    'localStorage',
    'Image',
  ])
    Object.defineProperty(globalThis, key, {
      value: (dom.window as any)[key],
      configurable: true,
      writable: true,
    });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  dom.window.matchMedia = (() => ({ matches: true })) as typeof dom.window.matchMedia;
  const { createRoot } = await import('react-dom/client');
  const state = createInitialState();
  state.profile.reducedMotion = true;
  const token = {
    mint: state.coins[0].ca,
    symbol: state.coins[0].ticker,
    name: state.coins[0].name,
    decimals: 6,
  };
  const online = {
    rooms: [],
    room: null,
    restoring: false,
    pending: false,
    error: '',
    capabilitiesError: '',
    capabilities: { friendly: true, pokemon: true, sol: true, token: true, tokens: [token] },
  } as ReturnType<typeof useOnlineBattle>;
  const context = {
    state,
    mode: 'live' as const,
    session: {
      status: 'authenticated' as const,
      wallet: state.profile.wallet,
      provider: 'Phantom' as const,
      expiresAt: null,
    },
    now: Date.now(),
    busy: false,
    toast: () => {},
    act: async () => null,
    reload: async () => null,
    connectWallet: async () => {},
    disconnectWallet: async () => {},
  };
  const root = createRoot(document.getElementById('root')!);
  try {
    await act(async () =>
      root.render(
        React.createElement(
          AppContext.Provider,
          { value: context },
          React.createElement(OnlineBattle, { online }),
        ),
      ),
    );
    assert.equal(document.querySelector('.online-money-fields select'), null);
    const tokenButton = [
      ...document.querySelectorAll<HTMLButtonElement>('.online-format-options button'),
    ].find((el) => el.textContent?.includes('Coin tokens'))!;
    tokenButton.focus();
    await act(async () => tokenButton.click());
    assert.match(document.querySelector('[role="dialog"]')!.textContent!, /Choose your wager coin/);
    assert.equal(document.querySelectorAll('.trainer-search-result').length, 0);
    assert.equal(
      document.querySelectorAll('[role="option"]').length,
      1,
      'unsupported platform coins never enter the wager picker',
    );
    const input = document.querySelector<HTMLInputElement>('[role="combobox"]')!;
    assert.equal(document.activeElement, input);
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        'not-a-supported-coin',
      );
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    assert.equal(document.querySelectorAll('[role="option"]').length, 0);
    assert.match(document.querySelector('.coin-search-empty')!.textContent!, /No matches found/);
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        token.mint,
      );
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    assert.equal(document.querySelectorAll('[role="option"]').length, 1);
    await act(async () =>
      input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
    );
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.match(
      document.querySelector('.online-token-picker')!.textContent!,
      new RegExp(token.symbol),
    );
    assert.equal(
      window.location.hash,
      '#/battles',
      'selecting sets the wager rather than opening the coin page',
    );
    assert.equal(
      document.querySelector<HTMLInputElement>('[aria-label="Wager amount"]')!.value,
      '',
      'changing coin requires a deliberate stake',
    );
    const picker = document.querySelector<HTMLButtonElement>('.online-token-picker')!;
    picker.focus();
    await act(async () => picker.click());
    await act(async () =>
      document.dispatchEvent(
        new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ),
    );
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(document.activeElement, picker);
    assert.match(
      picker.textContent!,
      new RegExp(token.symbol),
      'cancelling keeps the previous coin',
    );
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
