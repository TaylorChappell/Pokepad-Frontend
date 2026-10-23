import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { AppContext } from '../src/state/AppContext';
import { BattleRoomReview } from '../src/components/BattleRoomReview';
import { BattleBagMenu } from '../src/components/BattleBagMenu';
import { EscrowFunding } from '../src/components/OnlineBattle';
import { RoomNextStep, BattlePresenceNotice } from '../src/components/BattleRoomStatus';
import { createInitialState } from '../src/data/demo';
import { createBattle, createPlayerTeam, type BattleAction } from '../src/battle/engine';
import type { BattleRoom } from '../src/services/battles';
import type { useOnlineBattle } from '../src/components/OnlineBattle';
async function harness() {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://example.test/#/battles',
    pretendToBeVisual: true,
  });
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  for (const key of [
    'window',
    'document',
    'HTMLElement',
    'MutationObserver',
    'localStorage',
    'Event',
    'Image',
  ]) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value: (dom.window as unknown as Record<string, unknown>)[key],
      configurable: true,
      writable: true,
    });
  }
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const root = createRoot(document.getElementById('root')!);
  const snapshot = createInitialState();
  const context = {
    state: snapshot,
    mode: 'live',
    session: { status: 'authenticated', wallet: snapshot.profile.wallet, signingReady: true },
    now: Date.now(),
    busy: false,
    toast: () => {},
    act: async () => null,
    reload: async () => snapshot,
    connectWallet: async () => {},
    disconnectWallet: async () => {},
  } as NonNullable<React.ContextType<typeof AppContext>>;
  const render = async (node: React.ReactNode) => {
    await act(async () =>
      root.render(React.createElement(AppContext.Provider, { value: context }, node)),
    );
  };
  const click = async (element: Element) => {
    await act(async () =>
      element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })),
    );
  };
  const button = (text: string) => {
    const element = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === text,
    );
    assert.ok(element, 'Button: ' + text);
    return element;
  };
  return {
    dom,
    snapshot,
    render,
    click,
    button,
    async close() {
      await act(async () => root.unmount());
      dom.window.close();
      for (const [key, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}
test('review shows both full teams and equal supplies, requires explicit acceptance, and clears it when terms change', async () => {
  const h = await harness();
  try {
    const team = createPlayerTeam(h.snapshot.pokemon.slice(0, 3));
    let room = {
      id: 'room',
      status: 'review',
      wager: 'friendly',
      teamSize: 3,
      yourSeat: 0,
      yourPokemonIds: team.map((p) => p.id),
      trainers: [
        { wallet: 'host', displayName: 'Host' },
        { wallet: 'guest', displayName: 'Guest' },
      ],
      review: {
        version: 2,
        rules: { items: 'standard', levels: 'original' },
        teams: [
          { wallet: 'host', seat: 0, accepted: false, pokemon: team },
          {
            wallet: 'guest',
            seat: 1,
            accepted: false,
            pokemon: team.map((p) => ({ ...p, id: 'r-' + p.id })),
          },
        ],
        messages: [],
      },
    } as unknown as BattleRoom;
    const calls: unknown[] = [];
    const online = {
      pending: false,
      connected: true,
      error: '',
      ready: async (version: number, accepted: boolean) => {
        calls.push({ version, accepted });
        return room;
      },
      leave: async () => room,
      propose: async () => room,
      message: async () => room,
    } as unknown as ReturnType<typeof useOnlineBattle>;
    const render = () => h.render(React.createElement(BattleRoomReview, { room, online }));
    await render();
    assert.equal(document.querySelectorAll('.battle-review-teams article').length, 2);
    assert.match(document.body.textContent!, /2 Potions · 1 Revive · 1 Full Heal/);
    assert.equal(h.button('Accept battle').disabled, true);
    await h.click(document.querySelector('input[type=checkbox]')!);
    await h.click(h.button('Accept battle'));
    assert.deepEqual(calls, [{ version: 2, accepted: true }]);
    room = structuredClone(room);
    room.review!.version = 3;
    room.review!.rules.items = 'none';
    await render();
    assert.equal(h.button('Accept battle').disabled, true);
    assert.match(document.body.textContent!, /Items disabled/);
    await h.click(document.querySelector('.battle-review-teams article button')!);
    assert.ok(document.querySelector('.battle-review-detail'));
    assert.match(document.querySelector('.battle-review-detail')!.textContent!, /Attack/);
    assert.ok(
      document.querySelector('.battle-review-detail')!.textContent!.includes(team[0].moves[0]),
    );
    await h.click(h.button('Room chat'));
    assert.ok(document.querySelector('[aria-label="Message to your rival"]'));
    assert.equal(h.button('Send').disabled, true);
  } finally {
    await h.close();
  }
});
test('bag shows remaining supplies and permits only legal healing or revival targets', async () => {
  const h = await harness();
  try {
    const team = h.snapshot.pokemon.slice(0, 3);
    const battle = createBattle(team, createPlayerTeam(team), 'Medium');
    battle.player[1].hp = 0;
    const actions: BattleAction[] = [];
    await h.render(
      React.createElement(BattleBagMenu, {
        state: battle,
        disabled: false,
        onUse: (action) => actions.push(action),
        onBack: () => {},
      }),
    );
    const revive = [
      ...document.querySelectorAll<HTMLButtonElement>('.battle-bag-items button'),
    ].find((button) => button.textContent?.includes('Revive'));
    assert.ok(revive);
    await h.click(revive);
    const targets = [...document.querySelectorAll<HTMLButtonElement>('.battle-bag-targets button')];
    assert.equal(targets[0].disabled, true);
    assert.equal(targets[1].disabled, false);
    await h.click(targets[1]);
    assert.deepEqual(actions, [{ kind: 'item', item: 'revive', index: 1 }]);
    assert.match(
      document.querySelector('.battle-bag-menu')!.textContent!,
      /One item takes your turn/,
    );
  } finally {
    await h.close();
  }
});

test('an empty or disabled bag always has a usable Back button', async () => {
  const h = await harness();
  try {
    const team = h.snapshot.pokemon.slice(0, 3),
      battle = createBattle(team, createPlayerTeam(team), 'Medium');
    battle.bags!.player = { potion: 0, revive: 0, 'full-heal': 0 };
    let left = 0;
    await h.render(
      React.createElement(BattleBagMenu, {
        state: battle,
        disabled: true,
        onUse: () => assert.fail('No item may be used'),
        onBack: () => left++,
      }),
    );
    assert.ok(
      [...document.querySelectorAll<HTMLButtonElement>('.battle-bag-items button')].every(
        (b) => b.disabled,
      ),
    );
    assert.equal(h.button('Back').disabled, false);
    await h.click(h.button('Back'));
    assert.equal(left, 1);
  } finally {
    await h.close();
  }
});

test('waiting rooms explain the next step and never imply an escrow error or ask for payment', async () => {
  const h = await harness();
  try {
    const room = {
      id: 'waiting',
      status: 'waiting',
      visibility: 'public',
      wager: 'sol',
      wagerAmount: '100000000',
      wagerDecimals: 9,
      wagerSymbol: 'SOL',
      yourSeat: 0,
    } as BattleRoom;
    const online = { clockOffset: 0 } as ReturnType<typeof useOnlineBattle>;
    await h.render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(RoomNextStep, { room }),
        React.createElement(EscrowFunding, { room, online }),
      ),
    );
    assert.match(document.body.textContent!, /Waiting for a rival to join/);
    assert.match(document.body.textContent!, /Nothing to pay yet/);
    assert.doesNotMatch(document.body.textContent!, /details are syncing|Refresh this room/);
    assert.equal(document.querySelectorAll('a[href*="solscan"]').length, 0);
    assert.equal(document.querySelectorAll('button').length, 0);
  } finally {
    await h.close();
  }
});

test('funding requires explicit consent, puts wallet payment first, and waits clearly once paid', async () => {
  const h = await harness();
  try {
    let room = {
      id: 'payment',
      status: 'funding',
      wager: 'sol',
      wagerAmount: '100000000',
      wagerDecimals: 9,
      wagerSymbol: 'SOL',
      yourSeat: 0,
      escrow: {
        asset: 'sol',
        mint: null,
        amount: '100000000',
        address: 'battle-account',
        status: 'funding',
        initialized: true,
        deposits: { host: false, guest: false },
        depositDeadlineAt: new Date(Date.now() + 120000).toISOString(),
      },
    } as BattleRoom;
    const online = {
      clockOffset: 0,
      acceptRoom: () => {},
      refreshRoom: async () => {},
    } as unknown as ReturnType<typeof useOnlineBattle>;
    const render = () => h.render(React.createElement(EscrowFunding, { room, online }));
    await render();
    assert.match(document.body.textContent!, /Your turn to pay/);
    assert.equal(h.button('Pay with wallet · 0.1 SOL').disabled, true);
    assert.equal(document.querySelector('details')!.open, false);
    assert.ok(document.querySelector('a[href*="solscan"]')!.closest('details'));
    assert.match(document.body.textContent!, /Do not transfer to the battle account manually/);
    await h.click(document.querySelector('input[type=checkbox]')!);
    assert.equal(h.button('Pay with wallet · 0.1 SOL').disabled, false);
    room = structuredClone(room);
    room.escrow!.deposits.host = true;
    await render();
    assert.match(document.body.textContent!, /You’re paid. Waiting for your rival/);
    assert.equal(
      [...document.querySelectorAll('button')].some((b) =>
        b.textContent?.includes('Pay with wallet'),
      ),
      false,
    );
    room.escrow!.deposits.guest = true;
    await render();
    assert.match(document.body.textContent!, /Both trainers have paid/);
  } finally {
    await h.close();
  }
});

test('payment expiry disables deposit, while verified refunds stay usable', async () => {
  const h = await harness();
  try {
    const room = {
      id: 'expired-payment',
      status: 'funding',
      wager: 'sol',
      wagerAmount: '100000000',
      wagerDecimals: 9,
      wagerSymbol: 'SOL',
      yourSeat: 0,
      escrow: {
        asset: 'sol',
        mint: null,
        amount: '100000000',
        address: 'battle-account',
        status: 'funding',
        initialized: true,
        deposits: { host: false, guest: false },
        depositDeadlineAt: new Date(Date.now() - 5000).toISOString(),
      },
    } as BattleRoom;
    const online = { clockOffset: 0 } as ReturnType<typeof useOnlineBattle>;
    await h.render(React.createElement(EscrowFunding, { room, online }));
    assert.match(document.body.textContent!, /payment window has closed/);
    assert.equal(document.querySelectorAll('button').length, 0);
    room.escrow!.status = 'refund-available';
    room.escrow!.deposits.host = true;
    await h.render(React.createElement(EscrowFunding, { room, online }));
    assert.equal(h.button('Reclaim my stake').disabled, false);
  } finally {
    await h.close();
  }
});

test('rival absence has a visible forfeit countdown and disappears when they return', async () => {
  const h = await harness();
  try {
    const room = {
      id: 'active',
      status: 'active',
      opponentWallet: 'guest',
      trainers: [{ wallet: 'guest', displayName: 'Taylor' }],
      presence: [
        {
          wallet: 'guest',
          status: 'away',
          forfeitAt: new Date(Date.now() + 45000).toISOString(),
          awaySince: new Date().toISOString(),
        },
      ],
    } as BattleRoom;
    await h.render(React.createElement(BattlePresenceNotice, { room }));
    assert.match(document.body.textContent!, /Taylor has left the arena/);
    assert.match(document.body.textContent!, /Forfeit in/);
    assert.match(document.body.textContent!, /Turns keep counting down/);
    room.presence![0].status = 'present';
    room.presence![0].forfeitAt = null;
    await h.render(React.createElement(BattlePresenceNotice, { room }));
    assert.equal(document.querySelector('.battle-away-notice'), null);
  } finally {
    await h.close();
  }
});
