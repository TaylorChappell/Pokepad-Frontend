import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useCoinWatchlist } from '../src/state/watchlist';

test('watchlists persist per trainer wallet and do not leak between accounts', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test/' });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const root = createRoot(dom.window.document.getElementById('root')!);
  function Probe({ wallet }: { wallet: string }) {
    const list = useCoinWatchlist(wallet);
    return React.createElement(
      'button',
      { onClick: () => list.toggle('char') },
      list.ids.join(','),
    );
  }
  const render = (wallet: string) =>
    act(async () => root.render(React.createElement(Probe, { wallet })));
  const toggle = () => act(async () => dom.window.document.querySelector('button')!.click());
  try {
    await render('trainer-one');
    await toggle();
    assert.equal(dom.window.document.querySelector('button')?.textContent, 'char');
    await render('trainer-two');
    assert.equal(dom.window.document.querySelector('button')?.textContent, '');
    await render('trainer-one');
    assert.equal(dom.window.document.querySelector('button')?.textContent, 'char');
    await toggle();
    assert.equal(dom.window.localStorage.getItem('pokepad-watchlist-v1:trainer-one'), '[]');
    assert.equal(dom.window.localStorage.getItem('pokepad-watchlist-v1:trainer-two'), null);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
