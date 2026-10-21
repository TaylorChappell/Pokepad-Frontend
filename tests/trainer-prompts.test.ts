import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { AppContext } from '../src/state/AppContext';
import { TrainerPrompts } from '../src/components/TrainerPrompts';
import { PokemonProgressDialog } from '../src/components/PokemonProgressDialog';
import { createInitialState } from '../src/data/demo';
import { applyAction } from '../src/state/model';
import {
  readyTrainerPrompts,
  promptStorageKey,
  readDeferredPrompts,
} from '../src/state/trainer-prompts';
import type { Action, AppSnapshot } from '../src/types';
import type { WalletSession } from '../src/services/wallet';

type Context = NonNullable<React.ContextType<typeof AppContext>>;
async function harness() {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://example.test/#/discover',
    pretendToBeVisual: true,
  });
  for (const key of [
    'window',
    'document',
    'HTMLElement',
    'MutationObserver',
    'localStorage',
    'Event',
    'Image',
  ])
    Object.defineProperty(globalThis, key, {
      value: (dom.window as unknown as Record<string, unknown>)[key],
      configurable: true,
      writable: true,
    });
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  });
  localStorage.setItem('kanto-audio-muted', 'true');
  let state = createInitialState();
  state.profile.reducedMotion = true;
  state.profile.starterChosen = true;
  state.pokemon = [];
  state.starterEligibility = { canChoose: false, canChoosePikachu: false };
  let session: WalletSession = {
    status: 'authenticated',
    wallet: state.profile.wallet,
    provider: 'Phantom',
    expiresAt: null,
  };
  let mode: Context['mode'] = 'live';
  let busy = false;
  let fail = false;
  const actions: Action[] = [];
  const root = createRoot(document.getElementById('root')!);
  let manual: React.ReactNode = null;
  const dispatch = async (action: Action) => {
    actions.push(action);
    if (fail) return null;
    state = applyAction(state, action);
    if (state.profile.starterChosen)
      state.starterEligibility = { canChoose: false, canChoosePikachu: false };
    render();
    return state;
  };
  function render() {
    const value: Context = {
      state,
      session,
      mode,
      busy,
      now: Date.now(),
      act: dispatch,
      toast: () => {},
      connectWallet: async () => {},
      disconnectWallet: async () => {},
      reload: async () => state,
    };
    root.render(
      React.createElement(
        AppContext.Provider,
        { value },
        React.createElement(TrainerPrompts),
        manual,
      ),
    );
  }
  const button = (label: string) => {
    const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === label,
    );
    assert.ok(found, 'Button: ' + label);
    return found;
  };
  await act(async () => render());
  return {
    dom,
    actions,
    button,
    state: () => state,
    async update(change: (snapshot: AppSnapshot) => void) {
      await act(async () => {
        state = structuredClone(state);
        change(state);
        render();
      });
    },
    async auth(next: Partial<WalletSession>) {
      await act(async () => {
        session = { ...session, ...next };
        render();
      });
    },
    async mode(next: Context['mode']) {
      await act(async () => {
        mode = next;
        render();
      });
    },
    async click(target: Element) {
      await act(async () =>
        target.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })),
      );
    },
    async fail(next: boolean) {
      fail = next;
    },
    async manualMove(id: string) {
      await act(async () => {
        manual = React.createElement(PokemonProgressDialog, {
          id,
          kind: 'learn',
          onClose: () => {
            manual = null;
            render();
          },
        });
        render();
      });
    },
    async remount() {
      await act(async () => root.render(null));
      await act(async () => render());
    },
    async until(check: () => boolean) {
      const deadline = Date.now() + 2500;
      while (!check() && Date.now() < deadline)
        await act(async () => {
          await new Promise((r) => setTimeout(r, 20));
        });
      assert.ok(check());
    },
    async close() {
      await act(async () => root.unmount());
      dom.window.close();
    },
  };
}
function learner() {
  return {
    ...createInitialState().pokemon[0],
    id: 'learner',
    speciesId: 4,
    level: 30,
    rareCandy: 0,
    moves: ['Scratch', 'Growl', 'Ember', 'Quick Attack'],
    moveOffers: [{ id: 'offer-1', move: 'Flamethrower', level: 20, status: 'pending' as const }],
  };
}

