import assert from 'node:assert/strict';
import test from 'node:test';
import { COINS } from '../src/data/demo';
import { marketCapHistory, marketCapLabel } from '../src/data/market-chart';

const coin = { ...COINS.find((item) => item.id === 'char')!, marketCapUsd: undefined };

test('connected market never fabricates a chart when price samples are missing', () => {
  assert.equal(marketCapHistory(coin, false), null);
  assert.equal(marketCapHistory({ ...coin, id: 'new-coin' }, true), null);
});

test('recorded token prices are multiplied by supply, not displayed as token price', () => {
  const history = marketCapHistory({ ...coin, priceHistory: [0.00002, 0.00003, 0.000042] }, false)!;
  assert.equal(history.source, 'recorded');
  assert.equal(history.currency, 'SOL');
  assert.deepEqual(history.values, [20000, 30000, 42000]);
});

test('USD market cap uses only an explicit quote and labels that conversion', () => {
  const history = marketCapHistory(
    { ...coin, marketCapUsd: 6300000, priceHistory: [0.00002, 0.000042] },
    false,
  )!;
  assert.equal(history.currency, 'USD');
  assert.deepEqual(history.values, [3000000, 6300000]);
  assert.match(marketCapLabel(6300000, 'USD'), /^\$/);
  assert.match(marketCapLabel(42000, 'SOL'), / SOL$/);
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
  assert.equal(history.values.at(-1), coin.marketCap);
  assert.deepEqual(marketCapHistory(coin, true), history);
});
