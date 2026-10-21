import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act, useState } from 'react';
import { JSDOM } from 'jsdom';
import { lockPageScroll } from '../src/components/overlay-scroll-lock';
import { TRAINER_HEAD_BOUNDS, trainerPortraitGeometry } from '../src/components/trainer-portrait';

function browser(stableGutter = false) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://example.test/kanto/',
    pretendToBeVisual: true,
  });
  Object.defineProperty(dom.window, 'innerWidth', { value: 1200 });
  Object.defineProperty(dom.window.document.documentElement, 'clientWidth', { value: 1183 });
  Object.defineProperty(dom.window, 'CSS', {
    value: { supports: () => stableGutter },
  });
  dom.window.matchMedia = (() => ({ matches: true })) as typeof dom.window.matchMedia;
  return dom;
}

test('classic-scrollbar overlays preserve page width, nested locks and original styles', () => {
  const dom = browser();
  const document = dom.window.document;
  const root = document.documentElement;
  root.style.setProperty('overflow', 'auto', 'important');
  root.style.paddingRight = '3px';
  document.body.style.overflow = 'scroll';
  const releaseSearch = lockPageScroll(document);
  assert.equal(root.style.paddingRight, '20px');
  assert.equal(root.style.getPropertyValue('--overlay-scrollbar-gap'), '17px');
  assert.equal(root.style.overflow, 'hidden');

  const releaseDialog = lockPageScroll(document);
  assert.equal(root.style.paddingRight, '20px', 'a second overlay must not double compensation');
  releaseSearch();
  releaseSearch();
  assert.equal(root.style.overflow, 'hidden', 'only the final distinct release unlocks scrolling');
  releaseDialog();
  assert.equal(root.style.paddingRight, '3px');
  assert.equal(root.style.getPropertyValue('--overlay-scrollbar-gap'), '');
  assert.equal(root.style.overflow, 'auto');
  assert.equal(root.style.getPropertyPriority('overflow'), 'important');
  assert.equal(document.body.style.overflow, 'scroll');
  dom.window.close();
});

test('native stable gutters never receive a second scrollbar-width padding', () => {
  const dom = browser(true);
  const root = dom.window.document.documentElement;
  root.style.paddingRight = '3px';
  const release = lockPageScroll(dom.window.document);
  assert.equal(root.style.getPropertyValue('scrollbar-gutter'), 'stable');
  assert.equal(root.style.paddingRight, '3px');
  assert.equal(root.style.getPropertyValue('--overlay-scrollbar-gap'), '');
  release();
  assert.equal(root.style.getPropertyValue('scrollbar-gutter'), '');
  assert.equal(root.style.overflow, '');
  dom.window.close();
});

function exposeBrowser(dom: JSDOM) {
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement']) {
    Object.defineProperty(globalThis, name, {
      value: (dom.window as unknown as Record<string, unknown>)[name],
      configurable: true,
      writable: true,
    });
  }
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
}

test('search closes with Escape, restores the trigger and never scrolls when focusing', async () => {
  const dom = browser();
  exposeBrowser(dom);
  const { SearchDialog } = await import('../src/components/SearchDialog');
  const { createRoot } = await import('react-dom/client');
  const document = dom.window.document;
  const rootElement = document.getElementById('root')!;
  const root = createRoot(rootElement);
  const focusOptions: (FocusOptions | undefined)[] = [];
  const nativeFocus = dom.window.HTMLElement.prototype.focus;
  dom.window.HTMLElement.prototype.focus = function (options) {
    focusOptions.push(options);
    nativeFocus.call(this, options);
  };
  function SearchHarness() {
    const [open, setOpen] = useState(false);
    return React.createElement(
      React.Fragment,
      null,
      React.createElement('button', { onClick: () => setOpen(true) }, 'Search'),
      open && React.createElement(SearchDialog, { coins: [], onClose: () => setOpen(false) }),
    );
  }
  try {
    await act(async () => root.render(React.createElement(SearchHarness)));
    const trigger = rootElement.querySelector('button')!;
    trigger.focus();
    focusOptions.length = 0;
    document.documentElement.scrollTop = 450;
    await act(async () => trigger.click());
    assert.equal(document.activeElement?.tagName, 'INPUT');
    assert.equal(rootElement.hasAttribute('inert'), true);
    assert.match(document.body.textContent || '', /Search Kanto/);
    assert.equal(document.documentElement.style.paddingRight, '17px');
    await act(async () => {
      document.dispatchEvent(
        new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(rootElement.hasAttribute('inert'), false);
    assert.equal(document.activeElement, trigger);
    assert.equal(document.documentElement.style.paddingRight, '');
    assert.equal(document.documentElement.scrollTop, 450);
    assert.deepEqual(focusOptions, [{ preventScroll: true }, { preventScroll: true }]);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});

test('unlocking modal animation controls does not relock the page or steal button focus', async () => {
  const dom = browser();
  exposeBrowser(dom);
  const { Modal } = await import('../src/components/UI');
  const { createRoot } = await import('react-dom/client');
  const document = dom.window.document;
  const root = createRoot(document.getElementById('root')!);
  let setBusy: React.Dispatch<React.SetStateAction<boolean>>;
  let closed = 0;
  function ModalHarness() {
    const [busy, updateBusy] = useState(true);
    setBusy = updateBusy;
    return React.createElement(Modal, {
      title: 'Hatching',
      closeDisabled: busy,
      onClose: () => closed++,
      children: React.createElement('button', { id: 'inside' }, 'Inspect'),
    });
  }
  try {
    await act(async () => root.render(React.createElement(ModalHarness)));
    const button = document.getElementById('inside')!;
    button.focus();
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
    assert.equal(closed, 0);
    await act(async () => setBusy(false));
    assert.equal(document.activeElement, button);
    assert.equal(document.documentElement.style.paddingRight, '17px');
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
    assert.equal(closed, 1);
  } finally {
    await act(async () => root.unmount());
    assert.equal(document.documentElement.style.paddingRight, '');
    dom.window.close();
  }
});

test('trainer heads fit every portrait size at whole source-pixel scales', () => {
  for (const character of Object.keys(
    TRAINER_HEAD_BOUNDS,
  ) as (keyof typeof TRAINER_HEAD_BOUNDS)[]) {
    for (const size of [36, 42, 44, 46, 58, 76, 116, 132]) {
      const bounds = TRAINER_HEAD_BOUNDS[character];
      const geometry = trainerPortraitGeometry(character, size);
      const left = geometry.left + bounds.left * geometry.scale;
      const right = geometry.left + bounds.right * geometry.scale;
      const top = geometry.top + bounds.top * geometry.scale;
      const bottom = top + bounds.headHeight * geometry.scale;
      assert.ok(Number.isInteger(geometry.scale));
      assert.ok(Number.isInteger(geometry.left) && Number.isInteger(geometry.top));
      assert.ok(left >= geometry.scale, `${character} ${size}: left hair inset`);
      assert.ok(right <= size - 2 - geometry.scale, `${character} ${size}: right hair inset`);
      assert.ok(top >= 2 && bottom <= size - 2, `${character} ${size}: whole head visible`);
    }
  }
  assert.equal(trainerPortraitGeometry('leaf', 58).scale, 2, 'header Leaf stays crisp at 2×');
  assert.equal(trainerPortraitGeometry('leaf', 132).scale, 4, 'editor Leaf leaves room for hair');
});
