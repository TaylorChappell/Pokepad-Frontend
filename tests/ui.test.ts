import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createInitialState } from '../src/data/demo';
import { STORAGE_KEY } from '../src/state/model';
import type { AppSnapshot } from '../src/types';

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
    assert.match(app.text(), /A launchpad for Pokémon trainers/);
    assert.equal(document.querySelectorAll('.coin-card').length, 8);
    assert.equal(app.saved().profile.artStyle, 'pixel');
    assert.ok(document.querySelector('.equipped-mini .sprite-art[aria-label="Charmander"]'));
    assert.ok(document.querySelector('.trainer-avatar.pixel-avatar'));
    await act(async () =>
      document.querySelector<HTMLInputElement>('.global-search input')!.focus(),
    );
    await fill('.global-search input', 'GENG');
    assert.equal(document.querySelectorAll('.search-results>a').length, 1);
    await click(document.querySelector('.notification-button'));
    assert.ok(document.querySelector('.notification-dropdown'));
    await click(document.querySelector('.dropdown-heading button'));
    assert.equal(document.querySelector('.unread-dot'), null);

    for (const path of [
      '/explore',
      '/coin/char',
      '/create',
      '/portfolio',
      '/rewards',
      '/walk',
      '/pokemon',
      '/pokemon/partner',
      '/pokedex',
      '/marketplace',
      '/gyms',
      '/gym/char',
      '/profile',
      '/settings',
      '/activity',
      '/starter',
      '/creator',
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
    await click(document.querySelector('.settings-save>button'));
    assert.equal(app.saved().profile.displayName, 'Kanto Taylor');
    assert.equal(app.saved().profile.character, 'misty');
    assert.equal(app.saved().profile.artStyle, 'drawn');
    assert.match(document.querySelector('.account-name')?.textContent || '', /Kanto Taylor/);
    assert.ok(document.querySelector('.equipped-mini img.drawn-art[alt="Charmander"]'));
    // The little interactive sidebar companion stays a game sprite in either art setting.
    assert.ok(document.querySelector('.buddy-pet .sprite-art'));
    await click(document.querySelector('.art-style-options>button:first-child'));
    await click(document.querySelector('.settings-save>button'));
    assert.equal(app.saved().profile.artStyle, 'pixel');
    assert.ok(document.querySelector('.equipped-mini .sprite-art'));
  } finally {
    await app.close();
  }
});

test('the animated handbook has three pages and the sidebar Pokémon reacts to petting', async () => {
  const app = await mountApp('/guide');
  const { document, click } = app;
  try {
    assert.equal(document.querySelectorAll('.manual-page-tabs button').length, 3);
    assert.match(document.querySelector('.manual-writing h2')?.textContent || '', /Choose a coin/);
    assert.equal(
      document.querySelector<HTMLButtonElement>('[aria-label="Previous handbook page"]')?.disabled,
      true,
    );
    await click(document.querySelector('[aria-label="Next handbook page"]'));
    assert.match(document.querySelector('.manual-writing h2')?.textContent || '', /Hatch eggs/);
    assert.equal(
      document.querySelector('[aria-label="Handbook page 2"]')?.getAttribute('aria-current'),
      'page',
    );
    await act(async () => {
      document.body.dispatchEvent(
        new app.dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );
    });
    assert.match(
      document.querySelector('.manual-writing h2')?.textContent || '',
      /Train, evolve, and battle/,
    );
    assert.equal(
      document.querySelector<HTMLButtonElement>('[aria-label="Next handbook page"]')?.disabled,
      true,
    );
    await click(document.querySelector('[aria-label="Handbook page 1"]'));
    assert.match(document.querySelector('.manual-writing h2')?.textContent || '', /Choose a coin/);
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
    await app.wait(150);
    assert.ok(document.querySelector('.opening-scene.revealed'));
    assert.match(document.querySelector('.opening-scene')?.textContent || '', /Haunter/);
    await click(document.querySelector('.reveal-actions button:first-child'));
    await go('/pokemon');
    assert.equal(app.saved().profile.equippedId, 'hatched-egg-ready');
    assert.ok(document.querySelector('.equipped-mini .pokemon-art[aria-label="Haunter"]'));
    await go('/rewards?tab=packs');
    await click(document.querySelector('button[aria-label="Open Standard pack"]'));
    await app.wait(150);
    assert.match(document.querySelector('.opening-scene')?.textContent || '', /Pikachu/);
    await click(document.querySelector('button[aria-label="Close dialog"]'));
    assert.equal(document.querySelectorAll('.reward-card').length, 1);
    await go('/battles');
    await click(document.querySelector('.arena-hero .button'));
    await click(document.querySelector('.team-select-card'));
    await click(document.querySelector('.battle-review>.button'));
    assert.ok(document.querySelector('.battle-field'));
    await click(document.querySelector('.battle-moves>button'));
    await app.wait(400);
    assert.match(document.querySelector('.battle-page-heading')?.textContent || '', /Turn 2/);
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
    assert.match(
      document.querySelector('.evolution-funding-note')?.textContent || '',
      /0.075 SOL increase is already funded/,
    );
    await click(app.button('Evolve Pokémon'));
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
    assert.equal(app.button('Evolve Pokémon').disabled, true);
    assert.match(document.querySelector('.evolution-unavailable')?.textContent || '', /fund/i);
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(app.saved().pokemon.find((p) => p.id === 'bulbasaur')?.backing, 0.08);
  } finally {
    await app.close();
  }
});

