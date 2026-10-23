import test from 'node:test';
import assert from 'node:assert/strict';
import { isMobileBrowser } from '../src/services/phantom-mobile';

test('mobile approval supports phones and desktop-mode iPads without redirecting desktop browsers', () => {
  for (const userAgent of ['Mozilla iPhone', 'Mozilla iPad', 'Mozilla Android'])
    assert.equal(isMobileBrowser({ userAgent, maxTouchPoints: 1 }), true);
  assert.equal(isMobileBrowser({ userAgent: 'Mozilla Macintosh', maxTouchPoints: 5 }), true);
  assert.equal(isMobileBrowser({ userAgent: 'Mozilla Macintosh', maxTouchPoints: 0 }), false);
  assert.equal(isMobileBrowser({ userAgent: 'Mozilla Windows NT', maxTouchPoints: 10 }), false);
});
