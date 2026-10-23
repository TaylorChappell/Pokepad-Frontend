import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { RewardProbabilities } from '../src/components/RewardProbabilities';
import { loadRewardOdds, type RewardOdds } from '../src/services/reward-odds';
import type { Reward } from '../src/types';
import type { apiRequest } from '../src/services/http';

const reward: Reward = {
  id: 'one',
  kind: 'egg',
  tier: 'Rare',
  originCoin: 'coin',
  awardedAt: 0,
  readyAt: 100,
  initialDuration: 100,
  walkedKm: 0,
  backing: 0,
  evolutionReserve: 0,
};
const odds: RewardOdds = {
  rewardId: 'one',
  gift: false,
  entries: [
    { speciesId: 1, shiny: false, chance: 0.75, backing: 0.04 },
    { speciesId: 151, shiny: true, chance: 0.25, backing: 12 },
  ],
};
async function mount(load: typeof loadRewardOdds, selected = reward) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://kanto.test' });
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'navigator'])
    Object.defineProperty(globalThis, key, { value: (dom.window as any)[key], configurable: true });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const root = createRoot(dom.window.document.getElementById('root')!);
  const render = async (value = selected, wallet = 'holder') =>
    act(async () =>
      root.render(
        React.createElement(RewardProbabilities, {
          reward: value,
          mode: 'live',
          budget: 0,
          wallet,
          load,
        }),
      ),
    );
  await render();
  return {
    document: dom.window.document,
    render,
    close: async () => {
      await act(async () => root.unmount());
      dom.window.close();
    },
    click: async (label: string) => {
      const button = [...dom.window.document.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === label,
      );
      assert.ok(button, label);
      await act(async () =>
        button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })),
      );
    },
  };
}
test('live reward chances load despite an empty current vault and include variant probabilities and filters', async () => {
  let resolve!: (data: RewardOdds) => void;
  const page = await mount(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  try {
    assert.ok(page.document.querySelector('[aria-label="Loading Pokémon and chances"]'));
    await act(async () => resolve(odds));
    assert.equal(page.document.querySelectorAll('.reward-v3-drop').length, 2);
    assert.match(page.document.body.textContent!, /Bulbasaur.*75\.00%/);
    assert.match(page.document.body.textContent!, /Mew.*25\.00%/);
    assert.equal(page.document.querySelectorAll('.reward-v3-drop.is-shiny').length, 1);
    assert.ok(page.document.querySelector('[aria-label="Search possible Pokémon"]'));
    await page.click('Legendaries');
    assert.equal(page.document.querySelectorAll('.reward-v3-drop').length, 1);
    assert.match(page.document.querySelector('.reward-v3-drop')!.textContent!, /Mew/);
    await page.click('All Pokémon');
    assert.equal(page.document.querySelectorAll('.reward-v3-drop').length, 2);
  } finally {
    await page.close();
  }
});
test('live errors offer retry; gift packs show odds without implying a SOL claim', async () => {
  let requests = 0;
  const page = await mount(
    async () => {
      if (++requests === 1) throw new Error('offline');
      return { ...odds, gift: true, entries: odds.entries.map((e) => ({ ...e, backing: 0 })) };
    },
    { ...reward, kind: 'pack', gift: true },
  );
  try {
    assert.ok(page.document.querySelector('[role="alert"]'));
    assert.equal(page.document.querySelectorAll('.reward-v3-drop').length, 0);
    await page.click('Try again');
    assert.equal(requests, 2);
    assert.equal(page.document.querySelectorAll('.reward-v3-drop').length, 2);
    assert.equal(page.document.querySelectorAll('.sol-value').length, 0);
    assert.equal(page.document.querySelector('[role="alert"]'), null);
  } finally {
    await page.close();
  }
});
test('a late odds response cannot populate another reward or wallet', async () => {
  const requests: { signal?: AbortSignal; resolve: (data: RewardOdds) => void }[] = [];
  const page = await mount(
    (_id, signal) => new Promise((resolve) => requests.push({ signal, resolve })),
  );
  try {
    await page.render({ ...reward, id: 'two' }, 'another-holder');
    assert.equal(requests[0].signal?.aborted, true);
    await act(async () => requests[0].resolve(odds));
    assert.equal(page.document.querySelectorAll('.reward-v3-drop').length, 0);
    assert.ok(page.document.querySelector('[aria-busy="true"]'));
    await act(async () =>
      requests[1].resolve({
        ...odds,
        rewardId: 'two',
        entries: [{ speciesId: 25, shiny: false, backing: 0.04, chance: 1 }],
      }),
    );
    assert.match(page.document.querySelector('.reward-v3-drop')!.textContent!, /Pikachu/);
    await page.click('Legendaries');
    assert.match(page.document.body.textContent!, /doesn’t include legendary/);
    assert.doesNotMatch(page.document.body.textContent!, /needs more funding/);
  } finally {
    await page.close();
  }
});
test('odds transport uses the authenticated v1 endpoint and rejects empty or mismatched distributions', async () => {
  const calls: string[] = [];
  const request = (async (path: string) => {
    calls.push(path);
    return odds;
  }) as typeof apiRequest;
  assert.deepEqual(await loadRewardOdds('one', undefined, request), odds);
  assert.deepEqual(calls, ['/v1/rewards/one/odds']);
  for (const bad of [
    null,
    { ...odds, rewardId: 'other' },
    { ...odds, entries: [] },
    { ...odds, entries: [{ ...odds.entries[0], chance: 0.5 }] },
  ])
    await assert.rejects(
      loadRewardOdds('one', undefined, (async () => bad) as typeof apiRequest),
      /could not be loaded/,
    );
});
