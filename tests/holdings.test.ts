import test from 'node:test';
import assert from 'node:assert/strict';
import { holdingStreakLabel } from '../src/services/holdings';

test('a verified balance with unverified history never displays invented holding age', () => {
  assert.equal(
    holdingStreakLabel({ holdingDays: 12, holdingStatus: 'syncing' }),
    'Updating history',
  );
  assert.equal(
    holdingStreakLabel({ holdingDays: 12, holdingStatus: 'unavailable' }),
    'Balance update delayed',
  );
});
test('hold streaks use readable hours and days instead of raw fractional days', () => {
  assert.equal(
    holdingStreakLabel({ holdingDays: 0.001, holdingStatus: 'verified' }),
    'Just started',
  );
  assert.equal(holdingStreakLabel({ holdingDays: 0.05, holdingStatus: 'verified' }), '1 hour');
  assert.equal(holdingStreakLabel({ holdingDays: 0.9 }), '21 hours');
  assert.equal(holdingStreakLabel({ holdingDays: 1.5 }), '1 day');
  assert.equal(holdingStreakLabel({ holdingDays: 12.123456 }), '12 days');
});

test('a backlog has a distinct label without inventing a hold streak', () => {
  assert.equal(
    holdingStreakLabel({ holdingDays: 12, holdingStatus: 'syncing', holdingHistoryDelayed: true }),
    'History catching up',
  );
});
