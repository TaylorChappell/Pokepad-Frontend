import test from 'node:test';
import assert from 'node:assert/strict';
import { getPortraitLayout, PORTRAIT_HEADS } from '../src/data/portrait-heads';

test('all Gen 1 headshots fit without clipping and use an even pixel grid', () => {
  assert.equal(Object.keys(PORTRAIT_HEADS).length, 151);
  for (let id = 1; id <= 151; id++) {
    for (const shiny of [false, true]) {
      for (const size of [32, 40, 42, 64]) {
        const layout = getPortraitLayout(id, shiny, size);
        const context = `species ${id}, shiny ${shiny}, size ${size}`;
        assert.ok(layout.width > 0 && layout.height > 0, context);
        assert.ok(layout.left >= 0 && layout.top >= 0, context);
        assert.ok(layout.left + layout.width <= size, context);
        assert.ok(layout.top + layout.height <= size, context);
        for (const value of [layout.left, layout.top, layout.width, layout.height]) {
          assert.ok(Number.isInteger(value), context);
        }
        assert.ok(Number.isInteger(Math.log2(layout.scale)), context);
      }
    }
  }
});

test('header headshots use static artwork and preserve the shiny palette', () => {
  assert.equal(getPortraitLayout(4, false, 40).url, 'pixel/4.png');
  assert.equal(getPortraitLayout(4, true, 40).url, 'shiny/4.png');
  assert.deepEqual(getPortraitLayout(999, false, 40), getPortraitLayout(1, false, 40));
});
