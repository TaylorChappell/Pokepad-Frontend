import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import {
  BattleTeamPicker,
  battleAvailability,
  battleSelection,
  rememberBattleTeam,
} from '../src/components/BattleTeamPicker';
import { createInitialState } from '../src/data/demo';
import { pokemonById } from '../src/data/pokemon';

test('battle selection removes duplicates, locked and fainted members and enforces the reviewed team size', () => {
  const pokemon = createInitialState()
    .pokemon.slice(0, 5)
    .map((item) => ({
      ...item,
      starter: false,
      locked: false,
      health: undefined as number | undefined,
    }));
  pokemon[1].locked = true;
  pokemon[2].health = 0;
  pokemon[3].starter = true;
  assert.equal(battleAvailability(pokemon[1], false), 'Busy');
  assert.equal(battleAvailability(pokemon[2], false), 'Needs a Revive');
  assert.match(battleAvailability(pokemon[3], true)!, /Starter/);
  assert.deepEqual(
    battleSelection(
      pokemon,
      [pokemon[0].id, pokemon[0].id, pokemon[1].id, pokemon[2].id, pokemon[3].id, pokemon[4].id],
      true,
    ),
    [pokemon[0].id, pokemon[4].id],
  );
  assert.deepEqual(battleSelection(pokemon, [pokemon[0].id, pokemon[4].id], false, 1), [
    pokemon[0].id,
  ]);
});
test('the party picker puts favourites first, keeps slots in sync, opens slots, supports PC sorting and previews previous teams', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test' });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Image: dom.window.Image,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const root = createRoot(document.getElementById('root')!);
  const pokemon = createInitialState()
    .pokemon.slice(0, 6)
    .map((item) => ({ ...item, health: undefined, locked: false, favourite: false }));
  pokemon[5].favourite = true;
  let selected: string[] = [];
  function Probe() {
    const [ids, setIds] = useState<string[]>([]);
    selected = ids;
    return React.createElement(BattleTeamPicker, {
      pokemon,
      selected: ids,
      onChange: setIds,
      teamSize: 2,
    });
  }
  try {
    await act(async () => root.render(React.createElement(Probe)));
    rememberBattleTeam('demo', [pokemon[0], pokemon[1]]);
    assert.equal(document.querySelectorAll('.battle-party-slot').length, 3);
    assert.equal(
      document.querySelector('.battle-picker-pokemon'),
      null,
      'PC stays closed until a slot is chosen',
    );
    await act(async () =>
      (
        document.querySelector('[aria-label="Choose Pokémon for slot 1"]') as HTMLButtonElement
      ).click(),
    );
    const first = document.querySelector('.battle-picker-pokemon') as HTMLButtonElement;
    assert.match(
      first.getAttribute('aria-label')!,
      new RegExp(pokemonById(pokemon[5].speciesId).name),
    );
    await act(async () => first.click());
    assert.deepEqual(selected, [pokemon[5].id]);
    assert.equal(document.querySelectorAll('.battle-party-slot.filled').length, 1);
    assert.equal(document.querySelectorAll('.previous-party-preview .pokemon-art').length, 2);
    await act(async () =>
      (document.querySelector('.battle-party-slot.filled') as HTMLButtonElement).click(),
    );
    assert.deepEqual(selected, [pokemon[5].id], 'Opening a filled slot does not remove its member');
    assert.equal(document.querySelectorAll('[aria-label="Sort Pokémon"] option').length, 6);
    const select = document.querySelector('[aria-label="Filter Pokémon"]') as HTMLSelectElement;
    await act(async () => {
      select.value = 'Favourites';
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
    assert.equal(document.querySelectorAll('.battle-picker-pokemon').length, 1);
    await act(async () =>
      (document.querySelector('.modal-actions>button') as HTMLButtonElement).click(),
    );
    assert.equal(document.querySelector('.party-picker-modal'), null);
    assert.equal(
      (document.querySelector('[aria-label="Choose Pokémon for slot 3"]') as HTMLButtonElement)
        .disabled,
      true,
    );
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});

test('PC party tabs swap selected members without duplication and clear only the chosen slot', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test' });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Image: dom.window.Image,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const root = createRoot(document.getElementById('root')!);
  const pokemon = createInitialState()
    .pokemon.slice(0, 4)
    .map((p) => ({ ...p, health: undefined, locked: false }));
  let selected: string[] = [];
  function Probe() {
    const [ids, setIds] = useState([pokemon[0].id, pokemon[1].id, pokemon[2].id]);
    selected = ids;
    return React.createElement(BattleTeamPicker, { pokemon, selected: ids, onChange: setIds });
  }
  const click = async (element: Element | null) => {
    assert.ok(element);
    await act(async () => (element as HTMLButtonElement).click());
  };
  try {
    await act(async () => root.render(React.createElement(Probe)));
    await click(document.querySelector('[aria-label="Choose Pokémon for slot 1"]'));
    assert.equal(document.querySelectorAll('.pc-party-targets > button').length, 3);
    await click(document.querySelectorAll('.pc-party-targets > button')[2]);
    assert.equal(
      document.querySelectorAll('.pc-party-targets > button')[2].getAttribute('aria-pressed'),
      'true',
    );
    await click(
      [...document.querySelectorAll('.battle-picker-pokemon')].find(
        (button) =>
          button.getAttribute('aria-label') === 'Choose ' + pokemonById(pokemon[0].speciesId).name,
      )!,
    );
    assert.deepEqual(selected, [pokemon[2].id, pokemon[1].id, pokemon[0].id]);
    assert.equal(document.querySelector('.party-picker-modal'), null);
    assert.equal(document.querySelectorAll('.battle-party-slot.filled .party-hp').length, 3);
    await click(document.querySelector('[aria-label="Choose Pokémon for slot 2"]'));
    await click(
      [...document.querySelectorAll('.modal-actions button')].find(
        (button) => button.textContent === 'Clear this slot',
      )!,
    );
    assert.deepEqual(selected, [pokemon[2].id, pokemon[0].id]);
    assert.equal(document.querySelectorAll('.battle-party-slot.filled').length, 2);
    await click(
      [...document.querySelectorAll('button')].find(
        (button) => button.textContent === 'Clear team',
      )!,
    );
    assert.deepEqual(selected, []);
    assert.equal(document.querySelectorAll('.battle-party-slot.filled').length, 0);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
