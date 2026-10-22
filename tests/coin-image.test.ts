import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createRoot } from 'react-dom/client';
import { CoinImagePicker } from '../src/components/CoinImagePicker';
import {
  COIN_IMAGE_LIMIT,
  imageLink,
  readCoinImage,
  transferredImage,
} from '../src/services/coin-image';

const dom = new JSDOM('<div id="root"></div><input id="text">', { url: 'https://kanto.test' });
for (const key of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'DOMParser',
  'File',
  'FileReader',
])
  Object.defineProperty(globalThis, key, { value: (dom.window as any)[key], configurable: true });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const transfer = (values: Record<string, string>, files: File[] = []) =>
  ({
    files,
    items: files.map((file) => ({ kind: 'file', getAsFile: () => file })),
    getData: (key: string) => values[key] || '',
  }) as unknown as DataTransfer;

test('image transfers handle clipboard files, dragged images and original Google image URLs safely', () => {
  const file = new File(['png'], 'coin.png', { type: 'image/png' });
  assert.equal(
    transferredImage(transfer({ 'text/plain': 'https://example.com/ignored.png' }, [file])),
    file,
  );
  const source = 'https://images.example.com/coin.png';
  assert.equal(
    transferredImage(
      transfer({
        'text/html': `<a href="https://www.google.com/imgres?imgurl=${encodeURIComponent(source)}"><img src="https://example.com/thumbnail.png"></a>`,
      }),
    ),
    source,
  );
  assert.equal(
    transferredImage(
      transfer({ 'text/html': '<img src="https://example.com/art.webp" onerror="alert(1)">' }),
    ),
    'https://example.com/art.webp',
  );
  assert.equal(
    transferredImage(transfer({ 'text/uri-list': '# Image\nhttps://example.com/coin.jpg' })),
    'https://example.com/coin.jpg',
  );
  assert.equal(transferredImage(transfer({ 'text/plain': 'some normal description' })), null);
  for (const value of [
    'javascript:alert(1)',
    'data:image/svg+xml,<svg/>',
    'file:///tmp/image.png',
    'https://secret@example.com/coin.png',
  ])
    assert.equal(imageLink(value), null);
});

test('image validation rejects empty, oversized and active files before decoding', async () => {
  await assert.rejects(
    readCoinImage(new File(['<svg/>'], 'coin.svg', { type: 'image/svg+xml' }), true),
    /PNG/,
  );
  await assert.rejects(
    readCoinImage(new File([], 'coin.png', { type: 'image/png' }), true),
    /2 MB/,
  );
  await assert.rejects(
    readCoinImage(
      new File([new Uint8Array(COIN_IMAGE_LIMIT + 1)], 'coin.png', { type: 'image/png' }),
      true,
    ),
    /2 MB/,
  );
  await assert.rejects(
    readCoinImage(new File(['gif'], 'coin.gif', { type: 'image/gif' }), true),
    /PNG/,
  );
});

test('picker preserves text pasting and previous artwork after an invalid drop; removal clears it', async () => {
  const root = createRoot(document.getElementById('root')!);
  const changes: string[] = [],
    busy: boolean[] = [];
  const existing = 'data:image/png;base64,previous';
  await act(async () =>
    root.render(
      React.createElement(CoinImagePicker, {
        value: existing,
        onChange: (s: string) => changes.push(s),
        onBusyChange: (b: boolean) => busy.push(b),
        live: true,
      }),
    ),
  );
  const paste = new dom.window.Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(paste, 'clipboardData', {
    value: transfer({ 'text/plain': 'https://example.com/my-website' }),
  });
  document.getElementById('text')!.dispatchEvent(paste);
  assert.equal(paste.defaultPrevented, false);
  const drop = new dom.window.Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(drop, 'dataTransfer', {
    value: transfer({}, [new File(['svg'], 'bad.svg', { type: 'image/svg+xml' })]),
  });
  await act(async () => {
    document.querySelector('.coin-image-dropzone')!.dispatchEvent(drop);
  });
  assert.equal(drop.defaultPrevented, true);
  assert.match(document.querySelector('[role="alert"]')!.textContent!, /PNG/);
  assert.equal(document.querySelector('img')!.getAttribute('src'), existing);
  assert.deepEqual(changes, []);
  assert.deepEqual(busy, [true, false]);
  await act(async () => {
    (document.querySelector('.image-remove') as HTMLButtonElement).click();
  });
  assert.deepEqual(changes, ['']);
  await act(async () => root.unmount());
  dom.window.close();
});
