import assert from 'node:assert/strict';
import test from 'node:test';
import { COINS } from '../src/data/demo';
import { marketCapHistory, marketCapLabel } from '../src/data/market-chart';

const coin = { ...COINS.find((item) => item.id === 'char')!, marketCapUsd: 6300000 };

test('connected market never fabricates a chart when price samples are missing', () => {
  assert.equal(marketCapHistory(coin, false), null);
  assert.equal(marketCapHistory({ ...coin, id: 'new-coin' }, true), null);
});

test('recorded token prices are multiplied by supply, not displayed as token price', () => {
  const history = marketCapHistory({ ...coin, priceHistory: [0.00002, 0.00003, 0.000042] }, false)!;
  assert.equal(history.source, 'recorded');
  assert.equal(history.currency, 'USD');
  assert.deepEqual(history.values, [3000000, 4500000, 6300000]);
});

test('USD market cap uses only an explicit quote and labels that conversion', () => {
  const history = marketCapHistory(
    { ...coin, marketCapUsd: 6300000, priceHistory: [0.00002, 0.000042] },
    false,
  )!;
  assert.equal(history.currency, 'USD');
  assert.deepEqual(history.values, [3000000, 6300000]);
  assert.match(marketCapLabel(6300000), /^\$/);
  assert.equal(marketCapLabel(undefined), '—');
  assert.equal(marketCapLabel(NaN), '—');
  assert.equal(marketCapLabel(0), '$0');
});

test('corrupt or insufficient recorded data cannot turn into plausible chart data', () => {
  for (const priceHistory of [[1], [1, NaN], [-1, 1], [1, Infinity]]) {
    assert.equal(marketCapHistory({ ...coin, priceHistory }, true), null);
  }
  assert.equal(marketCapHistory({ ...coin, totalSupply: 0, priceHistory: [1, 2] }, false), null);
  assert.equal(
    marketCapHistory({ ...coin, totalSupply: Infinity, priceHistory: [1, 2] }, false),
    null,
  );
});

test('demo chart is deterministic, explicitly marked, and ends at the demo market cap', () => {
  const history = marketCapHistory(coin, true)!;
  assert.equal(history.source, 'demo');
  assert.equal(history.values.length, 96);
  assert.equal(history.values.at(-1), coin.marketCapUsd);
  assert.deepEqual(marketCapHistory(coin, true), history);
});

test('missing USD quotes never display SOL market caps or fabricate dollar history', () => {
  const unquoted = { ...coin, marketCapUsd: undefined, priceHistory: [0.00002, 0.000042] };
  assert.equal(marketCapHistory(unquoted, false), null);
  assert.equal(marketCapHistory(unquoted, true), null);
  assert.equal(marketCapLabel(unquoted.marketCapUsd), '—');
});

test('recorded market-cap samples convert directly without multiplying token supply twice', () => {
  const history = marketCapHistory(
    {
      ...coin,
      marketCap: 40,
      marketCapUsd: 4144,
      solUsd: 103.6,
      marketCapHistory: [30, 40],
      totalSupply: 1000000000,
      priceHistory: [0.00000003, 0.00000004],
    },
    false,
  )!;
  assert.deepEqual(history.values, [3108, 4144]);
  assert.equal(history.currency, 'USD');
});

test('an explicit quote supports zero current market caps without inventing a conversion rate', () => {
  const history = marketCapHistory(
    { ...coin, marketCap: 0, marketCapUsd: 0, solUsd: 103.6, marketCapHistory: [10, 0] },
    false,
  )!;
  assert.deepEqual(history.values, [1036, 0]);
});
