import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createInitialState } from '../src/data/demo';
import { STORAGE_KEY } from '../src/state/model';

async function mountCoin() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://example.test/#/coin/char',
    pretendToBeVisual: true,
  });
  for (const key of [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'HTMLInputElement',
    'MutationObserver',
    'localStorage',
    'Event',
    'MouseEvent',
    'KeyboardEvent',
  ]) {
    Object.defineProperty(globalThis, key, {
      value: (dom.window as unknown as Record<string, unknown>)[key],
      configurable: true,
      writable: true,
    });
  }
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  });
  dom.window.scrollTo = () => {};
  const initial = createInitialState();
  dom.window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  const [{ createRoot }, { AppProvider }, { CoinPage }] = await Promise.all([
    import('react-dom/client'),
    import('../src/state/AppContext'),
    import('../src/pages/Discover'),
  ]);
  const root = createRoot(dom.window.document.getElementById('root')!);
  await act(async () =>
    root.render(
      React.createElement(AppProvider, { children: React.createElement(CoinPage, { id: 'char' }) }),
    ),
  );
  return {
    document: dom.window.document,
    click: async (element: Element | null) => {
      assert.ok(element);
      await act(async () =>
        element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })),
      );
    },
    key: async (element: Element, key: string) => {
      await act(async () =>
        element.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true })),
      );
    },
    close: async () => {
      await act(async () => root.unmount());
      dom.window.close();
    },
  };
}

test('coin detail leads with market cap, links the creator, and removes the mascot', async () => {
  const app = await mountCoin();
  try {
    assert.equal(app.document.querySelector('.kanto-market-label')?.textContent, 'Market cap');
    assert.ok(app.document.querySelector('.kanto-market-chart-line'));
    assert.match(
      app.document.querySelector('.kanto-market-creator a')?.getAttribute('href') || '',
      /^#\/trainer\/.+/,
    );
    assert.equal(app.document.querySelector('.kanto-market-creator a')?.textContent, 'Blue');
    assert.equal(
      app.document.querySelector('.coin-launch-credit, .pokemon-art, .sprite-pixels'),
      null,
    );
    assert.doesNotMatch(app.document.body.textContent || '', /Launched with|Next assessment/);
  } finally {
    await app.close();
  }
});

test('chart ranges and history exploration are keyboard accessible', async () => {
  const app = await mountCoin();
  try {
    const range = [...app.document.querySelectorAll('.kanto-market-range button')].find(
      (button) => button.textContent === 'Recent',
    )!;
    await app.click(range);
    const slider = app.document.querySelector('[role="slider"]')!;
    assert.equal(slider.getAttribute('aria-valuemax'), '24');
    assert.equal(range.getAttribute('aria-pressed'), 'true');
    await app.key(slider, 'Home');
    assert.equal(slider.getAttribute('aria-valuenow'), '1');
    await app.key(slider, 'ArrowRight');
    assert.equal(slider.getAttribute('aria-valuenow'), '2');
    assert.ok(app.document.querySelector('.kanto-market-crosshair'));
    assert.match(slider.getAttribute('aria-valuetext') || '', /Sample 2 of 24/);
  } finally {
    await app.close();
  }
});

test('tab selection uses the coin image for its gym badge and trading stays review-only', async () => {
  const app = await mountCoin();
  try {
    const firstTab = app.document.querySelector('[role="tab"]')!;
    await app.key(firstTab, 'End');
    assert.match(app.document.querySelector('[role="tabpanel"]')?.textContent || '', /Team CHAR/);
    assert.ok(app.document.querySelector('.kanto-market-gym-badge .coin-avatar'));
    await app.click(app.document.querySelector('.kanto-market-trade-action'));
    assert.match(app.document.body.textContent || '', /No order or payment will be submitted/);
    assert.equal(app.document.querySelector('button[type="submit"]'), null);
  } finally {
    await app.close();
  }
});