test('eligible authenticated wallet must choose a starter; failed choices stay open and completed choices never reopen', async () => {
  const h = await harness();
  try {
    await h.update((s) => {
      s.profile.starterChosen = false;
      s.starterEligibility = { canChoose: true, canChoosePikachu: false };
    });
    assert.match(
      document.querySelector('[role="dialog"]')!.textContent!,
      /Choose your first Pokémon/,
    );
    assert.equal(document.querySelector('[aria-label="Close dialog"]'), null);
    assert.equal(h.button('I choose Charmander!').disabled, false);
    assert.ok(document.querySelector<HTMLButtonElement>('.starter-card.locked')?.disabled);
    await act(async () => {
      document.dispatchEvent(
        new h.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      document
        .querySelector('.modal-backdrop')!
        .dispatchEvent(new h.dom.window.MouseEvent('mousedown', { bubbles: true }));
    });
    assert.ok(document.querySelector('[role="dialog"]'));
    await h.fail(true);
    await h.click(h.button('I choose Charmander!'));
    assert.equal(h.state().profile.starterChosen, false);
    assert.ok(document.querySelector('[role="dialog"]'));
    await h.update((s) => {
      s.starterEligibility = {
        canChoose: false,
        canChoosePikachu: false,
        reason: 'Holdings are syncing.',
      };
    });
    assert.ok(document.querySelector('[role="dialog"]'));
    assert.ok(h.button('I choose Charmander!').disabled);
    await h.update((s) => {
      s.starterEligibility = { canChoose: true, canChoosePikachu: false };
    });
    await h.fail(false);
    await h.click(h.button('I choose Charmander!'));
    assert.ok(h.state().profile.starterChosen);
    assert.equal(document.querySelector('[role="dialog"]'), null);
    await h.remount();
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(h.state().pokemon.filter((p) => p.starter).length, 1);
  } finally {
    await h.close();
  }
});

test('starter prompt waits for verified eligibility and never opens for demo, anonymous or mismatched wallets', async () => {
  const h = await harness();
  try {
    await h.update((s) => {
      s.profile.starterChosen = false;
    });
    assert.equal(document.querySelector('[role="dialog"]'), null);
    await h.mode('demo');
    await h.update((s) => {
      s.starterEligibility = { canChoose: true, canChoosePikachu: true };
    });
    assert.equal(document.querySelector('[role="dialog"]'), null);
    await h.mode('live');
    await h.auth({ status: 'anonymous', wallet: null });
    assert.equal(document.querySelector('[role="dialog"]'), null);
    await h.auth({ status: 'authenticated', wallet: 'different-wallet' });
    assert.equal(document.querySelector('[role="dialog"]'), null);
    await h.auth({ wallet: h.state().profile.wallet });
    assert.ok(document.querySelector('[role="dialog"]'));
    assert.equal(document.querySelectorAll('.starter-card.locked').length, 0);
  } finally {
    await h.close();
  }
});

test('move popups support Later without declining, survive refresh, and learn a later new offer from the dialog', async () => {
  const h = await harness();
  try {
    await h.update((s) => {
      s.pokemon = [learner()];
    });
    assert.match(
      document.querySelector('[role="dialog"]')!.textContent!,
      /wants to learn Flamethrower/,
    );
    await h.click(h.button('Later'));
    assert.equal(h.state().pokemon[0].moveOffers[0].status, 'pending');
    assert.equal(h.actions.length, 0);
    await h.remount();
    assert.equal(document.querySelector('[role="dialog"]'), null);
    await h.update((s) => {
      s.pokemon[0].moveOffers.push({ id: 'offer-2', move: 'Slash', level: 30, status: 'pending' });
    });
    assert.match(document.querySelector('[role="dialog"]')!.textContent!, /wants to learn Slash/);
    assert.equal(document.querySelector('.move-forget-options'), null);
    await h.click(h.button('Learn Slash'));
    assert.ok(h.button('Learn Slash').disabled);
    await h.click(document.querySelector('.move-forget-options button')!);
    await h.click(h.button('Learn Slash'));
    assert.equal(h.state().pokemon[0].moves[0], 'Slash');
    assert.equal(h.state().pokemon[0].moveOffers[0].status, 'pending');
    assert.equal(document.querySelector('[role="dialog"]'), null);
    await h.update((s) => {
      s.profile.wallet = 'another-owner';
    });
    await h.auth({ wallet: 'another-owner' });
    assert.match(document.querySelector('[role="dialog"]')!.textContent!, /Flamethrower/);
    await h.click(h.button('Do not learn'));
    assert.match(document.querySelector('[role="dialog"]')!.textContent!, /declined permanently/);
    await h.click(h.button('Do not learn'));
    assert.equal(h.state().pokemon[0].moveOffers[0].status, 'declined');
  } finally {
    await h.close();
  }
});

test('evolution waits until funded, defers without spending candy, and runs the shared reveal when accepted', async () => {
  const h = await harness();
  try {
    const pokemon = { ...learner(), moveOffers: [], rareCandy: 1000, evolutionReserve: 0 };
    await h.update((s) => {
      s.pokemon = [pokemon];
      s.coins.find((c) => c.id === pokemon.originCoin)!.vault = 0;
    });
    assert.equal(document.querySelector('[role="dialog"]'), null);
    await h.update((s) => {
      s.pokemon[0].evolutionReserve = 0.1;
    });
    assert.match(document.querySelector('[role="dialog"]')!.textContent!, /Evolve Charmander/);
    await h.click(h.button('Later'));
    assert.equal(h.state().pokemon[0].rareCandy, 1000);
    await h.remount();
    assert.equal(document.querySelector('[role="dialog"]'), null);
    // A later evolution stage is a different opportunity, even for the same instance.
    await h.update((s) => {
      s.pokemon[0].speciesId = 5;
    });
    assert.match(document.querySelector('[role="dialog"]')!.textContent!, /Evolve Charmeleon/);
    await h.click(h.button('Evolve'));
    await h.until(() => Boolean(document.querySelector('.evolution-sequence.complete')));
    assert.equal(h.state().pokemon[0].speciesId, 6);
    assert.equal(h.state().pokemon[0].rareCandy, 0);
    await h.click(h.button('Continue'));
    assert.equal(document.querySelector('[role="dialog"]'), null);
  } finally {
    await h.close();
  }
});

test('automatic prompts wait behind other dialogs and battles; manual Later acknowledges the same opportunity', async () => {
  const h = await harness();
  try {
    const blocker = document.createElement('div');
    blocker.setAttribute('role', 'dialog');
    await act(async () => document.body.appendChild(blocker));
    await h.update((s) => {
      s.pokemon = [learner()];
    });
    assert.equal(document.querySelector('.move-decision-dialog'), null);
    await h.manualMove('learner');
    await h.click(h.button('Later'));
    await act(async () => blocker.remove());
    assert.equal(document.querySelector('.move-decision-dialog'), null);
    const battle = document.createElement('div');
    battle.className = 'classic-match';
    await act(async () => document.body.appendChild(battle));
    await h.update((s) => {
      s.pokemon[0].moveOffers.push({ id: 'new', move: 'Slash', level: 30, status: 'pending' });
    });
    assert.equal(document.querySelector('.move-decision-dialog'), null);
    await act(async () => battle.remove());
    assert.match(document.querySelector('[role="dialog"]')!.textContent!, /Slash/);
    await h.update((s) => {
      s.pokemon = [];
    });
    assert.equal(document.querySelector('[role="dialog"]'), null);
  } finally {
    await h.close();
  }
});

test('locked, future, declined, already-known and unfunded opportunities are never prompted', () => {
  const s = createInitialState();
  s.pokemon = [learner()];
  s.pokemon[0].locked = true;
  assert.equal(readyTrainerPrompts(s).length, 0);
  s.pokemon[0].locked = false;
  s.pokemon[0].moveOffers[0].level = 99;
  assert.equal(readyTrainerPrompts(s).length, 0);
  s.pokemon[0].moveOffers[0].level = 20;
  s.pokemon[0].moveOffers[0].status = 'declined';
  assert.equal(readyTrainerPrompts(s).length, 0);
  s.pokemon[0].moveOffers[0].status = 'pending';
  s.pokemon[0].moves.push('Flamethrower');
  assert.equal(readyTrainerPrompts(s).length, 0);
  assert.notEqual(promptStorageKey('api-a', 'wallet'), promptStorageKey('api-b', 'wallet'));
  assert.equal(readDeferredPrompts({ getItem: () => '{broken' }, 'key').size, 0);
});
