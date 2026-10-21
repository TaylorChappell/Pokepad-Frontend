import test from 'node:test';
import assert from 'node:assert/strict';
import { COINS } from '../src/data/demo';
import { coinForBadge } from '../src/components/GymBadge';

test('legacy gym badges retain their coin identity when newer tickers collide', () => {
  for (const [badge, expected] of [
    ['Ember', 'char'],
    ['Journey', 'poke'],
    ['POKE', 'poke'],
    ['char', 'char'],
  ]) {
    const custom = {
      ...COINS[0],
      id: 'new-community',
      ticker: badge,
      image: 'data:image/png;base64,custom',
    };
    assert.equal(coinForBadge([custom, ...COINS], badge)?.id, expected);
  }
  const custom = {
    ...COINS[0],
    id: 'custom-community',
    ticker: 'New badge',
    image: 'custom-logo.png',
  };
  assert.equal(coinForBadge([custom, ...COINS], 'custom-community')?.image, 'custom-logo.png');
  assert.equal(coinForBadge([custom, ...COINS], 'New badge')?.id, 'custom-community');
  assert.equal(coinForBadge([custom, { ...custom, id: 'duplicate' }], 'New badge'), undefined);
});
