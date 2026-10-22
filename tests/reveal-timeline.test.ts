import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runRevealTimeline,
  type RevealClock,
  type RevealFrame,
} from '../src/audio/reveal-timeline';
import { REVEAL_TIMELINES, type RevealKind } from '../src/audio/catalog';

function clock() {
  let now = 0,
    nextId = 0;
  const callbacks = new Map<number, () => void>();
  const source: RevealClock = {
    now: () => now,
    request: (callback) => {
      callbacks.set(++nextId, callback);
      return nextId;
    },
    cancel: (id) => {
      callbacks.delete(id);
    },
  };
  return {
    source,
    advance(value: number) {
      now = value;
      const next = [...callbacks.values()];
      callbacks.clear();
      next.forEach((callback) => callback());
    },
    pending: () => callbacks.size,
  };
}
function sequence(kind: RevealKind, reducedMotion = false) {
  const time = clock();
  const frames: RevealFrame[] = [],
    cues: { time: number; files: string[] }[] = [];
  let reveals = 0;
  const run = runRevealTimeline(
    kind,
    {
      reducedMotion,
      onFrame: (frame) => frames.push(frame),
      onSound: (layers) =>
        cues.push({ time: frames.at(-1)!.elapsedMs, files: layers.map((layer) => layer.file) }),
      onReveal: () => {
        reveals++;
      },
    },
    time.source,
  );
  return { time, frames, cues, run, reveals: () => reveals };
}

test('egg cracks, pack tear and evolution reveal use the exact currently sampled visual frame', () => {
  for (const kind of ['hatch', 'pack', 'evolve'] as const) {
    const app = sequence(kind);
    const plan = REVEAL_TIMELINES[kind];
    for (const cue of plan.cues) {
      if (cue.atMs > 0) {
        app.time.advance(cue.atMs - 1);
        assert.equal(app.cues.filter((item) => item.time === cue.atMs).length, 0);
      }
      app.time.advance(cue.atMs);
      assert.deepEqual(app.cues.at(-1), {
        time: cue.atMs,
        files: cue.layers.map((layer) => layer.file),
      });
      assert.equal(app.frames.at(-1)!.progress, cue.atMs / plan.durationMs);
    }
    app.time.advance(plan.durationMs - 1);
    assert.equal(app.reveals(), 0);
    app.time.advance(plan.durationMs);
    assert.equal(app.frames.at(-1)!.revealed, true);
    assert.equal(app.reveals(), 1);
    assert.deepEqual(
      app.cues.at(-1)!.files,
      plan.revealed.map((layer) => layer.file),
    );
    app.time.advance(plan.durationMs + 1000);
    assert.equal(app.reveals(), 1);
    assert.equal(app.time.pending(), 0);
  }
});

test('a blocked frame skips stale cracks instead of replaying a burst over the reveal', () => {
  const app = sequence('hatch');
  app.time.advance(2400);
  assert.equal(app.reveals(), 1);
  assert.deepEqual(
    app.cues.map((cue) => cue.files),
    [['JoinTeam']],
  );
});

test('dismissal cancels the animation and every future sound and reveal callback', () => {
  const app = sequence('pack');
  app.time.advance(100);
  app.run.cancel();
  const before = app.frames.length;
  app.time.advance(1800);
  app.run.finishSilently();
  assert.equal(app.frames.length, before);
  assert.equal(app.cues.length, 1);
  assert.equal(app.reveals(), 0);
  assert.equal(app.time.pending(), 0);
});

test('backgrounding completes owned result silently and never resumes old sound cues', () => {
  const app = sequence('evolve');
  app.time.advance(1250);
  const sounds = app.cues.length;
  app.run.finishSilently();
  assert.equal(app.frames.at(-1)!.revealed, true);
  assert.equal(app.reveals(), 1);
  app.time.advance(9000);
  assert.equal(app.cues.length, sounds);
  assert.equal(app.reveals(), 1);
});

test('reduced motion reveals promptly without cracks, flashes or a long evolution countdown', () => {
  for (const kind of ['hatch', 'pack', 'evolve'] as const) {
    const app = sequence(kind, true);
    app.time.advance(179);
    assert.equal(app.cues.length, 0);
    assert.equal(app.reveals(), 0);
    app.time.advance(180);
    assert.equal(app.reveals(), 1);
    assert.equal(app.cues.length, 1, 'only the quiet completion sample remains');
    assert.equal(app.frames.at(-1)!.durationMs, 180);
  }
});

test('slow artwork holds before the flash and resumes sound with the reveal after decoding', () => {
  for (const kind of ['hatch', 'pack'] as const) {
    const time = clock();
    let ready = false,
      reveals = 0;
    const frames: RevealFrame[] = [];
    const sounds: string[] = [];
    const plan = REVEAL_TIMELINES[kind];
    runRevealTimeline(
      kind,
      {
        canReveal: () => ready,
        onFrame: (frame) => frames.push(frame),
        onSound: (layers) => sounds.push(...layers.map((layer) => layer.file)),
        onReveal: () => reveals++,
      },
      time.source,
    );
    time.advance(plan.durationMs + 5000);
    const held = frames.at(-1)!.elapsedMs;
    assert.equal(held, plan.cues.find((cue) => cue.name === 'flash')!.atMs - 1);
    time.advance(plan.durationMs + 6000);
    assert.equal(frames.at(-1)!.elapsedMs, held);
    assert.equal(reveals, 0);
    ready = true;
    time.advance(plan.durationMs + 6001);
    assert.ok(sounds.includes(plan.cues.find((cue) => cue.name === 'flash')!.layers[0].file));
    time.advance(plan.durationMs + 6000 + plan.durationMs - held);
    assert.equal(reveals, 1);
    assert.equal(frames.at(-1)!.revealed, true);
    assert.ok(sounds.includes(plan.revealed[0].file));
  }
});

test('a hidden or reduced-motion reward still waits for artwork; cancellation never reveals later', () => {
  const time = clock();
  let ready = false,
    reveals = 0,
    sounds = 0;
  const run = runRevealTimeline(
    'pack',
    {
      reducedMotion: true,
      canReveal: () => ready,
      onFrame() {},
      onSound: () => sounds++,
      onReveal: () => reveals++,
    },
    time.source,
  );
  run.finishSilently();
  time.advance(9000);
  assert.equal(reveals, 0);
  ready = true;
  time.advance(9010);
  assert.equal(reveals, 1);
  assert.equal(sounds, 0);
  const cancelled = runRevealTimeline(
    'hatch',
    {
      canReveal: () => false,
      onFrame() {},
      onSound() {},
      onReveal: () => reveals++,
    },
    time.source,
  );
  cancelled.cancel();
  time.advance(12000);
  assert.equal(reveals, 1);
  assert.equal(time.pending(), 0);
});
