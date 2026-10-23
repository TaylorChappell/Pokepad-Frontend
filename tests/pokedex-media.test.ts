import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { PokemonArt } from '../src/components/UI';

test('offscreen catalogue sprites wait for visibility and nearby sprites use static artwork', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://kanto.test' });
  for (const key of ['window', 'document', 'HTMLElement', 'navigator'])
    Object.defineProperty(globalThis, key, { value: (dom.window as any)[key], configurable: true });
  const observers: { callback: Function; disconnected: boolean }[] = [];
  class Observer {
    entry: { callback: Function; disconnected: boolean };
    constructor(callback: Function) {
      this.entry = { callback, disconnected: false };
      observers.push(this.entry);
    }
    observe() {}
    disconnect() {
      this.entry.disconnected = true;
    }
  }
  Object.assign(globalThis, { IntersectionObserver: Observer, IS_REACT_ACT_ENVIRONMENT: true });
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    await act(async () =>
      root.render(
        React.createElement(
          React.Fragment,
          null,
          ...[1, 25, 151].map((id) =>
            React.createElement(PokemonArt, { key: id, id, defer: true, animated: false }),
          ),
        ),
      ),
    );
    assert.equal(
      dom.window.document.querySelectorAll('[style*="background-image"], img').length,
      0,
    );
    await act(async () => observers[0].callback([{ isIntersecting: true }]));
    const artwork = dom.window.document.querySelectorAll('[style*="background-image"], img');
    assert.equal(artwork.length, 1);
    assert.equal(dom.window.document.querySelectorAll('.sprite-pixels-moving').length, 0);
    await act(async () => root.unmount());
    assert.equal(
      observers.every((entry) => entry.disconnected),
      true,
    );
  } finally {
    dom.window.close();
    Reflect.deleteProperty(globalThis, 'IntersectionObserver');
  }
});
