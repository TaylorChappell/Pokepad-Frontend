import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { watchPageReadiness } from '../src/components/Loading';

const wait = (ms = 240) => new Promise((resolve) => setTimeout(resolve, ms));
test('boot waits for images, decoding, fonts and route data; later images use skeleton states', async () => {
  const dom = new JSDOM(
    '<body><div id="boot-screen"></div><main><img src="/partner.png"><section aria-busy="true"></section></main></body>',
    { url: 'https://kanto.test', pretendToBeVisual: true },
  );
  for (const key of ['window', 'document', 'HTMLElement', 'MutationObserver', 'Image'])
    Object.defineProperty(globalThis, key, {
      value: (dom.window as unknown as Record<string, unknown>)[key],
      configurable: true,
      writable: true,
    });
  Object.assign(globalThis, {
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  });
  dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 80,
    right: 80,
    width: 80,
    height: 80,
    toJSON() {
      return this;
    },
  });
  let fontsReady!: () => void, decoded!: () => void;
  Object.defineProperty(dom.window.document, 'fonts', {
    value: { ready: new Promise<void>((r) => (fontsReady = r)) },
  });
  const img = dom.window.document.querySelector('img')!;
  Object.defineProperty(img, 'complete', { value: false });
  Object.defineProperty(img, 'naturalWidth', { value: 80 });
  img.decode = () => new Promise<void>((r) => (decoded = r));
  let completions = 0;
  const cleanup = watchPageReadiness(dom.window.document.body, () => {
    completions++;
    dom.window.document.getElementById('boot-screen')!.remove();
  });
  try {
    await wait();
    assert.equal(completions, 0);
    assert.equal(img.dataset.mediaState, 'loading');
    img.dispatchEvent(new dom.window.Event('load'));
    await wait();
    assert.equal(completions, 0, 'Load event alone is not decoded artwork');
    decoded();
    await wait();
    assert.equal(img.dataset.mediaState, 'ready');
    assert.equal(completions, 0, 'Fonts and route data still pending');
    fontsReady();
    await wait();
    assert.equal(completions, 0, 'Route still loading');
    dom.window.document.querySelector('section')!.removeAttribute('aria-busy');
    await wait();
    assert.equal(completions, 1);
    const later = dom.window.document.createElement('img');
    later.src = '/new-route.png';
    Object.defineProperty(later, 'complete', { value: false });
    Object.defineProperty(later, 'naturalWidth', { value: 80 });
    later.decode = async () => {};
    dom.window.document.querySelector('main')!.append(later);
    await wait();
    assert.equal(later.dataset.mediaState, 'loading');
    assert.equal(dom.window.document.getElementById('boot-screen'), null);
    later.dispatchEvent(new dom.window.Event('load'));
    await wait();
    assert.equal(later.dataset.mediaState, 'ready');
    assert.equal(completions, 1, 'Navigation never restarts boot');
  } finally {
    cleanup();
    dom.window.close();
  }
});
