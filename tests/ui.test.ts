import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createInitialState } from '../src/data/demo';
import { STORAGE_KEY } from '../src/state/model';
import { pokemonById } from '../src/data/pokemon';
import { getPokemonHealth } from '../src/data/stats';
import { DEMO_TRAINERS } from '../src/services/trainers';
import type { AppSnapshot } from '../src/types';
import { readFile } from 'node:fs/promises';

const nativeFetch = globalThis.fetch;

async function mountApp(path = '/discover', prepare?: (state: AppSnapshot) => void) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://example.test/pokepad/#' + path,
    pretendToBeVisual: true,
  });
  for (const key of [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'HTMLInputElement',
    'HTMLTextAreaElement',
    'MutationObserver',
    'localStorage',
    'Event',
    'MouseEvent',
    'HashChangeEvent',
    'KeyboardEvent',
    'FileReader',
    'File',
    'Image',
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
  // JSDOM does not decode raster assets. Exercise battle loading and UI transitions
  // with an explicit decoder; atlas content and failed-load retries have their own tests.
  dom.window.HTMLImageElement.prototype.decode = async () => {};
  // Canvas pixels are checked by the native renderer tests and scene renders.
  // This DOM-only harness exercises controls and playback without JSDOM's
  // unimplemented-canvas warnings obscuring actual interaction failures.
  dom.window.HTMLCanvasElement.prototype.getContext = (() => ({
    imageSmoothingEnabled: false,
    globalAlpha: 1,
    fillStyle: '',
    clearRect() {},
    drawImage() {},
    fillRect() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    scale() {},
    putImageData() {},
    getImageData(_x: number, _y: number, width: number, height: number) {
      return { width, height, data: new Uint8ClampedArray(width * height * 4) };
    },
  })) as typeof dom.window.HTMLCanvasElement.prototype.getContext;
  // Battle manifests are same-origin static assets in production. Read those
  // exact files here, so the interaction tests also exercise the real loader.
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const match = url.match(/(?:^|\/)assets\/battle\/pmd\/(\d+\.json)(?:[?#].*)?$/);
    if (match) {
      const json = await readFile(
        new URL('../public/assets/battle/pmd/' + match[1], import.meta.url),
        'utf8',
      );
      return new Response(json, { headers: { 'Content-Type': 'application/json' } });
    }
    return nativeFetch(input, init);
  };
  const initial = createInitialState();
  initial.profile.reducedMotion = true;
  prepare?.(initial);
  dom.window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  const { createRoot } = await import('react-dom/client');
  const { default: App } = await import('../src/App');
  const root = createRoot(dom.window.document.getElementById('root')!);
  const document = dom.window.document;
  await act(async () => root.render(React.createElement(App)));
  return {
    dom,
    document,
    initial,
    saved: () => JSON.parse(dom.window.localStorage.getItem(STORAGE_KEY)!) as AppSnapshot,
    text: () => document.body.textContent || '',
    button: (label: string, container: ParentNode = document) => {
      const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
        (element) => element.textContent?.trim() === label,
      );
      assert.ok(button, 'Button exists: ' + label);
      return button;
    },
    click: async (element: Element | null) => {
      assert.ok(element, 'Clickable element exists');
      await act(async () => {
        element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      });
    },
    fill: async (selector: string, value: string) => {
      const input = document.querySelector<HTMLInputElement>(selector);
      assert.ok(input, 'Input exists: ' + selector);
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(
          input,
          value,
        );
        input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
    },
    go: async (nextPath: string) => {
      await act(async () => {
        dom.window.history.replaceState(null, '', '/pokepad/#' + nextPath);
        dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
      });
    },
    wait: async (ms: number) => {
      await act(async () => new Promise((resolve) => setTimeout(resolve, ms)));
    },
    until: async (predicate: () => boolean, message: string, timeout = 2000) => {
      const deadline = Date.now() + timeout;
      while (!predicate() && Date.now() < deadline) {
        await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
      }
      assert.ok(predicate(), message);
    },
    close: async () => {
      await act(async () => root.unmount());
      dom.window.close();
    },
  };
}

test('navigation, search, notifications, pixel artwork, and trainer settings work together', async () => {
  const app = await mountApp();
  const { document, click, go, fill } = app;
  try {
    assert.match(app.text(), /Launch a coin\.Build your Pokémon team\./);
    assert.equal(document.querySelectorAll('.coin-card').length, 8);
    assert.equal(document.querySelector('.gym-spotlight-ribbon'), null);
    assert.equal(app.saved().profile.artStyle, 'pixel');
    assert.equal(document.querySelector('.equipped-mini'), null);
    assert.match(
      document.querySelector('.brand-lockup img')?.getAttribute('src') ||
        document.querySelector('img.brand-lockup')?.getAttribute('src') ||
        '',
      /brand\/kanto-lockup\.png$/,
    );
    assert.deepEqual(
      [...document.querySelectorAll('.sidebar .nav-link')]
        .slice(0, 5)
        .map((link) => link.getAttribute('href')),
      ['#/discover', '#/create', '#/portfolio', '#/rewards', '#/analytics'],
    );
    assert.equal(document.querySelector('.sidebar a[href="#/settings"]'), null);
    assert.doesNotMatch(document.querySelector('.sidebar')?.textContent || '', /Frontend preview/);
    assert.ok(document.querySelector('.trainer-avatar.pixel-avatar'));
    await click(document.querySelector('.search-trigger'));
    await fill('.coin-search-field input', 'GENG');
    assert.equal(document.querySelectorAll('.search-dialog-result').length, 1);
    await click(document.querySelector('[aria-label="Close search"]'));
    await app.until(() => !document.querySelector('.coin-search-dialog'), 'Search closes');
    await click(document.querySelector('.notification-button'));
    assert.ok(document.querySelector('.notification-dropdown'));
    await click(document.querySelector('.dropdown-heading button'));
    assert.equal(document.querySelector('.unread-dot'), null);
    await click(document.querySelector('.account-button'));
    assert.equal(document.querySelector('a[href="#/creator"]'), null);
    assert.doesNotMatch(
      document.querySelector('.account-dropdown')?.textContent || '',
      /Creator console/,
    );

    for (const path of [
      '/explore',
      '/analytics',
      '/trainer/' + DEMO_TRAINERS[0].wallet,
      '/coin/char',
      '/create',
      '/portfolio',
      '/rewards',
      '/walk',
      '/pokemon',
      '/pokemon/partner',
      '/pokedex',
      '/gyms',
      '/gym/char',
      '/profile',
      '/settings',
      '/activity',
      '/starter',
      '/battles',
      '/guide',
    ]) {
      await go(path);
      assert.ok(document.querySelector('main'), 'Main content exists at ' + path);
      assert.doesNotMatch(app.text(), /Unable to load this page/, 'No rendering error at ' + path);
      assert.ok(
        (document.querySelector('main')?.textContent?.length || 0) > 80,
        'Page content exists at ' + path,
      );
    }
    await go('/profile');
    assert.doesNotMatch(document.querySelector('main')?.textContent || '', /Recent adventures/);
    await go('/settings');
    await fill('#display-name', 'Kanto Taylor');
    await click(document.querySelector('.character-options>button:nth-child(3)'));
    await click(document.querySelector('.art-style-options>button:nth-child(2)'));
    await app.until(
      () =>
        app.saved().profile.displayName === 'Kanto Taylor' &&
        app.saved().profile.artStyle === 'drawn' &&
        app.saved().profile.character === 'misty',
      'Appearance and name are saved without a submit button',
    );
    assert.equal(app.saved().profile.displayName, 'Kanto Taylor');
    assert.equal(app.saved().profile.character, 'misty');
    assert.equal(app.saved().profile.artStyle, 'drawn');
    assert.match(document.querySelector('.account-name')?.textContent || '', /Kanto Taylor/);
    assert.equal(document.querySelector('.equipped-mini .sprite-pixels-moving'), null);
    // The little interactive sidebar companion stays a game sprite in either art setting.
    assert.ok(document.querySelector('.buddy-pet .sprite-art'));
    await click(document.querySelector('.art-style-options>button:first-child'));
    await app.until(() => app.saved().profile.artStyle === 'pixel', 'Art preference auto-saves');
    assert.equal(app.saved().profile.artStyle, 'pixel');
    assert.equal(document.querySelector('.equipped-mini .sprite-pixels-moving'), null);
  } finally {
    await app.close();
  }
});

test('coin search supports keyboard access, exact addresses, empty results and focus restoration', async () => {
  const app = await mountApp();
  const { document, fill, click } = app;
  const key = async (target: EventTarget, value: string, modifiers = {}) => {
    await act(async () => {
      target.dispatchEvent(
        new app.dom.window.KeyboardEvent('keydown', {
          key: value,
          bubbles: true,
          cancelable: true,
          ...modifiers,
        }),
      );
    });
  };
  try {
    const trigger = document.querySelector<HTMLButtonElement>('.search-trigger')!;
    trigger.focus();
    await key(document, 'k', { ctrlKey: true });
    const input = document.querySelector<HTMLInputElement>('.coin-search-field input')!;
    assert.equal(document.activeElement, input);
    assert.equal(document.getElementById('root')?.hasAttribute('inert'), true);
    assert.equal(document.body.style.overflow, 'hidden');

    const coin = app.initial.coins.find((entry) => entry.id === 'char')!;
    await fill('.coin-search-field input', coin.ca);
    assert.equal(document.querySelectorAll('.coin-search-result').length, 1);
    assert.match(document.querySelector('.coin-search-result')?.textContent || '', /CHAR/);
    await fill('.coin-search-field input', 'no-such-coin-12345');
    assert.ok(document.querySelector('.coin-search-empty'));
    await click(document.querySelector('.coin-search-clear'));
    assert.ok(document.querySelectorAll('.coin-search-result').length > 1);
    const before = input.getAttribute('aria-activedescendant');
    await key(input, 'ArrowDown');
    assert.notEqual(input.getAttribute('aria-activedescendant'), before);
    await key(input, 'Escape');
    assert.equal(document.querySelector('.coin-search-dialog'), null);
    assert.equal(document.activeElement, trigger);
    assert.equal(document.getElementById('root')?.hasAttribute('inert'), false);
    assert.equal(document.body.style.overflow, '');

    await click(trigger);
    await fill('.coin-search-field input', '$CHAR');
    await key(document.querySelector('.coin-search-field input')!, 'Enter');
    await app.until(
      () =>
        app.dom.window.location.hash === '#/coin/char' &&
        !document.querySelector('.coin-search-dialog'),
      'Enter opens the matching coin and closes search',
    );
    assert.equal(document.getElementById('root')?.hasAttribute('inert'), false);
  } finally {
    await app.close();
  }
});

test('coin hover preserves sprite geometry and pauses the same animation on exit', async () => {
  const app = await mountApp('/discover', (state) => {
    state.profile.reducedMotion = false;
  });
  try {
    const card = app.document.querySelector('.market-coin-card[data-coin-id="char"]')!;
    const sprite = card.querySelector<HTMLElement>('.sprite-pixels')!;
    const geometry = () => [
      sprite.style.width,
      sprite.style.height,
      sprite.style.left,
      sprite.style.top,
      sprite.style.backgroundImage,
    ];
    const before = geometry();
    assert.equal(sprite.style.animationPlayState, 'paused');
    assert.ok(card.querySelector('.market-coin-trend svg'));
    await act(async () => {
      card.dispatchEvent(
        new app.dom.window.MouseEvent('mouseover', {
          bubbles: true,
          relatedTarget: app.document.body,
        }),
      );
    });
    assert.equal(
      card.querySelector('.sprite-pixels'),
      sprite,
      'Hover retains the same sprite element',
    );
    assert.deepEqual(
      geometry(),
      before,
      'Starting animation does not resize or reposition the source',
    );
    assert.notEqual(sprite.style.animationPlayState, 'paused');
    await act(async () => {
      card.dispatchEvent(
        new app.dom.window.MouseEvent('mouseout', {
          bubbles: true,
          relatedTarget: app.document.body,
        }),
      );
    });
    assert.equal(sprite.style.animationPlayState, 'paused');
    assert.deepEqual(geometry(), before);
  } finally {
    await app.close();
  }
});

test('wallet search opens a registered trainer and unknown wallets remain not found', async () => {
  const app = await mountApp();
  try {
    const trainer = DEMO_TRAINERS[0];
    await app.click(app.document.querySelector('.search-trigger'));
    await app.fill('.coin-search-field input', trainer.wallet);
    assert.equal(app.document.querySelectorAll('.trainer-search-result').length, 1);
    await app.click(app.document.querySelector('.trainer-search-result'));
    await app.until(
      () => !!app.document.querySelector('.trainer-public-header'),
      'Search navigates to the trainer profile',
    );
    assert.equal(app.dom.window.location.hash, '#/trainer/' + trainer.wallet);
    assert.equal(
      app.document.querySelector('.trainer-public-identity h1')?.textContent,
      trainer.displayName,
    );
    assert.equal(
      app.document.querySelectorAll('.trainer-public-pokemon').length,
      trainer.pokemon.length,
    );
    await app.go('/trainer/11111111111111111111111111111111');
    await app.until(
      () => app.text().includes('Trainer not found'),
      'Unknown wallets do not create a profile',
    );
  } finally {
    await app.close();
  }
});

test('coin watchlists, shiny PC filtering, and analytics categories stay usable together', async () => {
  const app = await mountApp();
  const { document, click, go } = app;
  try {
    const card = document.querySelector('.market-coin-card[data-coin-id="char"]')!;
    assert.ok(card.querySelector('.coin-avatar .coin-image'));
    assert.equal(card.querySelector('.coin-avatar .pokemon-art'), null);
    assert.ok(card.querySelector('.market-mascot-stage .pokemon-art'));
    assert.match(card.querySelector('.market-cap-figure')?.textContent || '', /Market cap\$/);
    assert.doesNotMatch(card.querySelector('.market-cap-figure')?.textContent || '', /SOL/);
    await click(card.querySelector('.coin-watch-button'));
    assert.equal(card.querySelector('.coin-watch-button')?.getAttribute('aria-pressed'), 'true');
    await click(document.querySelector('.watchlist-tab'));
    assert.equal(document.querySelectorAll('.market-coin-card').length, 1);
    assert.equal(document.querySelector('.market-coin-card')?.getAttribute('data-coin-id'), 'char');
    await go('/pokemon');
    await click(app.button('Shiny'));
    const shinyCards = document.querySelectorAll('.pc-slot');
    assert.equal(shinyCards.length, app.saved().pokemon.filter((pokemon) => pokemon.shiny).length);
    assert.ok(shinyCards.length > 0);
    assert.ok([...shinyCards].every((item) => item.getAttribute('data-variant') === 'shiny'));
    await go('/analytics');
    assert.deepEqual(
      [...document.querySelectorAll('.analytics-metric-copy > span')].map(
        (item) => item.textContent,
      ),
      ['Total rewards', 'Platform trading volume', 'Active users'],
    );
    assert.match(
      document.querySelector('.analytics-connection')?.textContent || '',
      /Demo account/,
    );
    assert.equal(
      document.querySelector('.analytics-local-label')?.textContent,
      'Your demo activity',
    );
    assert.equal(
      document.querySelector('.analytics-feed-source'),
      null,
      'No fabricated community feed',
    );
    await click(app.button('Hatches', document.querySelector('.analytics-event-filters')!));
    assert.equal(
      document.querySelectorAll('.analytics-event').length,
      0,
      'No hatch events are invented',
    );
    assert.match(
      document.querySelector('.analytics-feed-empty')?.textContent || '',
      /No hatches yet/,
    );
    await go('/rewards');
    await click(app.button('Hatch egg'));
    await app.until(
      () => !!document.querySelector('.reveal-v3.is-revealed'),
      'A real local hatch completes before it appears in Analytics',
    );
    const hatchEvent = app.saved().activity.find((entry) => entry.title.includes('hatched'))!;
    assert.ok(hatchEvent, 'The reward action records the hatch');
    await go('/analytics');
    await click(app.button('Hatches', document.querySelector('.analytics-event-filters')!));
    assert.equal(document.querySelectorAll('.analytics-event').length, 1);
    assert.ok(
      [...document.querySelectorAll('.analytics-event')].every((item) =>
        item.classList.contains('event-egg'),
      ),
    );
    assert.equal(
      document.querySelector('.analytics-event-action h3')?.textContent,
      hatchEvent.title,
    );
    assert.equal(
      document.querySelector('.analytics-event-action')?.getAttribute('href'),
      '#' + hatchEvent.href,
    );
    await click(app.button('Redemptions', document.querySelector('.analytics-event-filters')!));
    assert.equal(document.querySelectorAll('.analytics-event').length, 0);
    await go('/discover');
    await click(document.querySelector('.watchlist-tab'));
    assert.equal(
      document.querySelectorAll('.market-coin-card').length,
      1,
      'Watchlist survives navigation',
    );
    await click(document.querySelector('.coin-watch-button'));
    assert.equal(document.querySelectorAll('.market-coin-card').length, 0);
  } finally {
    await app.close();
  }
});

test('the how-to supports categories and search, and the sidebar Pokémon reacts to petting', async () => {
  const app = await mountApp('/guide');
  const { document, click } = app;
  try {
    assert.equal(document.querySelectorAll('.howto-topic-button').length, 10);
    await click(app.button('Offline & online battles'));
    assert.match(document.querySelector('.howto-article')?.textContent || '', /Master/);
    assert.match(
      document.querySelector('.howto-article')?.textContent || '',
      /Offline is always for fun/,
    );
    assert.equal(app.dom.window.location.hash, '#/guide?topic=battles');
    await app.fill('[aria-label="Search the how-to"]', '30 / 20 / 50');
    assert.equal(document.querySelectorAll('.howto-topic-button').length, 1);
    assert.match(
      document.querySelector('.howto-article')?.textContent || '',
      /30% to the creator, 20% to the platform, and 50% to holder rewards/,
    );
    await app.fill('[aria-label="Search the how-to"]', 'unfindable-topic');
    assert.ok(document.querySelector('.howto-no-results'));
    await click(app.button('Show all topics'));
    assert.equal(document.querySelectorAll('.howto-topic-button').length, 10);
    await click(document.querySelector('[aria-label="Pet Charmander"]'));
    assert.ok(document.querySelector('.sidebar-buddy.mood-petted'));
    assert.match(
      document.querySelector('.buddy-dialogue')?.textContent || '',
      /Charmander liked that/,
    );
    assert.ok(document.querySelector('.pet-hearts'));
    assert.match(document.querySelector('.buddy-candy')?.textContent || '', /Rare Candy/);
  } finally {
    await app.close();
  }
});

test('eggs hatch, packs open, equipped sprites update, and a free battle advances', async () => {
  const app = await mountApp('/rewards');
  const { document, click, go } = app;
  try {
    assert.doesNotMatch(
      document.querySelector('main')?.textContent || '',
      /A little gift from|Reserved redemption value/,
    );
    await click(document.querySelector('button[aria-label="Hatch Rare egg"]'));
    await app.until(
      () => !!document.querySelector('.reveal-v3.is-revealed'),
      'Egg reveal completes',
    );
    const hatched = app.saved().pokemon.find((p) => p.id === 'hatched-egg-ready')!;
    assert.ok(hatched, 'The actual drawn Pokémon is added to inventory');
    assert.ok(
      document
        .querySelector('.reveal-v3')
        ?.textContent?.includes(pokemonById(hatched.speciesId).name),
    );
    assert.equal(
      app.saved().rewards.find((r) => r.id === 'egg-ready')?.outcomeSpeciesId,
      hatched.speciesId,
    );
    await click(document.querySelector('.reveal-v3-actions button:first-child'));
    await go('/pokemon');
    assert.equal(app.saved().profile.equippedId, 'hatched-egg-ready');
    assert.equal(document.querySelector('.equipped-mini'), null);
    assert.equal(document.querySelector('.equipped-mini .sprite-pixels-moving'), null);
    await go('/rewards?tab=packs');
    assert.equal(
      document.querySelector('.pack-art .pokemon-art'),
      null,
      'Sealed packs do not reveal a species',
    );
    const beforePack = new Set(app.saved().pokemon.map((p) => p.id));
    await click(document.querySelector('button[aria-label="Open Standard pack"]'));
    await app.until(
      () => !!document.querySelector('.reveal-v3.is-revealed'),
      'Pack reveal completes',
    );
    const unpacked = app.saved().pokemon.find((p) => !beforePack.has(p.id))!;
    assert.ok(unpacked);
    assert.ok(
      document
        .querySelector('.reveal-v3')
        ?.textContent?.includes(pokemonById(unpacked.speciesId).name),
    );
    assert.equal(
      document.querySelector('.reveal-v3 .rarity-badge'),
      null,
      'Owned Pokémon do not inherit pack rarity labels',
    );
    await click(document.querySelector('button[aria-label="Close dialog"]'));
    assert.equal(document.querySelectorAll('.reward-v3-card').length, 1);
    await go('/battles');
    await click(app.button('Offline'));
    await click(document.querySelector('[aria-label="Choose Pokémon for slot 1"]'));
    await click(document.querySelector('.battle-picker-pokemon:not(:disabled)'));
    await click(document.querySelector('.classic-lobby-actions>.button'));
    await app.until(
      () => !!document.querySelector('.battle-field'),
      'Battle artwork finishes loading before the commands appear',
    );
    assert.equal(document.querySelectorAll('.classic-root-actions > button').length, 4);
    assert.ok(document.querySelector('.classic-bag'));
    assert.ok(document.querySelector('.classic-surrender'));
    assert.equal(
      document.querySelector('.classic-player [data-facing]')?.getAttribute('data-facing'),
      'back',
    );
    assert.equal(
      document.querySelector('.classic-rival [data-facing]')?.getAttribute('data-facing'),
      'front',
    );
    await click(document.querySelector('.classic-fight'));
    await click(document.querySelector('.battle-moves>button'));
    await app.until(
      () =>
        /Turn 2/.test(document.querySelector('.battle-page-heading')?.textContent || '') &&
        !document.querySelector<HTMLButtonElement>('.classic-fight')?.disabled,
      'Turn playback completes before the next action',
      8000,
    );
    assert.match(document.querySelector('.battle-page-heading')?.textContent || '', /Turn 2/);
    if (document.querySelector('.classic-surrender')) {
      await click(document.querySelector('.classic-surrender'));
      assert.match(
        document.querySelector('[role="dialog"]')?.textContent || '',
        /Surrender this battle/,
      );
      await click(
        [...document.querySelectorAll('button')].find(
          (button) => button.textContent?.trim() === 'Confirm surrender',
        ),
      );
    }
    assert.ok(document.querySelector('.battle-finish-scene'));
    assert.ok(
      document.querySelector('.classic-result'),
      'Surrender shows the result without restarting the match',
    );
  } finally {
    await app.close();
  }
});

test('earned moves can be added or replace one move, while Eevee evolves to a funded random result', async () => {
  const app = await mountApp('/pokemon/partner');
  const { document, click, go } = app;
  try {
    assert.equal(document.querySelector('.pokemon-back-button')?.getAttribute('href'), '#/pokemon');
    await click(document.querySelector('.pending-move-prompt'));
    assert.equal(document.querySelector('.move-forget-options'), null);
    await click(app.button('Learn Ember'));
    assert.deepEqual(app.saved().pokemon.find((p) => p.id === 'partner')?.moves, [
      'Scratch',
      'Growl',
      'Ember',
    ]);
    assert.equal(document.querySelector('.pending-move-prompt'), null);
    await go('/pokemon/bulbasaur');
    await click(document.querySelector('.pending-move-prompt'));
    assert.equal(document.querySelector('.move-forget-options'), null);
    await click(app.button('Learn Razor Leaf'));
    assert.equal(app.button('Learn Razor Leaf').disabled, true);
    assert.equal(document.querySelectorAll('.forget-move-row').length, 4);
    await click(document.querySelector('.move-forget-options button:first-child'));
    await click(app.button('Learn Razor Leaf'));
    const learned = app.saved().pokemon.find((p) => p.id === 'bulbasaur')!;
    assert.deepEqual(learned.moves, ['Razor Leaf', 'Growl', 'Vine Whip', 'Sleep Powder']);
    assert.equal(learned.moveOffers[0].status, 'learned');
    assert.equal(document.querySelector('.pending-move-prompt'), null);
    await go('/pokemon/eevee');
    assert.ok(document.querySelector('.summary-stats'));
    assert.ok(document.querySelector('.pokemon-move-set'));
    await click(document.querySelector('.summary-evolve-button'));
    assert.equal(document.querySelector('.evolution-funding-note'), null);
    assert.equal(document.querySelectorAll('.evolution-mystery').length, 3);
    assert.equal(document.querySelectorAll('.evolution-mystery-art').length, 3);
    assert.equal(document.querySelector('.evolution-reserve-copy'), null);
    assert.match(document.querySelector('[role="dialog"]')?.textContent || '', /1-in-3/);
    assert.equal(document.querySelector('[role="dialog"] select'), null);
    await click(app.button('Evolve'));
    assert.ok(document.querySelector('.evolution-sequence.evolving'));
    await app.wait(200);
    assert.ok(document.querySelector('.evolution-sequence.complete'));
    const evolved = app.saved().pokemon.find((p) => p.id === 'eevee')!;
    assert.ok([134, 135, 136].includes(evolved.speciesId));
    assert.equal(evolved.backing, 0.225);
    assert.equal(evolved.rareCandy, 100);
    await click(app.button('Continue'));
    assert.equal(document.querySelector('[role="dialog"]'), null);
  } finally {
    await app.close();
  }
});

test('declined moves stay dismissed on return and evolution is unavailable without funding', async () => {
  const app = await mountApp('/pokemon/partner', (state) => {
    state.pokemon.find((p) => p.id === 'bulbasaur')!.evolutionReserve = 0;
    state.coins.find((c) => c.id === 'bulb')!.vault = 0.01;
  });
  const { document, click, go } = app;
  try {
    await click(document.querySelector('.pending-move-prompt'));
    await click(app.button('Do not learn'));
    assert.match(
      document.querySelector('.move-final-warning')?.textContent || '',
      /will not be offered this move again/,
    );
    await click(app.button('Do not learn'));
    assert.equal(
      app.saved().pokemon.find((p) => p.id === 'partner')?.moveOffers[0].status,
      'declined',
    );
    await go('/pokemon');
    await go('/pokemon/partner');
    assert.equal(document.querySelector('.pending-move-prompt'), null);
    assert.deepEqual(app.saved().pokemon.find((p) => p.id === 'partner')?.moves, [
      'Scratch',
      'Growl',
    ]);
    await go('/pokemon/bulbasaur');
    assert.equal(document.querySelector('.summary-evolve-button'), null);
    assert.ok(document.querySelector('.summary-candy-meter'));
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(app.saved().pokemon.find((p) => p.id === 'bulbasaur')?.backing, 0.08);
  } finally {
    await app.close();
  }
});

test('My PC pins the partner by default and keeps actionable sorting available', async () => {
  const app = await mountApp('/pokemon', (state) => {
    state.pokemon.find((p) => p.id === 'gengar')!.acquiredAt = Date.now();
    state.pokemon.find((p) => p.id === 'partner')!.locked = true;
  });
  try {
    const sort = app.document.querySelector<HTMLSelectElement>('[aria-label="Sort Pokémon"]')!;
    assert.equal(sort.value, 'Strongest first');
    assert.equal(app.document.querySelector('.pc-slot')?.getAttribute('href'), '#/pokemon/partner');
    assert.equal(app.document.querySelector('.pc-screen-light'), null);
    await act(async () => {
      sort.value = 'Ready first';
      sort.dispatchEvent(new app.dom.window.Event('change', { bubbles: true }));
    });
    const cards = [...app.document.querySelectorAll('.pc-slot')];
    const firstPlain = cards.findIndex((card) => !card.classList.contains('pc-attention'));
    assert.ok(firstPlain > 0, 'Ready Pokémon appear first');
    assert.ok(cards.slice(firstPlain).every((card) => !card.classList.contains('pc-attention')));
    const locked = app.document.querySelector('a[href="#/pokemon/partner"].pc-slot');
    assert.equal(locked?.classList.contains('pc-attention'), false);
    assert.match(locked?.textContent || '', /Move waiting/);
    await act(async () => {
      sort.value = 'Newest';
      sort.dispatchEvent(new app.dom.window.Event('change', { bubbles: true }));
    });
    assert.equal(app.document.querySelector('.pc-slot')?.getAttribute('href'), '#/pokemon/gengar');
  } finally {
    await app.close();
  }
});

test('the launch wizard validates steps and keeps the chosen Pokémon, image, and links when going back', async () => {
  const app = await mountApp('/create', (state) => {
    state.pokemon.find((p) => p.id === 'gengar')!.locked = true;
  });
  const { document, click, fill } = app;
  const originalImage = globalThis.Image;
  try {
    assert.equal(document.querySelectorAll('.wizard-step').length, 1);
    assert.equal(document.querySelector('.owned-pokemon-selector'), null);
    assert.equal(app.button('Next: Partner').disabled, true);
    await fill('#coin-name', 'Mo');
    await fill('#coin-ticker', 'MOON');
    assert.equal(
      app.button('Next: Partner').disabled,
      true,
      'A name shorter than three characters cannot advance',
    );
    await fill('#coin-name', 'Moonstone Club');
    await fill('#coin-ticker', '   ');
    assert.equal(app.button('Next: Partner').disabled, true, 'A blank ticker cannot advance');
    await fill('#coin-ticker', 'moon club');
    assert.equal(
      app.button('Next: Partner').disabled,
      false,
      'Lowercase and internal spaces are accepted',
    );
    // Stub image decoding only. FileReader and wizard state are exercised normally.
    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      value: class {
        naturalWidth = 1;
        naturalHeight = 1;
        onload: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    });
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    );
    const image = new app.dom.window.File([png], 'moonstone.png', { type: 'image/png' });
    const fileInput = document.querySelector<HTMLInputElement>('#coin-image')!;
    Object.defineProperty(fileInput, 'files', { value: [image], configurable: true });
    await act(async () => {
      fileInput.dispatchEvent(new app.dom.window.Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    assert.ok(
      document
        .querySelector('img[alt="Your coin image"]')
        ?.getAttribute('src')
        ?.startsWith('data:image/png;base64,'),
    );
    assert.equal(document.querySelector('.creation-details-tabs'), null);
    assert.equal(document.querySelector('.creation-links-toggle'), null);
    assert.equal(document.querySelector('#creation-social-links')?.hasAttribute('hidden'), false);
    assert.equal(document.querySelectorAll('.creation-social-fields input').length, 4);
    assert.doesNotMatch(
      document.querySelector('main')?.textContent || '',
      /Live preview|case and spaces are kept|Your coin image is separate from your partner/,
    );
    await fill('#coin-social-x', 'javascript:alert(1)');
    assert.equal(app.button('Next: Partner').disabled, true);
    assert.equal(document.querySelector('#coin-social-x')?.getAttribute('aria-invalid'), 'true');
    await fill('#coin-social-x', 'https://x.com/moonstone');
    await fill('#coin-social-website', 'https://moonstone.example/');
    await click(app.button('Next: Partner'));
    assert.equal(
      document.querySelector('#coin-name'),
      null,
      'The previous step is not displayed below the current step',
    );
    await fill('[aria-label="Find a launch Pokémon"]', 'Gengar');
    assert.equal(document.querySelectorAll('.owned-pokemon-selector button').length, 0);
    await fill('[aria-label="Find a launch Pokémon"]', 'Eevee');
    await click(document.querySelector('.owned-pokemon-selector button'));
    await click(app.button('Back'));
    assert.equal(document.querySelector<HTMLInputElement>('#coin-name')?.value, 'Moonstone Club');
    assert.equal(document.querySelector<HTMLInputElement>('#coin-ticker')?.value, 'moon club');
    assert.ok(document.querySelector('img[alt="Your coin image"]'));
    await click(app.button('Next: Partner'));
    assert.match(
      document.querySelector('.owned-pokemon-selector [aria-pressed="true"]')?.textContent || '',
      /Eevee/,
    );
    await click(app.button('Next: Rewards'));
    const rewardModes = document.querySelector('[role="group"][aria-label="Reward mode"]')!;
    assert.equal(rewardModes.querySelectorAll('button[aria-pressed]').length, 3);
    await click(
      [...rewardModes.querySelectorAll('button')].find(
        (button) => button.querySelector('strong')?.textContent === 'Packs',
      )!,
    );
    assert.match(rewardModes.querySelector('[aria-pressed="true"]')?.textContent || '', /Packs/);
    await click(app.button('Review coin'));
    assert.match(
      document.querySelector('.wizard-review-identity')?.textContent || '',
      /Moonstone Club/,
    );
    assert.match(document.querySelector('.wizard-review-list')?.textContent || '', /Eevee/);
    const linksReview = [...document.querySelectorAll('.wizard-review-list > div')].find(
      (row) => row.querySelector('dt')?.textContent === 'Community links',
    );
    await click(linksReview?.querySelector('button') || null);
    assert.equal(document.querySelector('#creation-social-links')?.hasAttribute('hidden'), false);
    assert.equal(document.activeElement, document.querySelector('#coin-social-website'));
    assert.equal(
      document.querySelector<HTMLInputElement>('#coin-social-x')?.value,
      'https://x.com/moonstone',
    );
    await click(app.button('Next: Partner'));
    await click(app.button('Next: Rewards'));
    await click(app.button('Review coin'));
    await click(app.button('Create coin draft'));
    const saved = app.saved();
    const coin = saved.coins.find((coin) => coin.ticker === 'moon club')!;
    assert.ok(coin);
    assert.equal(coin.launchKind, 'pokemon');
    assert.equal(coin.launchPokemonId, 'eevee');
    assert.equal(
      coin.mode,
      'Packs',
      'The reward choice persists through the remaining wizard steps',
    );
    assert.equal(coin.pokemonId, 133);
    assert.ok(coin.image?.startsWith('data:image/png;base64,'));
    assert.deepEqual(coin.socials, {
      website: 'https://moonstone.example/',
      x: 'https://x.com/moonstone',
    });
    assert.equal(
      saved.pokemon.length,
      app.initial.pokemon.length,
      'The launch Pokémon stays owned',
    );
  } finally {
    Object.defineProperty(globalThis, 'Image', {
      value: originalImage,
      configurable: true,
      writable: true,
    });
    await app.close();
  }
});

test('the launch wizard supports a trainer coin when the inventory is empty', async () => {
  const app = await mountApp('/create', (state) => {
    state.pokemon = [];
    state.profile.equippedId = null;
  });
  try {
    await app.fill('#coin-name', 'Trainer Club');
    await app.fill('#coin-ticker', 'TRAIN');
    await app.click(app.button('Next: Partner'));
    assert.equal(app.document.querySelector('.owned-pokemon-selector'), null);
    assert.match(
      app.document.querySelector('main')?.textContent || '',
      /Your trainer will represent this coin/,
    );
    await app.click(app.button('Next: Rewards'));
    await app.click(app.button('Review coin'));
    await app.click(app.button('Create coin draft'));
    const coin = app.saved().coins.find((coin) => coin.ticker === 'TRAIN')!;
    assert.equal(coin.launchKind, 'trainer');
    assert.equal(coin.launchPokemonId, undefined);
    assert.deepEqual(coin.trainer, {
      character: app.initial.profile.character,
      accessoryColor: app.initial.profile.accessoryColor,
    });
  } finally {
    await app.close();
  }
});

test('a trainer launch is available with an owned collection and keeps that collection unchanged', async () => {
  const app = await mountApp('/create');
  try {
    await app.fill('#coin-name', 'Trainer Club');
    await app.fill('#coin-ticker', 'my trainer');
    await app.click(app.button('Next: Partner'));
    assert.ok(app.document.querySelector('.owned-pokemon-selector'));
    await app.click(app.document.querySelector('.launch-partner-source button:nth-child(2)'));
    assert.equal(app.document.querySelector('.owned-pokemon-selector'), null);
    await app.click(app.button('Next: Rewards'));
    await app.click(app.button('Review coin'));
    await app.click(app.button('Create coin draft'));
    const saved = app.saved();
    const coin = saved.coins.find((entry) => entry.ticker === 'my trainer')!;
    assert.equal(coin.launchKind, 'trainer');
    assert.equal(coin.launchPokemonId, undefined);
    assert.equal(saved.pokemon.length, app.initial.pokemon.length);
  } finally {
    await app.close();
  }
});

test('Pokémon summary exposes current HP and stats without individual reward-tier labels', async () => {
  const app = await mountApp('/pokemon/partner', (state) => {
    const partner = state.pokemon.find((p) => p.id === 'partner')!;
    partner.health = 12;
    partner.rarity = 'Rare';
    partner.shiny = true;
  });
  try {
    const partner = app.saved().pokemon.find((p) => p.id === 'partner')!;
    const hp = getPokemonHealth(partner);
    const meter = app.document.querySelector('[role="meter"][aria-label="Health"]');
    assert.ok(meter);
    assert.equal(Number(meter.getAttribute('aria-valuenow')), 12);
    assert.equal(Number(meter.getAttribute('aria-valuemax')), hp.max);
    assert.ok(app.document.querySelector('.summary-stats'));
    assert.doesNotMatch(
      app.document.querySelector('main')?.textContent || '',
      /\bStandard\b|\bShiny\b/,
    );
    assert.equal(app.document.querySelector('main .rarity-badge'), null);
    assert.ok(app.document.querySelector('main .pokemon-art'));
    assert.ok(app.document.querySelector('.summary-stats'));
    assert.ok(app.document.querySelector('.pokemon-move-set'));
    assert.ok(app.document.querySelector('.summary-main-actions'));
    assert.ok(app.document.querySelector('.pending-move-prompt'));
    assert.equal(app.document.querySelector('.summary-menu'), null);
    await app.click(app.document.querySelector('[aria-label="Pokémon details"]'));
    assert.ok(app.document.querySelector('.pokemon-record-modal'));
    assert.ok(app.document.querySelector('.summary-main-actions'));
    await app.click(
      app.document.querySelector('.pokemon-record-modal [aria-label="Close dialog"]'),
    );
    assert.ok(app.document.querySelector('.summary-stats'));
  } finally {
    await app.close();
  }
});

test('trainer edits auto-save the latest rapid choices and a name survives leaving the editor', async () => {
  const app = await mountApp('/settings');
  const { document, click, fill, go } = app;
  try {
    assert.equal(document.querySelector('.settings-save'), null);
    await fill('#display-name', 'Taylor');
    await fill('#display-name', 'Taylor Kanto');
    await click(document.querySelector('.character-options>button:first-child'));
    await click(document.querySelector('.character-options>button:nth-child(2)'));
    const colour = document.querySelector<HTMLButtonElement>(
      '.colour-options>button:nth-child(4)',
    )!;
    await click(colour);
    await click(document.querySelector('.art-style-options>button:nth-child(2)'));
    await app.until(
      () =>
        app.saved().profile.displayName === 'Taylor Kanto' &&
        app.saved().profile.character === 'leaf' &&
        app.saved().profile.artStyle === 'drawn',
      'The latest edits all auto-save',
    );
    assert.equal(app.saved().profile.accessoryColor, '#aa80d2');
    assert.match(
      document.querySelector('.autosave-status')?.textContent || '',
      /All changes saved/,
    );
    await fill('#display-name', 'Trainer Taylor');
    await go('/pokemon');
    await app.until(
      () => app.saved().profile.displayName === 'Trainer Taylor',
      'Navigating away flushes a name in the debounce window',
    );
    await go('/settings');
    assert.equal(
      document.querySelector<HTMLInputElement>('#display-name')?.value,
      'Trainer Taylor',
    );
    assert.equal(
      document
        .querySelector('.character-options>button:nth-child(2)')
        ?.getAttribute('aria-pressed'),
      'true',
    );
  } finally {
    await app.close();
  }
});

test('Pokémon selling confirms the exact redeemable value and removes the old marketplace', async () => {
  const app = await mountApp('/pokemon/bulbasaur', (state) => {
    state.pokemon.find((p) => p.id === 'bulbasaur')!.listed = 9999;
    const main = state.coins.find((c) => c.main)!;
    main.name = 'Poképad';
    main.ticker = 'POKE';
    main.description = 'The main Poképad token.';
    delete main.creatorWallet;
    delete main.creatorName;
  });
  try {
    const main = app.saved().coins.find((c) => c.main)!;
    assert.equal(main.name, 'Kanto');
    assert.equal(main.ticker, 'KANTO');
    assert.match(main.description, /The main Kanto token/);
    assert.equal(main.creatorWallet, DEMO_TRAINERS[0].wallet);
    assert.equal(app.document.querySelector('a[href="#/marketplace"]'), null);
    await app.click(app.button('Sell'));
    const dialog = app.document.querySelector('[role="dialog"]')!;
    assert.match(dialog.textContent || '', /You receive.*0.08/s);
    assert.equal(dialog.querySelector('input'), null);
    assert.doesNotMatch(dialog.textContent || '', /asking price|listing/i);
    await app.click(app.button('Keep Pokémon', dialog));
    assert.ok(app.saved().pokemon.some((p) => p.id === 'bulbasaur'));
    await app.click(app.button('Sell'));
    await app.click(app.button('Sell for 0.08 SOL'));
    assert.equal(
      app.saved().pokemon.some((p) => p.id === 'bulbasaur'),
      false,
    );
    assert.ok(app.saved().discovered.includes(1));
    assert.equal(app.saved().coins.find((c) => c.id === 'bulb')!.vault, 5.64);
    await app.go('/marketplace');
    assert.ok(app.document.querySelector('.pc-storage'));
    assert.equal(app.document.querySelector('.marketplace-tabs'), null);
  } finally {
    await app.close();
  }
});

test('a faint opens mandatory party selection and the chosen reserve enters without an extra turn', async () => {
  const app = await mountApp('/battles', (state) => {
    const base = state.pokemon[0];
    state.pokemon = [
      {
        ...base,
        id: 'weak-lead',
        speciesId: 129,
        level: 1,
        moves: ['Growl'],
        locked: undefined,
        favourite: true,
      },
      {
        ...base,
        id: 'reserve-one',
        speciesId: 150,
        level: 100,
        moves: ['Psychic'],
        locked: undefined,
        favourite: false,
      },
      {
        ...base,
        id: 'reserve-two',
        speciesId: 149,
        level: 100,
        moves: ['Dragon Rage'],
        locked: undefined,
        favourite: false,
      },
    ];
  });
  try {
    const { document, click } = app;
    await click(app.button('Offline'));
    await click(document.querySelector('[aria-label="Master difficulty"]'));
    for (const [index, name] of ['Magikarp', 'Mewtwo', 'Dragonite'].entries()) {
      await click(
        document.querySelector('[aria-label="Choose Pokémon for slot ' + (index + 1) + '"]'),
      );
      const cards = [...document.querySelectorAll('.battle-picker-pokemon')];
      assert.match(cards[0].textContent || '', /Magikarp/, 'Favourites come first in the picker');
      await click(cards.find((card) => card.querySelector('strong')?.textContent === name)!);
    }
    await click(document.querySelector('.classic-lobby-actions>.button'));
    await app.until(() => !!document.querySelector('.classic-fight'), 'Battle artwork loads', 4000);
    for (
      let attempt = 0;
      attempt < 4 && !document.querySelector('[aria-label="Choose your next Pokémon"]');
      attempt++
    ) {
      await click(document.querySelector('.classic-fight'));
      await click(document.querySelector('.battle-moves>button'));
      await app.until(
        () =>
          !!document.querySelector('[aria-label="Choose your next Pokémon"]') ||
          !!document.querySelector<HTMLButtonElement>('.classic-fight:not(:disabled)'),
        'The attack finishes',
        9000,
      );
    }
    assert.ok(document.querySelector('[aria-label="Choose your next Pokémon"]'));
    assert.equal(
      document.querySelector('.classic-fight'),
      null,
      'Fight is not offered while a replacement is required',
    );
    assert.equal(
      document.querySelector('.classic-menu-back')?.tagName,
      'DIV',
      'The mandatory picker cannot be dismissed',
    );
    assert.equal(
      document.querySelector<HTMLButtonElement>('[aria-label="Send out Magikarp"]')?.disabled,
      true,
    );
    const turn = document.querySelector('.battle-page-heading')?.textContent;
    await click(document.querySelector('[aria-label="Send out Dragonite"]'));
    await app.until(
      () => !!document.querySelector<HTMLButtonElement>('.classic-fight:not(:disabled)'),
      'The replacement finishes its send-out',
      4000,
    );
    assert.match(document.querySelector('.classic-health-player')?.textContent || '', /Dragonite/);
    assert.equal(
      document.querySelector('.battle-page-heading')?.textContent,
      turn,
      'Replacement is not another combat turn',
    );
    assert.equal(app.saved().pokemon.length, 3, 'Practice never changes collection ownership');
  } finally {
    await app.close();
  }
});

test('PC defaults to partner, favourites, then strength; explicit SOL sorting remains independent', async () => {
  const app = await mountApp('/pokemon', (state) => {
    const base = state.pokemon[0];
    state.profile.equippedId = 'ready';
    state.pokemon = [
      {
        ...base,
        id: 'strong',
        speciesId: 150,
        level: 70,
        rareCandy: 0,
        backing: 0.01,
        favourite: false,
        moveOffers: [],
      },
      {
        ...base,
        id: 'ready',
        speciesId: 10,
        level: 5,
        rareCandy: 0,
        backing: 9,
        favourite: false,
        moveOffers: [{ id: 'ready-move', move: 'Tackle', level: 5, status: 'pending' }],
      },
      {
        ...base,
        id: 'middle',
        speciesId: 25,
        level: 30,
        rareCandy: 0,
        backing: 0.1,
        favourite: false,
        moveOffers: [],
      },
    ];
  });
  try {
    const order = () =>
      [...app.document.querySelectorAll('.pc-grid .pc-slot')].map((el) => el.getAttribute('href'));
    assert.deepEqual(order(), ['#/pokemon/ready', '#/pokemon/strong', '#/pokemon/middle']);
    await app.click(app.document.querySelector('[aria-label="Add Pikachu to favourites"]'));
    assert.equal(app.saved().pokemon.find((p) => p.id === 'middle')?.favourite, true);
    assert.equal(
      app.document
        .querySelector('[aria-label="Remove Pikachu from favourites"]')
        ?.getAttribute('aria-pressed'),
      'true',
    );
    const select = app.document.querySelector<HTMLSelectElement>('[aria-label="Sort Pokémon"]')!;
    const sort = async (value: string) =>
      act(async () => {
        select.value = value;
        select.dispatchEvent(new app.dom.window.Event('change', { bubbles: true }));
      });
    assert.deepEqual(order(), ['#/pokemon/ready', '#/pokemon/middle', '#/pokemon/strong']);
    await sort('Strongest first');
    assert.deepEqual(order(), ['#/pokemon/ready', '#/pokemon/middle', '#/pokemon/strong']);
    await sort('Highest value');
    assert.deepEqual(order(), ['#/pokemon/ready', '#/pokemon/middle', '#/pokemon/strong']);
    await sort('Favourites first');
    assert.deepEqual(order(), ['#/pokemon/middle', '#/pokemon/strong', '#/pokemon/ready']);
    await app.click(app.button('Favourites'));
    assert.deepEqual(order(), ['#/pokemon/middle']);
    await app.go('/pokemon/middle');
    assert.equal(
      app.document.querySelector('.pokemon-favourite')?.getAttribute('aria-pressed'),
      'true',
    );
    await app.click(app.document.querySelector('.pokemon-favourite'));
    assert.equal(app.saved().pokemon.find((p) => p.id === 'middle')?.favourite, false);
  } finally {
    await app.close();
  }
});

test('Pokédex separates permanent variant discoveries and reference totals from owned backing', async () => {
  const app = await mountApp('/pokedex', (state) => {
    const base = state.pokemon[0];
    state.pokemon = [
      { ...base, id: 'normal-one', speciesId: 1, shiny: false, backing: 0.123, moveOffers: [] },
    ];
    state.discovered = [1, 25, 150];
    state.discoveredVariants = { normal: [1], shiny: [25], unknown: [150] };
    state.rewards = [];
    state.activity = [];
  });
  try {
    const { document } = app;
    assert.equal(document.querySelectorAll('.dex-card').length, 151);
    assert.equal(
      document.querySelector('.dex-card[data-species="1"]')?.classList.contains('discovered'),
      true,
    );
    assert.equal(
      document.querySelector('.dex-card[data-species="25"]')?.classList.contains('discovered'),
      false,
    );
    assert.match(document.querySelector('.dex-owned-total')?.textContent || '', /0.123/);
    assert.match(
      document.querySelector('.dex-catalogue-total')?.textContent || '',
      /all 151 species/,
    );
    assert.match(document.querySelector('.dex-legacy-note')?.textContent || '', /1 older species/);
    assert.equal(document.querySelectorAll('.dex-entry-value .sol-value').length, 151);
    await app.click(document.querySelector('.dex-section-tabs button:nth-child(2)'));
    assert.equal(
      document.querySelector('.dex-card[data-species="25"]')?.classList.contains('discovered'),
      true,
    );
    assert.equal(
      document.querySelector('.dex-card[data-species="1"]')?.classList.contains('discovered'),
      false,
    );
    assert.match(document.querySelector('.dex-owned-total')?.textContent || '', /0 Pokémon/);
    const sort = document.querySelector<HTMLSelectElement>('[aria-label="Sort the Pokédex"]')!;
    await act(async () => {
      sort.value = 'Highest SOL value';
      sort.dispatchEvent(new app.dom.window.Event('change', { bubbles: true }));
    });
    assert.equal(document.querySelector('.dex-card')?.getAttribute('data-species'), '151');
    await app.click(document.querySelector('.dex-card[data-species="25"]'));
    assert.match(
      document.querySelector('[role="dialog"]')?.textContent || '',
      /Shiny catalogue value/,
    );
    assert.match(
      document.querySelector('[role="dialog"]')?.textContent || '',
      /record stays even after/,
    );
    assert.equal(document.querySelector('.dex-owned-copies'), null);
  } finally {
    await app.close();
  }
});

test('PC bag heals only eligible Pokémon and selected moves show an inline battle preview', async () => {
  const app = await mountApp('/pokemon/partner', (s) => {
    s.pokemon.find((p) => p.id === 'partner')!.health = 0;
  });
  try {
    assert.equal(app.document.querySelector('.summary-battle-status'), null);
    await app.click(app.button('Use item'));
    const items = [...app.document.querySelectorAll<HTMLButtonElement>('.pc-care-items button')];
    const revive = items.find((b) => b.querySelector('strong')?.textContent?.startsWith('Revive'))!;
    assert.equal(revive.disabled, false);
    assert.ok(items.filter((b) => b !== revive).every((b) => b.disabled));
    await app.click(revive);
    assert.ok(app.saved().pokemon.find((p) => p.id === 'partner')!.health! > 0);
    assert.equal(app.saved().bag?.revive, 0);
    await app.click(app.document.querySelector('[role="dialog"] [aria-label="Close dialog"]'));
    assert.equal(app.document.querySelector('.summary-move-card summary'), null);
    await app.click(app.document.querySelector('[aria-label="Select Scratch"]'));
    assert.ok(app.document.querySelector('.game-move-detail .move-preview-field'));
    assert.match(app.document.querySelector('.game-move-detail')!.textContent!, /Accuracy/);
    assert.equal(app.document.querySelector('[role="dialog"]'), null);
  } finally {
    await app.close();
  }
});

test('reset demo reopens dismissed move and evolution prompts; banner presets auto-save', async () => {
  const app = await mountApp('/settings');
  try {
    await app.click(app.button('Cerulean'));
    await app.wait(700);
    assert.equal(app.saved().profile.bannerPreset, 'ocean');
    assert.equal(app.document.querySelectorAll('.banner-presets button').length, 4);
    assert.ok(app.document.querySelector('[aria-label="Upload custom avatar"]'));
    await app.go('/profile');
    assert.equal(app.document.querySelector('.trainer-banner .pokemon-art'), null);
    await app.go('/settings');
    // Account tab holds the existing reset control.
    await app.click(app.button('Wallet'));
    await app.click(app.button('Reset demo'));
    const confirm = app.document.querySelector('[role="dialog"]')!;
    await app.click(app.button('Reset demo', confirm));
    await app.until(
      () => !!app.document.querySelector('[role="dialog"][data-modal-owner]'),
      'Reset opens trainer prompts',
    );
    assert.match(
      app.document.querySelector('[role="dialog"][data-modal-owner]')!.textContent!,
      /wants to learn|Evolve/,
    );
    await app.click(app.button('Later'));
    await app.go('/settings');
    // Defer any other queued opportunities before opening settings again.
    for (let i = 0; i < 10 && app.document.querySelector('[role="dialog"][data-modal-owner]'); i++)
      await app.click(app.button('Later'));
    await app.click(app.button('Wallet'));
    await app.click(app.button('Reset demo'));
    await app.click(app.button('Reset demo', app.document.querySelector('[role="dialog"]')!));
    await app.until(
      () => !!app.document.querySelector('[role="dialog"][data-modal-owner]'),
      'Reset clears previous Later acknowledgements',
    );
  } finally {
    await app.close();
  }
});

test('PC actions show owned manuals, teach in two steps and consume only on confirmation', async () => {
  const app = await mountApp('/pokemon', (s) => {
    s.profile.starterClaimed = true;
    s.pokemon.forEach((p) => {
      p.moveOffers = [];
      p.rareCandy = 0;
    });
    const p = s.pokemon[0];
    p.locked = false;
    p.moves = ['Tackle', 'Growl', 'Ember', 'Scratch'];
    s.gymProgress!.manuals = { Rest: 1 };
  });
  try {
    const { document, click } = app;
    await click(
      document.querySelector(
        '[aria-label="More actions for ' +
          pokemonById(app.initial.pokemon[0].speciesId).name +
          '"]',
      ),
    );
    await click(
      [...document.querySelectorAll('[role=menuitem]')].find(
        (e) => e.textContent === 'Teach move',
      )!,
    );
    assert.match(document.querySelector('.owned-manuals')?.textContent || '', /Rest.*×1/);
    await click(app.button('Teach'));
    assert.equal(document.querySelector('.move-forget-options'), null);
    assert.equal(document.querySelector('.move-preview-controls'), null);
    assert.equal(
      document.querySelector('.move-decision-dialog')?.closest('.modal-backdrop')?.parentElement,
      document.body,
      'Learning dialogs escape animated card bounds',
    );
    await click(app.button('Learn Rest'));
    assert.equal(document.querySelectorAll('.forget-move-row').length, 4);
    assert.equal(app.saved().gymProgress!.manuals.Rest, 1);
    await click(app.button('Do not learn'));
    assert.equal(app.saved().gymProgress!.manuals.Rest, 1);
    await click(app.button('Teach'));
    await click(app.button('Learn Rest'));
    await click(document.querySelector('.forget-move-row > button'));
    await click(app.button('Learn Rest'));
    assert.equal(app.saved().gymProgress!.manuals.Rest, 0);
    assert.match(
      document.querySelector('.gym-manual-panel')?.textContent || '',
      /You don’t have any move manuals/,
    );
  } finally {
    await app.close();
  }
});
test('offline team slots open a compact picker with nested Pokémon and move information', async () => {
  const app = await mountApp('/battles');
  try {
    const { document, click } = app;
    assert.equal(document.querySelectorAll('.battle-party-slot').length, 3);
    assert.doesNotMatch(app.text(), /Build your party|Kanto practice league/);
    await click(document.querySelector('[aria-label="Choose Pokémon for slot 1"]'));
    await click(document.querySelector('.picker-info'));
    assert.ok(document.querySelector('.party-info-stats'));
    assert.ok(document.querySelector('.party-info-moves'));
    await click(document.querySelector('.party-info-moves .move-info-button'));
    assert.ok(document.querySelector('.move-preview-field'));
    assert.doesNotMatch(app.text(), /Looping battle preview|no items or PP used/);
    assert.equal(document.querySelector('button[aria-label="Pause preview"]'), null);
    await act(async () =>
      document.dispatchEvent(
        new app.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ),
    );
    assert.equal(document.querySelector('.move-info-dialog'), null);
    assert.ok(document.querySelector('.pokemon-battle-info'));
    await act(async () =>
      document.dispatchEvent(
        new app.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ),
    );
    assert.equal(document.querySelector('.pokemon-battle-info'), null);
    assert.ok(document.querySelector('.party-picker-modal'));
  } finally {
    await app.close();
  }
});
test('gym directory displays one-badge rewards and the complete inspectable manual catalogue', async () => {
  const app = await mountApp('/gyms');
  try {
    assert.doesNotMatch(app.text(), /KANTO LEAGUE|medals/);
    assert.ok(app.document.querySelector('.gym-directory-row'));
    await app.click(app.button('Move manuals'));
    assert.equal(app.document.querySelectorAll('.manual-catalogue-entry').length, 30);
    await app.click(app.document.querySelector('.manual-catalogue-entry .move-info-button'));
    assert.ok(app.document.querySelector('.move-preview-field'));
  } finally {
    await app.close();
  }
});

test('reward indicator counts only unopened packs and eggs ready to hatch', async () => {
  const app = await mountApp('/pokemon', (state) => {
    const reward = { ...state.rewards[0], awardedAt: Date.now(), initialDuration: 3600000 };
    state.rewards = [
      { ...reward, id: 'ready', kind: 'egg', readyAt: Date.now() - 1000, openedAt: undefined },
      {
        ...reward,
        id: 'incubating',
        kind: 'egg',
        readyAt: Date.now() + 3600000,
        openedAt: undefined,
      },
      { ...reward, id: 'pack', kind: 'pack', readyAt: Date.now() + 3600000, openedAt: undefined },
      { ...reward, id: 'opened', kind: 'pack', openedAt: Date.now() - 1000 },
    ];
  });
  try {
    assert.equal(app.document.querySelector('.nav-count')?.textContent, '2');
    assert.equal(pokemonById(83).name, 'Farfetch’d');
  } finally {
    await app.close();
  }
  const empty = await mountApp('/pokemon', (state) => {
    state.rewards = state.rewards.map((r) => ({
      ...r,
      kind: 'egg',
      awardedAt: Date.now(),
      initialDuration: 3600000,
      readyAt: Date.now() + 3600000,
      openedAt: undefined,
    }));
  });
  try {
    assert.equal(empty.document.querySelector('.nav-count'), null);
  } finally {
    await empty.close();
  }
});

test('legal routes remain readable during pending trainer prompts and footer destinations are honest', async () => {
  const app = await mountApp('/terms', (state) => {
    state.demoPromptEpoch = 1;
  });
  try {
    const footer = app.document.querySelector('footer')!;
    assert.ok(footer);
    assert.match(footer.textContent || '', new RegExp('© ' + new Date().getFullYear() + ' Kanto'));
    assert.equal(footer.querySelector('a[href="#/terms"]')?.textContent, 'Terms of Service');
    assert.equal(footer.querySelector('a[href="#/privacy"]')?.textContent, 'Privacy Policy');
    assert.equal(footer.querySelector('a[href="https://x.com"]')?.getAttribute('target'), '_blank');
    assert.equal(footer.querySelector('a[href^="https://pump.fun"]'), null);
    assert.ok(footer.querySelector('[aria-label="Pump.fun main coin link coming soon"]'));
    assert.equal(app.document.querySelector('.legal-heading h1')?.textContent, 'Terms of Service');
    assert.equal(app.document.querySelector('.trainer-prompts'), null);
    await app.go('/privacy');
    assert.equal(app.document.title, 'Privacy Policy · Kanto');
    assert.equal(app.document.querySelector('.legal-heading h1')?.textContent, 'Privacy Policy');
    assert.match(
      app.document.querySelector('.legal-contact')?.textContent || '',
      /Contact email to be added/,
    );
    assert.equal(app.document.querySelector('.trainer-prompts'), null);
    await app.go('/pokemon');
    assert.ok(
      app.document.querySelector('.trainer-prompts'),
      'Normal prompt handling returns after leaving legal pages',
    );
  } finally {
    await app.close();
  }
});

test('summary shows moves beside the Pokémon and stats below, including after selecting a move', async () => {
  const app = await mountApp('/pokemon/dragonite');
  try {
    assert.equal(
      app.document.querySelector('[role="tablist"][aria-label="Pokémon information"]'),
      null,
    );
    assert.ok(app.document.querySelector('.pokemon-move-set'));
    assert.ok(app.document.querySelector('.summary-stats'));
    await app.click(app.document.querySelectorAll('.game-move-select')[1]);
    assert.ok(app.document.querySelector('.summary-stats'));
    assert.ok(app.document.querySelector('.summary-main-actions'));
    const selected = app.saved().pokemon.find((p) => p.id === 'dragonite')!.moves[1];
    assert.equal(
      app.document.querySelector('.game-move-detail .move-preview')?.getAttribute('aria-label'),
      selected + ' battle animation preview',
    );
    assert.equal(app.document.querySelector('.game-move-row .move-info-button'), null);
    assert.equal(app.document.querySelector('.move-watch-button'), null);
    assert.equal(app.document.querySelector('[role="dialog"]'), null);
    const selectedButton = app.document.querySelectorAll<HTMLButtonElement>('.game-move-select')[1];
    await act(async () => {
      selectedButton.dispatchEvent(
        new app.dom.window.KeyboardEvent('keydown', { key: 'Home', bubbles: true }),
      );
    });
    const first = app.saved().pokemon.find((p) => p.id === 'dragonite')!.moves[0];
    assert.equal(
      app.document.querySelector('.game-move-detail .move-preview')?.getAttribute('aria-label'),
      first + ' battle animation preview',
    );
    assert.equal(app.document.activeElement, app.document.querySelector('.game-move-select'));
    assert.equal(
      app.document.querySelector('.game-move-select')?.getAttribute('aria-pressed'),
      'true',
    );
  } finally {
    await app.close();
  }
});

test('a single paired defender can be challenged and unpaired gyms render no empty slot cards', async () => {
  const app = await mountApp('/gym/paired', (s) => {
    s.coins = [
      { ...s.coins[0], id: 'paired', launchKind: 'pokemon', pokemonId: 25 },
      { ...s.coins[0], id: 'unpaired', launchKind: 'trainer', pokemonId: 0 },
    ];
    s.profile.supportedGym = undefined;
  });
  try {
    assert.equal(app.document.querySelectorAll('.gym-partner-defender').length, 1);
    assert.equal(app.document.querySelectorAll('.gym-defender.empty').length, 0);
    assert.equal(
      app.document.querySelectorAll('.gym-partner-defender a[href^="#/trainer/"]').length,
      0,
    );
    assert.ok(app.document.querySelector('a[href="#/battles?gym=paired"]'));
    await app.go('/battles?gym=paired');
    for (const slot of [1, 2, 3]) {
      await app.click(app.document.querySelector(`[aria-label="Choose Pokémon for slot ${slot}"]`));
      await app.click(
        app.document.querySelectorAll('.battle-picker-pokemon:not(:disabled)')[slot - 1],
      );
    }
    const start = app.button('Start gym challenge');
    assert.equal(start.disabled, false, 'One defender is enough to start a challenge');
    await app.click(start);
    await app.until(() => !!app.document.querySelector('.battle-field'), 'Gym battle starts');
    assert.equal(app.document.querySelectorAll('.classic-health-rival .pokeball').length, 1);
    await app.go('/gym/unpaired');
    assert.equal(app.document.querySelectorAll('.gym-defender').length, 0);
    assert.match(
      app.document.querySelector('.gym-defence-empty')?.textContent || '',
      /No defenders yet/,
    );
    assert.equal(app.document.querySelector('a[href="#/battles?gym=unpaired"]'), null);
  } finally {
    await app.close();
  }
});

test('reward opening preloads its artwork, waits for decoding, and retries without a second claim', async () => {
  const app = await mountApp('/rewards', (s) => {
    s.profile.artStyle = 'drawn';
  });
  const prototype = app.dom.window.HTMLImageElement.prototype;
  const decode = prototype.decode;
  const pending: { resolve: () => void; reject: (error: Error) => void }[] = [];
  prototype.decode = function () {
    if (!this.isConnected && this.src.includes('/pokemon/'))
      return new Promise<void>((resolve, reject) => pending.push({ resolve, reject }));
    return decode.call(this);
  };
  try {
    const count = app.saved().pokemon.length;
    await app.click(app.document.querySelector('button[aria-label="Hatch Rare egg"]'));
    await app.until(() => pending.length === 1, 'Reward artwork begins decoding during opening');
    await app.wait(250);
    assert.equal(app.document.querySelector('.reveal-v3.is-revealed'), null);
    assert.equal(app.saved().pokemon.length, count + 1);
    await act(async () => pending[0].reject(new Error('Temporary artwork failure')));
    await app.click(app.button('Retry artwork'));
    await app.until(() => pending.length === 2, 'Retry downloads only the artwork');
    assert.equal(app.saved().pokemon.length, count + 1);
    await act(async () => pending[1].resolve());
    await app.until(
      () => !!app.document.querySelector('.reveal-v3.is-revealed'),
      'Reveal waits for the decoded Pokémon',
    );
    assert.equal(app.saved().pokemon.length, count + 1);
  } finally {
    prototype.decode = decode;
    await app.close();
  }
});

test('fainted PC cards show recovery, consume an owned Revive and retain summary access', async () => {
  const app = await mountApp('/pokemon', (state) => {
    state.pokemon.forEach((p) => (p.moveOffers = []));
    const p = state.pokemon[0];
    Object.assign(p, { health: 0, recoverAt: Date.now() + 600000, locked: false, rareCandy: 0 });
    state.bag!.revive = 1;
  });
  try {
    const card = app.document.querySelector('.pc-slot-wrapper.is-fainted')!;
    assert.ok(card);
    assert.match(card.textContent || '', /FNTFaintedFull HP in 10:00/);
    assert.equal(
      card.querySelectorAll('a button').length,
      0,
      'Revive is not nested in the summary link',
    );
    await app.click(card.querySelector('a.pc-slot'));
    await app.go('/pokemon/' + app.initial.pokemon[0].id);
    assert.ok(app.document.querySelector('.summary-mon-screen.is-fainted .pokemon-recovery'));
    await app.go('/pokemon');
    await app.click(app.document.querySelector('.pokemon-revive-button'));
    assert.equal(app.saved().bag!.revive, 0);
    assert.equal(
      app.saved().pokemon[0].health,
      Math.floor(getPokemonHealth(app.initial.pokemon[0]).max / 2),
    );
    assert.equal(app.document.querySelector('.pc-slot-wrapper.is-fainted'), null);
    assert.equal(app.document.querySelector('.pokemon-recovery'), null);
  } finally {
    await app.close();
  }
});

test('a fainted card without Revives counts down and restores full HP without navigation', async () => {
  const app = await mountApp('/pokemon', (state) => {
    state.pokemon.forEach((p) => (p.moveOffers = []));
    Object.assign(state.pokemon[0], {
      health: 0,
      recoverAt: Date.now() + 2200,
      locked: false,
      rareCandy: 0,
    });
    state.bag!.revive = 0;
  });
  try {
    assert.ok(app.document.querySelector('.pc-slot-wrapper.is-fainted [role="timer"]'));
    assert.equal(app.document.querySelector('.pokemon-revive-button'), null);
    assert.match(
      app.document.querySelector('.pokemon-recovery')!.textContent || '',
      /No Revives in your bag/,
    );
    await app.wait(3200);
    assert.equal(app.document.querySelector('.pc-slot-wrapper.is-fainted'), null);
    assert.equal(app.saved().pokemon[0].health, getPokemonHealth(app.initial.pokemon[0]).max);
    assert.equal(app.saved().pokemon[0].recoverAt, undefined);
  } finally {
    await app.close();
  }
});

test('portfolio daily changes round to two decimals for losses, gains and unchanged prices', async () => {
  const app = await mountApp('/portfolio', (state) => {
    state.coins[0].holding = 1;
    state.coins[0].change = -37.34787634312735;
    state.coins[1].holding = 1;
    state.coins[1].change = 12.346;
    state.coins[2].holding = 1;
    state.coins[2].change = 0;
  });
  try {
    const changes = [...app.document.querySelectorAll('[data-label="Last 24h"]')].map((cell) =>
      cell.textContent?.trim(),
    );
    assert.deepEqual(changes.slice(0, 3), ['-37.35%', '+12.35%', '0.00%']);
  } finally {
    await app.close();
  }
});
