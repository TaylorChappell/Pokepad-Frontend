import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { installClientNavigation, navigate } from '../src/services/navigation';

test('internal tabs use history, preserve the document, and support back without page navigation', async () => {
  const dom = new JSDOM(
    '<main id="same"><a href="#/pokedex"><span>Pokédex</span></a><a id="external" href="https://phantom.com">Phantom</a></main>',
    { url: 'https://kanto.test/#/discover' },
  );
  for (const key of ['window', 'document', 'Element'])
    Object.defineProperty(globalThis, key, { value: (dom.window as any)[key], configurable: true });
  const stop = installClientNavigation();
  let changes = 0;
  dom.window.addEventListener('hashchange', () => changes++);
  const original = dom.window.document.querySelector('main');
  try {
    const tap = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    dom.window.document.querySelector('span')!.dispatchEvent(tap);
    assert.equal(tap.defaultPrevented, true, 'native WebView link navigation is prevented');
    assert.equal(dom.window.location.hash, '#/pokedex');
    assert.equal(changes, 1);
    assert.equal(dom.window.document.querySelector('main'), original);
    navigate('/walk');
    assert.equal(dom.window.location.hash, '#/walk');
    dom.window.history.back();
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(dom.window.location.hash, '#/pokedex');
    let handled: boolean | undefined;
    dom.window.document.addEventListener(
      'click',
      (event) => {
        handled = event.defaultPrevented;
        event.preventDefault();
      },
      { once: true },
    );
    dom.window.document
      .querySelector('#external')!
      .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(handled, false, 'external approvals are left to the browser');
    const historySize = dom.window.history.length;
    navigate('/pokemon', true);
    assert.equal(dom.window.history.length, historySize);
  } finally {
    stop();
    dom.window.close();
  }
});
