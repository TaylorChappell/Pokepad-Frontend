import test from 'node:test';
import assert from 'node:assert/strict';
import { startBattlePresence } from '../src/services/battle-presence';
import { createBattleClient, newestBattleRoom, type BattleRoom } from '../src/services/battles';

test('arena presence reports leave, return and unload with ordered messages; hidden pages do not renew leases', async () => {
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' }),
    window = new EventTarget();
  const messages: { present: boolean; sequence: number; clientId: string; keepalive: boolean }[] =
    [];
  let tick = () => {},
    cancelled = false;
  const stop = startBattlePresence({
    clientId: 'tab-one',
    document: document as Document,
    window: window as unknown as Window,
    send: async (body, keepalive) => {
      messages.push({ ...body, keepalive });
      return { id: 'room' } as BattleRoom;
    },
    accept: () => {},
    every: (callback) => {
      tick = callback;
      return 1 as unknown as ReturnType<typeof setInterval>;
    },
    cancel: () => {
      cancelled = true;
    },
  });
  assert.equal(messages[0].present, true);
  tick();
  document.visibilityState = 'hidden';
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(messages.at(-1)!.present, false);
  assert.equal(messages.at(-1)!.keepalive, true);
  const count = messages.length;
  tick();
  assert.equal(messages.length, count);
  document.visibilityState = 'visible';
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(messages.at(-1)!.present, true);
  window.dispatchEvent(new Event('pagehide'));
  assert.equal(messages.at(-1)!.present, false);
  window.dispatchEvent(new Event('pageshow'));
  assert.equal(messages.at(-1)!.present, true);
  stop();
  assert.equal(messages.at(-1)!.present, false);
  assert.equal(cancelled, true);
  assert.deepEqual(
    messages.map((message) => message.sequence),
    messages.map((_, i) => i + 1),
  );
  const stoppedCount = messages.length;
  tick();
  document.dispatchEvent(new Event('visibilitychange'));
  stop();
  assert.equal(messages.length, stoppedCount);
});

test('late presence responses after unmount cannot reopen the room', async () => {
  let resolve!: (room: BattleRoom) => void;
  const seen: BattleRoom[] = [];
  const stop = startBattlePresence({
    clientId: 'tab-one',
    document: Object.assign(new EventTarget(), { visibilityState: 'visible' }) as Document,
    window: new EventTarget() as unknown as Window,
    send: () =>
      new Promise((done) => {
        resolve = done;
      }),
    accept: (room) => seen.push(room),
    every: () => 1 as unknown as ReturnType<typeof setInterval>,
    cancel: () => {},
  });
  const first = resolve;
  stop();
  first({ id: 'old' } as BattleRoom);
  await Promise.resolve();
  assert.deepEqual(seen, []);
});

test('presence sends authenticated keepalive through the API and never uses the surrender endpoint', async () => {
  let requestPath = '',
    options: any;
  const api = createBattleClient(async (path, input) => {
    requestPath = path;
    options = input;
    return {} as any;
  });
  await api.presence('room', { clientId: 'tab', sequence: 3, present: false }, true);
  assert.equal(requestPath, '/v1/battles/room/presence');
  assert.equal(options.keepalive, true);
  assert.equal(options.method, 'POST');
  assert.deepEqual(options.json, { clientId: 'tab', sequence: 3, present: false });
});

test('an older poll cannot overwrite newer presence when the game revision is unchanged', () => {
  const fresh = {
    id: 'room',
    revision: 4,
    serverTime: '2026-10-23T01:00:02Z',
    presence: [{ wallet: 'guest', status: 'present' }],
  } as BattleRoom;
  const old = {
    ...fresh,
    serverTime: '2026-10-23T01:00:01Z',
    presence: [{ wallet: 'guest', status: 'away' }],
  } as BattleRoom;
  assert.equal(newestBattleRoom(fresh, old), fresh);
  assert.equal(newestBattleRoom(old, fresh), fresh);
});
