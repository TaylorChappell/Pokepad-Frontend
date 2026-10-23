import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadPlatformAnalytics,
  mergeAnalyticsEvents,
  parsePlatformAnalytics,
} from '../src/services/analytics';

const event = {
  id: 'reward-123',
  kind: 'egg',
  trainer: 'Leaf',
  trainerWallet: 'trainer-wallet',
  avatar: { character: 'leaf', accessoryColor: '#65b883' },
  title: 'Hatched Lapras',
  detail: 'From $SQUIRT',
  createdAt: 1700000000000,
  pokemonId: 131,
  shiny: true,
  href: '/pokemon/lapras-123',
};
const response = () => ({
  metrics: { totalRewardsSol: 12.5, platformTradingVolumeSol: 17250, activeUsers24h: 91 },
  updatedAt: 1700000005000,
  events: [event],
});

test('platform totals come from the analytics ledger response and preserve SOL precision', () => {
  const result = parsePlatformAnalytics(response());
  assert.deepEqual(result.metrics, response().metrics);
  assert.equal(result.events[0].shiny, true);
  assert.equal(result.events[0].trainerWallet, 'trainer-wallet');
  assert.equal(result.updatedAt, 1700000005000);
  for (const invalid of [-1, Infinity, NaN, '100']) {
    assert.throws(() =>
      parsePlatformAnalytics({
        ...response(),
        metrics: { ...response().metrics, totalRewardsSol: invalid },
      }),
    );
  }
  assert.throws(() =>
    parsePlatformAnalytics({
      ...response(),
      metrics: { ...response().metrics, activeUsers24h: 1.5 },
    }),
  );
  assert.throws(() => parsePlatformAnalytics({ metrics: response().metrics }));
});

test('malformed and retired marketplace events cannot poison the community feed', () => {
  const result = parsePlatformAnalytics({
    ...response(),
    events: [
      event,
      { ...event, id: 'market', kind: 'market' },
      { ...event, id: 'invalid-date', createdAt: Infinity },
      { ...event, id: 'missing-title', title: null },
      { ...event, id: 'external', href: 'https://example.com', avatar: {}, pokemonId: 1000 },
      { ...event, id: 'redeem', kind: 'redeem', href: '/activity' },
    ],
  });
  assert.deepEqual(
    result.events.map((item) => item.id),
    ['reward-123', 'external', 'redeem'],
  );
  assert.equal(result.events[1].href, '/activity');
  assert.equal(result.events[1].pokemonId, undefined);
  assert.equal(result.events[1].avatar.character, 'red');
});

test('server events merge with immediate account events once, in newest-first order', () => {
  const serverEvent = parsePlatformAnalytics(response()).events[0];
  const events = mergeAnalyticsEvents(
    [serverEvent],
    [
      { ...serverEvent, title: 'Pending local title' },
      { ...serverEvent, id: 'new-local', createdAt: serverEvent.createdAt + 1 },
    ],
  );
  assert.deepEqual(
    events.map((item) => item.id),
    ['new-local', serverEvent.id],
  );
  assert.equal(events[1].title, 'Hatched Lapras');
});

test('analytics requests the configured backend with credentials and no cached totals', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.example/v1/analytics');
    assert.equal(options?.credentials, 'include');
    assert.equal(options?.cache, 'no-store');
    assert.ok(options?.signal);
    return new Response(JSON.stringify(response()), { status: 200 });
  };
  const result = await loadPlatformAnalytics('https://api.example///');
  assert.equal(result.metrics.totalRewardsSol, 12.5);
  globalThis.fetch = async () => new Response('Unavailable', { status: 503 });
  await assert.rejects(loadPlatformAnalytics('https://api.example'), /temporarily unavailable/);
});

test('leaving Analytics aborts an in-flight backend request', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  let requestSignal: AbortSignal | null | undefined;
  globalThis.fetch = async (_url, options) => {
    requestSignal = options?.signal;
    return new Promise((_resolve, reject) => {
      requestSignal?.addEventListener(
        'abort',
        () => reject(new DOMException('Aborted', 'AbortError')),
        { once: true },
      );
    });
  };
  const controller = new AbortController();
  const pending = loadPlatformAnalytics('https://api.example', controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(requestSignal?.aborted, true);
});

test('received eggs and packs survive the feed adapter without revealing a Pokémon', () => {
  const result = parsePlatformAnalytics({
    ...response(),
    events: ['egg_awarded', 'pack_awarded'].map((kind) => ({
      ...event,
      id: kind,
      kind,
      title: 'Received a reward',
      detail: 'From $KANTO',
      href: '/coin/kanto',
      pokemonId: undefined,
      shiny: false,
    })),
  });
  assert.equal(result.events.length, 2);
  assert.deepEqual(
    result.events.map((e) => e.kind),
    ['egg_awarded', 'pack_awarded'],
  );
  assert.ok(result.events.every((e) => e.pokemonId === undefined && e.href === '/coin/kanto'));
});