test('coin drafts use an owned Pokémon with a separate uploaded image and validated social links', async () => {
  const app = await mountApp('/create', (state) => {
    state.pokemon.find((p) => p.id === 'gengar')!.listed = 0.4;
  });
  const { document, click, fill } = app;
  const originalImage = globalThis.Image;
  try {
    const choices = [...document.querySelectorAll('.owned-pokemon-selector button')];
    assert.equal(choices.length, app.initial.pokemon.length - 1);
    assert.ok(!choices.some((button) => button.textContent?.includes('Gengar')));
    await click(choices.find((button) => button.textContent?.includes('Eevee'))!);
    await fill('#coin-name', 'Moonstone Club');
    await fill('#coin-ticker', 'MOON');
    await fill('#coin-social-x', 'javascript:alert(1)');
    assert.equal(app.button('Create coin draft').disabled, true);
    assert.equal(document.querySelector('#coin-social-x')?.getAttribute('aria-invalid'), 'true');
    await fill('#coin-social-x', 'https://x.com/moonstone');
    await fill('#coin-social-website', 'https://moonstone.example/');
    // JSDOM has no image decoder. Stub only that browser boundary; FileReader and form state remain real.
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
    assert.equal(app.button('Create coin draft').disabled, false);
    await click(app.button('Create coin draft'));
    const saved = app.saved();
    const coin = saved.coins.find((coin) => coin.ticker === 'MOON')!;
    assert.ok(coin);
    assert.equal(coin.launchKind, 'pokemon');
    assert.equal(coin.launchPokemonId, 'eevee');
    assert.equal(coin.pokemonId, 133);
    assert.ok(coin.image?.startsWith('data:image/png;base64,'));
    assert.deepEqual(coin.socials, {
      website: 'https://moonstone.example/',
      x: 'https://x.com/moonstone',
    });
    assert.equal(
      saved.pokemon.length,
      app.initial.pokemon.length,
      'The launch Pokémon is still owned',
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

test('an empty inventory creates a trainer coin without a Pokémon selection', async () => {
  const app = await mountApp('/create', (state) => {
    state.pokemon = [];
    state.profile.equippedId = null;
  });
  try {
    assert.equal(app.document.querySelector('.owned-pokemon-selector'), null);
    assert.match(
      app.document.querySelector('main')?.textContent || '',
      /coin will launch as your trainer/,
    );
    await app.fill('#coin-name', 'Trainer Club');
    await app.fill('#coin-ticker', 'TRAIN');
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
