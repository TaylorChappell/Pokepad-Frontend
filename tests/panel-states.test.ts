import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { GymDefenders, GymsPage } from '../src/pages/Community';
import { RewardsPage } from '../src/pages/Rewards';
import { AnalyticsPage } from '../src/pages/Analytics';
import { AppContext } from '../src/state/AppContext';
import { createInitialState } from '../src/data/demo';
import type { GymDefender } from '../src/game/gym-policy';

const defender: GymDefender = {
  id: 'paired',
  speciesId: 25,
  level: 30,
  shiny: false,
  moves: ['Thunder Shock'],
  strength: 300,
  trainerWallet: '',
  trainerName: '',
  source: 'partner',
};
test('incomplete gyms show vacancies without duplicating defenders; empty gyms have no party', () => {
  for (const compact of [true, false])
    for (const count of [0, 1, 2, 3]) {
      const defenders = Array.from({ length: count }, (_, i) => ({ ...defender, id: String(i) }));
      const doc = new JSDOM(
        renderToStaticMarkup(React.createElement(GymDefenders, { defenders, compact })),
      ).window.document;
      assert.equal(doc.querySelectorAll('.gym-defender').length, count);
      assert.equal(doc.querySelectorAll('.gym-defender-vacancy').length, count ? 3 - count : 0);
      assert.equal(
        doc.querySelectorAll('.gym-defender-vacancy button, .gym-defender-vacancy .pokemon-art')
          .length,
        0,
      );
      if (!count) assert.match(doc.body.textContent!, /No defenders yet/);
      assert.equal(defenders.length, count);
    }
});

function page(element: React.ReactNode, state = createInitialState()) {
  const context = { state, mode: 'live', now: Date.now() } as React.ContextType<typeof AppContext>;
  return new JSDOM(
    renderToStaticMarkup(React.createElement(AppContext.Provider, { value: context }, element)),
  ).window.document;
}
test('pack collection and empty state both identify sealed packs', () => {
  const state = createInitialState();
  state.rewards = [];
  const doc = page(React.createElement(RewardsPage, { initialTab: 'packs' }), state);
  assert.ok(doc.querySelector('[role="tab"][aria-selected="true"] .pack-icon'));
  assert.ok(doc.querySelector('.empty-state .pack-icon'));
  assert.match(doc.querySelector('.empty-state')!.textContent!, /No unopened packs/);
});
test('badge collection keeps real coin links, deduplicates display and preserves unknown saved badges', () => {
  const state = createInitialState();
  state.badges = [state.coins[0].id, state.coins[0].id, 'historical-gym'];
  const doc = page(React.createElement(GymsPage), state);
  assert.equal(doc.querySelectorAll('.gym-collection-tray a').length, 1);
  assert.equal(
    doc.querySelector('.gym-collection-tray a')!.getAttribute('href'),
    '#/gym/' + state.coins[0].id,
  );
  assert.equal(doc.querySelectorAll('.gym-saved-badge').length, 1);
  assert.equal(doc.querySelectorAll('.gym-badge-outline').length, 0);
});
test('analytics initial loading reserves three metric values instead of a full card grid', () => {
  const doc = page(React.createElement(AnalyticsPage));
  const panel = doc.querySelector('.analytics-metrics')!;
  assert.equal(panel.getAttribute('aria-busy'), 'true');
  assert.equal(panel.querySelectorAll('.analytics-metric').length, 3);
  assert.equal(panel.querySelectorAll('.analytics-number-skeleton').length, 3);
  assert.equal(panel.querySelectorAll('.skeleton-card').length, 0);
  assert.equal(panel.querySelector('[role="status"]')!.textContent, 'Loading platform totals');
});
