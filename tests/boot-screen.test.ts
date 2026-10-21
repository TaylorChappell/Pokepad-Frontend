import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { dismissBootScreen } from '../src/components/BootScreen';

test('startup shell provides load-failure help and releases the app when it is ready', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document });
  const document = dom.window.document;
  try {
    assert.match(
      document.querySelector('#boot-screen .boot-emblem')?.getAttribute('src') || '',
      /kanto-emblem\.png$/,
    );
    assert.ok(document.getElementById('root')?.hasAttribute('inert'));
    (dom.window as unknown as { __pokepadBootError: () => void }).__pokepadBootError();
    assert.match(document.getElementById('boot-status')?.textContent || '', /could not load/);
    assert.ok(document.getElementById('boot-screen')?.classList.contains('is-stalled'));

    document.documentElement.dataset.motion = 'reduced';
    dismissBootScreen({ immediate: true });
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(document.getElementById('boot-screen'), null);
    assert.equal(document.getElementById('root')?.hasAttribute('inert'), false);
    assert.equal(document.getElementById('root')?.hasAttribute('aria-hidden'), false);
    assert.equal(document.body.classList.contains('is-booting'), false);

    dismissBootScreen();
    assert.equal(
      document.getElementById('boot-screen'),
      null,
      'later state changes never restart startup',
    );
  } finally {
    dom.window.close();
  }
});
