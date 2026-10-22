import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { createInitialState } from '../src/data/demo';
import { AppContext } from '../src/state/AppContext';
import { CoinCard } from '../src/pages/Discover';
import { MarketCapChart } from '../src/components/MarketCapChart';

test('live cards and chart headings show dollar market caps and never relabel SOL as dollars', () => {
  const state = createInitialState();
  for (const quoted of [true, false]) {
    const coin = {
      ...state.coins[0],
      marketCap: 40,
      marketCapUsd: quoted ? 4144 : undefined,
      solUsd: quoted ? 103.6 : undefined,
      marketCapHistory: [30, 40],
    };
    const html = renderToStaticMarkup(
      React.createElement(AppContext.Provider, {
        value: { state, mode: 'live', toast: () => {} } as any,
        children: React.createElement(
          React.Fragment,
          null,
          React.createElement(CoinCard, { coin, watched: false, onToggleWatch: () => {} }),
          React.createElement(MarketCapChart, { coin, demo: false }),
        ),
      }),
    );
    const dom = new JSDOM(html);
    try {
      const card = dom.window.document.querySelector('.market-cap-figure > strong')!;
      const chart = dom.window.document.querySelector('.kanto-market-price')!;
      assert.equal(card.textContent, quoted ? '$4.14K' : '—');
      assert.equal(chart.textContent, quoted ? '$4.14K' : '—');
      if (quoted) {
        const ticks = [...dom.window.document.querySelectorAll('.kanto-market-value-axis span')];
        assert.ok(ticks.length > 0);
        assert.ok(ticks.every((tick) => tick.textContent?.startsWith('$')));
      } else {
        assert.equal(dom.window.document.querySelector('.kanto-market-chart-line'), null);
        assert.match(
          dom.window.document.querySelector('.kanto-market-chart-empty')!.textContent!,
          /Dollar price temporarily unavailable/,
        );
      }
    } finally {
      dom.window.close();
    }
  }
});
