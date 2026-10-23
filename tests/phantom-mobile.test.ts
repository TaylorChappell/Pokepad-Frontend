import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { getWallets } from '@wallet-standard/app';
import {
  isMobileBrowser,
  phantomBrowseUrl,
  phantomMobileLink,
} from '../src/services/phantom-mobile';

test('Phantom handoff preserves the current page and safely encodes its route', () => {
  const page = 'https://kantocurve.fun/#/battles?room=test&invite=a%26b';
  const link = new URL(phantomBrowseUrl(page)!);
  assert.equal(link.origin, 'https://phantom.com');
  assert.equal(decodeURIComponent(link.pathname.slice('/ul/browse/'.length)), page);
  assert.equal(link.searchParams.get('ref'), 'https://kantocurve.fun');
  assert.equal(phantomBrowseUrl('javascript:alert(1)'), null);
});

test('mobile handoff supports phones and desktop-mode iPads without redirecting desktop browsers', () => {
  for (const userAgent of ['Mozilla iPhone', 'Mozilla iPad', 'Mozilla Android'])
    assert.equal(isMobileBrowser({ userAgent, maxTouchPoints: 1 }), true);
  assert.equal(isMobileBrowser({ userAgent: 'Mozilla Macintosh', maxTouchPoints: 5 }), true);
  assert.equal(isMobileBrowser({ userAgent: 'Mozilla Macintosh', maxTouchPoints: 0 }), false);
  assert.equal(isMobileBrowser({ userAgent: 'Mozilla Windows NT', maxTouchPoints: 10 }), false);
});

test('Phantom in-app browser never redirects back into itself', () => {
  getWallets(); // Initialize the registry before installing the DOM test window.
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const dom = new JSDOM('', { url: 'https://kantocurve.fun/#/rewards' });
  const mobile = dom.window as typeof dom.window & { phantom: { solana: { isPhantom: boolean } } };
  Object.defineProperty(mobile.navigator, 'userAgent', { value: 'Mozilla iPhone' });
  mobile.phantom = { solana: { isPhantom: true } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: mobile });
  try {
    assert.equal(phantomMobileLink(), null);
    mobile.phantom.solana.isPhantom = false;
    assert.match(phantomMobileLink()!, /^https:\/\/phantom.com\/ul\/browse\//);
  } finally {
    dom.window.close();
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
