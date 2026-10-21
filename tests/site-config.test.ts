import test from 'node:test';
import assert from 'node:assert/strict';
import bs58 from 'bs58';
import { mainCoinPumpUrl, officialXUrl, legalContactEmail } from '../src/site-config';

const mint = bs58.encode(Uint8Array.from({ length: 32 }, (_, index) => index + 1));
test('footer uses only a configured or live main mint, never a demo or arbitrary URL', () => {
  const coins = [{ main: true, ca: mint }];
  assert.equal(mainCoinPumpUrl(coins, 'demo', ''), null);
  assert.equal(mainCoinPumpUrl(coins, 'live', ''), 'https://pump.fun/coin/' + mint);
  assert.equal(mainCoinPumpUrl([], 'demo', mint), 'https://pump.fun/coin/' + mint);
  for (const bad of [
    'PokePad1111111111111111111111111111111111111',
    'https://example.com',
    '11111111111111111111111111111111',
    'invalid',
  ]) {
    assert.equal(mainCoinPumpUrl([{ main: true, ca: bad }], 'live', ''), null);
    assert.equal(mainCoinPumpUrl([], 'demo', bad), null);
  }
  assert.equal(mainCoinPumpUrl([{ main: false, ca: mint }], 'live', ''), null);
});
test('public contact configuration cannot turn footer links into arbitrary schemes or hosts', () => {
  assert.equal(officialXUrl('https://x.com/kanto_example'), 'https://x.com/kanto_example');
  for (const bad of [
    '',
    'javascript:alert(1)',
    'https://x.com.example.com',
    'https://example.com',
    'http://x.com',
    'https://user:pass@x.com',
  ])
    assert.equal(officialXUrl(bad), null);
  assert.equal(legalContactEmail('support@example.com'), 'support@example.com');
  assert.equal(legalContactEmail('hello@example.com?subject=injected'), null);
  assert.equal(legalContactEmail(''), null);
});
