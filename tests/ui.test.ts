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
    assert.equal(document.querySelectorAll('.howto-topic-button').length, 9);
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
    assert.equal(document.querySelectorAll('.howto-topic-button').length, 9);
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
    await click(document.querySelector('.arena-hero .button'));
    await click(document.querySelector('.team-select-card'));
    await click(document.querySelector('.battle-review>.button'));
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
    assert.equal(app.button('Learn Razor Leaf').disabled, true);
    assert.equal(document.querySelectorAll('.move-forget-options button').length, 4);
    await click(document.querySelector('.move-forget-options button:first-child'));
    await click(app.button('Learn Razor Leaf'));
    const learned = app.saved().pokemon.find((p) => p.id === 'bulbasaur')!;
    assert.deepEqual(learned.moves, ['Razor Leaf', 'Growl', 'Vine Whip', 'Sleep Powder']);
    assert.equal(learned.moveOffers[0].status, 'learned');
    assert.equal(document.querySelector('.pending-move-prompt'), null);
    await go('/pokemon/eevee');
    await click(app.button('Evolution'));
    assert.equal(document.querySelector('.evolution-funding-note'), null);
    assert.equal(document.querySelectorAll('.evolution-mystery').length, 3);
    assert.equal(document.querySelectorAll('.evolution-mystery-art').length, 3);
    await click(app.button('Evolve Pokémon'));
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
    await click(app.button('Evolution'));
    assert.equal(app.button('Evolve Pokémon').disabled, true);
    assert.match(document.querySelector('.evolution-unavailable')?.textContent || '', /fund/i);
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(app.saved().pokemon.find((p) => p.id === 'bulbasaur')?.backing, 0.08);
  } finally {
    await app.close();
  }
});

test('My PC prioritises actionable Pokémon and keeps explicit sorting available', async () => {
  const app = await mountApp('/pokemon', (state) => {
    state.pokemon.find((p) => p.id === 'gengar')!.acquiredAt = Date.now();
    state.pokemon.find((p) => p.id === 'partner')!.locked = true;
  });
  try {
    const cards = [...app.document.querySelectorAll('.pc-slot')];
    const firstPlain = cards.findIndex((card) => !card.classList.contains('pc-attention'));
    assert.ok(firstPlain > 0, 'Ready Pokémon appear first');
    assert.ok(cards.slice(firstPlain).every((card) => !card.classList.contains('pc-attention')));
    const locked = app.document.querySelector('a[href="#/pokemon/partner"].pc-slot');
    assert.equal(locked?.classList.contains('pc-attention'), false);
    assert.match(locked?.textContent || '', /Move waiting/);
    const sort = app.document.querySelector<HTMLSelectElement>('[aria-label="Sort Pokémon"]')!;
    assert.equal(sort.value, 'Ready first');
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
    assert.equal(
      document.querySelector('.creation-links-toggle')?.getAttribute('aria-expanded'),
      'false',
    );
    await click(document.querySelector('.creation-links-toggle'));
    assert.equal(
      document.querySelector('.creation-links-toggle')?.getAttribute('aria-expanded'),
      'true',
    );
    await fill('#coin-social-x', 'javascript:alert(1)');
    assert.equal(app.button('Next: Partner').disabled, true);
    assert.equal(document.querySelector('#coin-social-x')?.getAttribute('aria-invalid'), 'true');
    await fill('#coin-social-x', 'https://x.com/moonstone');
    await fill('#coin-social-website', 'https://moonstone.example/');
    await click(document.querySelector('.creation-links-toggle'));
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
    assert.equal(
      document.querySelector('.creation-links-toggle')?.getAttribute('aria-expanded'),
      'true',
    );
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
    await app.click(app.button('Moves'));
    assert.equal(
      app.document.querySelector('.summary-stats'),
      null,
      'Only the selected information panel is shown',
    );
    assert.ok(app.document.querySelector('.summary-main-actions'));
    assert.ok(app.document.querySelector('.pending-move-prompt'));
    await app.click(app.button('Details'));
    assert.ok(app.document.querySelector('.summary-main-actions'));
    await app.click(app.button('Stats'));
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
    await click(document.querySelector('[aria-label="Master difficulty"]'));
    await click(document.querySelector('.arena-hero .button'));
    const cards = [...document.querySelectorAll('.team-select-card')];
    assert.match(cards[0].textContent || '', /Magikarp/, 'Favourites come first in the picker');
    for (const name of ['Magikarp', 'Mewtwo', 'Dragonite'])
      await click(cards.find((card) => card.querySelector('strong')?.textContent === name)!);
    await click(document.querySelector('.battle-review>.button'));
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

test('PC favourites persist, ready Pokémon lead by strength, and SOL sorting remains independent', async () => {
  const app = await mountApp('/pokemon', (state) => {
    const base = state.pokemon[0];
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
    await sort('Strongest first');
    assert.deepEqual(order(), ['#/pokemon/strong', '#/pokemon/middle', '#/pokemon/ready']);
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
