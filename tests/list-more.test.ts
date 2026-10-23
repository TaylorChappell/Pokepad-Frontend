import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { ListMore, useListWindow } from '../src/components/ListMore';

test('lists expand in batches, keep live additions bounded and reset when filters change', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  for (const key of ['window', 'document', 'navigator', 'HTMLElement'])
    Object.defineProperty(globalThis, key, {
      value: (dom.window as any)[key],
      configurable: true,
      writable: true,
    });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root')!);
  function Example({ filter, count = 30 }: { filter: string; count?: number }) {
    const page = useListWindow(
      Array.from({ length: count }, (_, i) => i),
      filter,
      12,
    );
    return React.createElement(
      'section',
      {},
      page.items.map((i) => React.createElement('p', { key: i }, i)),
      React.createElement(ListMore, page),
    );
  }
  try {
    const render = async (filter: string, count = 30) =>
      act(async () => root.render(React.createElement(Example, { filter, count })));
    await render('all');
    assert.equal(document.querySelectorAll('p').length, 12);
    await act(async () => document.querySelector('button')!.click());
    assert.equal(document.querySelectorAll('p').length, 24);
    await render('all', 31);
    assert.equal(document.querySelectorAll('p').length, 24);
    await render('eggs');
    assert.equal(document.querySelectorAll('p').length, 12);
    await render('all');
    assert.equal(document.querySelectorAll('p').length, 12);
    await render('small', 2);
    assert.equal(document.querySelector('button'), null);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
