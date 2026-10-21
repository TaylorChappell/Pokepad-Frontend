import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { useBattleAudio } from '../src/battle/audio';
import { useRevealAudio } from '../src/audio/sound';
import type { RevealClock } from '../src/audio/reveal-timeline';

const key = 'kanto-audio-muted';
const legacyKey = 'pokepad-battle-muted';
type AudioControls = ReturnType<typeof useBattleAudio>;

async function mountAudio({
  savedMuted = false,
  supported = true,
  deferred = false,
  failed = false,
} = {}) {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://example.test/',
    pretendToBeVisual: true,
  });
  const media: FakeAudio[] = [];
  const contexts: FakeContext[] = [];
  class FakeAudio {
    src = '';
    currentTime = 0;
    preload = '';
    volume = 0;
    loop = false;
    muted = false;
    plays = 0;
    pauses = 0;
    listeners = new Map<string, () => void>();
    constructor() {
      media.push(this);
    }
    canPlayType() {
      return supported ? 'probably' : '';
    }
    play() {
      this.plays++;
      return Promise.resolve();
    }
    pause() {
      this.pauses++;
    }
    addEventListener(name: string, fn: () => void) {
      this.listeners.set(name, fn);
    }
    emit(name: string) {
      this.listeners.get(name)?.();
    }
  }
  const parameter = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} });
  class FakeSource {
    frequency = parameter();
    type = '';
    buffer: unknown;
    onended?: () => void;
    stops: (number | undefined)[] = [];
    starts: [number | undefined, number | undefined][] = [];
    connect() {}
    disconnect() {}
    start(at?: number, offset?: number) {
      this.starts.push([at, offset]);
    }
    stop(at?: number) {
      this.stops.push(at);
    }
  }
  class FakeContext {
    state = 'running';
    currentTime = 0;
    sampleRate = 8000;
    destination = {};
    sources: FakeSource[] = [];
    constructor() {
      contexts.push(this);
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    close() {
      this.state = 'closed';
      return Promise.resolve();
    }
    createGain() {
      return { gain: parameter(), connect() {}, disconnect() {} };
    }
    createBufferSource() {
      const source = new FakeSource();
      this.sources.push(source);
      return source;
    }
    decodeAudioData() {
      return Promise.resolve({ duration: 10 });
    }
  }
  for (const name of ['window', 'document', 'navigator', 'localStorage']) {
    Object.defineProperty(globalThis, name, {
      value: (dom.window as unknown as Record<string, unknown>)[name],
      configurable: true,
      writable: true,
    });
  }
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(globalThis, 'Audio', {
    value: supported ? FakeAudio : undefined,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(dom.window, 'AudioContext', {
    value: supported ? FakeContext : undefined,
    configurable: true,
  });
  if (savedMuted) dom.window.localStorage.setItem(legacyKey, 'true');
  const previousFetch = globalThis.fetch;
  const requested: string[] = [];
  const pending: (() => void)[] = [];
  globalThis.fetch = ((url: string) => {
    requested.push(url);
    if (failed) return Promise.reject(new Error('Audio unavailable'));
    const response = { ok: true, arrayBuffer: async () => new ArrayBuffer(16) };
    return deferred
      ? new Promise((resolve) => pending.push(() => resolve(response)))
      : Promise.resolve(response);
  }) as typeof fetch;
  let controls: AudioControls;
  let reveal: ReturnType<typeof useRevealAudio>;
  function Probe({ active }: { active: boolean }) {
    controls = useBattleAudio(active);
    reveal = useRevealAudio();
    return null;
  }
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(dom.window.document.getElementById('root')!);
  const render = async (active: boolean) => {
    await act(async () => root.render(React.createElement(Probe, { active })));
  };
  const invoke = async (fn: (audio: AudioControls) => void) => {
    await act(async () => fn(controls!));
  };
  await render(true);
  return {
    dom,
    media,
    contexts,
    requested,
    async finishLoading() {
      await act(async () => {
        pending.splice(0).forEach((resolve) => resolve());
      });
    },
    async invokeReveal(fn: (audio: ReturnType<typeof useRevealAudio>) => void) {
      await act(async () => fn(reveal!));
    },
    render,
    invoke,
    controls: () => controls!,
    async visibility(hidden: boolean) {
      Object.defineProperty(dom.window.document, 'hidden', { value: hidden, configurable: true });
      await act(async () =>
        dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange')),
      );
    },
    async close() {
      await act(async () => root.unmount());
      dom.window.close();
      globalThis.fetch = previousFetch;
    },
  };
}

test('battle audio waits for a gesture, honours mute, pauses when hidden and cleans up', async () => {
  const app = await mountAudio();
  try {
    assert.equal(app.media.length, 0, 'rendering an active battle must not autoplay');
    assert.equal(app.contexts.length, 0);
    await app.invoke((audio) => audio.unlock());
    const track = app.media[0];
    const context = app.contexts[0];
    assert.equal(track.plays, 1);
    assert.match(track.src, /battle\/audio\/kanto-trainer\.mp3$/);
    track.currentTime = 94.856;
    track.emit('timeupdate');
    assert.ok(
      Math.abs(track.currentTime - 13.203) < 0.001,
      'loop preserves elapsed time past the loop point',
    );
    await app.invoke((audio) => audio.playMove('Thunderbolt'));
    assert.ok(context.sources.length > 0);
    const effects = context.sources.length;
    await app.invoke((audio) => audio.toggleMuted());
    assert.equal(app.dom.window.localStorage.getItem(key), 'true');
    assert.ok(context.sources.every((source) => source.stops.includes(undefined)));
    await app.invoke((audio) => audio.playMove('Flamethrower'));
    assert.equal(context.sources.length, effects, 'muted moves create no audio sources');
    await app.invoke((audio) => audio.toggleMuted());
    assert.equal(app.dom.window.localStorage.getItem(key), 'false');
    assert.equal(track.plays, 2);
    const pauses = track.pauses;
    await app.visibility(true);
    assert.equal(track.pauses, pauses + 1);
    await app.visibility(false);
    assert.equal(track.plays, 3);
    await app.render(false);
    assert.equal(track.currentTime, 0, 'leaving resets the music intro');
    await app.visibility(true);
    await app.visibility(false);
    assert.equal(track.plays, 3, 'returning to a tab outside battle does not restart music');
  } finally {
    await app.close();
  }
  assert.equal(app.media[0].src, '');
  assert.equal(app.contexts[0].state, 'closed');
});

test('saved mute survives mount and unsupported audio remains usable', async () => {
  const muted = await mountAudio({ savedMuted: true });
  try {
    assert.equal(muted.controls().muted, true);
    await muted.invoke((audio) => audio.unlock());
    assert.equal(muted.media.length, 0);
    assert.equal(muted.contexts.length, 0);
    await muted.invoke((audio) => audio.toggleMuted());
    assert.equal(muted.media[0].plays, 1);
  } finally {
    await muted.close();
  }
  const unsupported = await mountAudio({ supported: false });
  try {
    await unsupported.invoke((audio) => {
      audio.unlock();
      audio.playMove('Surf');
      audio.playCue('switch');
      audio.toggleMuted();
    });
    assert.equal(unsupported.controls().muted, true);
    assert.equal(unsupported.media.length, 0);
    assert.equal(unsupported.contexts.length, 0);
  } finally {
    await unsupported.close();
  }
});

test('ending cues survive a result rerender while the battle screen remains open', async () => {
  const app = await mountAudio();
  try {
    await app.invoke((audio) => {
      audio.unlock();
      audio.playCue('win');
    });
    const endings = app.contexts[0].sources;
    assert.equal(endings.length, 1, 'victory uses the original recorded fanfare');
    await app.render(true);
    assert.ok(
      endings.every((source) => source.stops.every((time) => time !== undefined)),
      'result rerender retains the fanfare',
    );
    await app.render(false);
    assert.ok(
      endings.every((source) => source.stops.includes(undefined)),
      'leaving still stops the fanfare',
    );
  } finally {
    await app.close();
  }
});

test('all reward reveal phases use local recordings, share mute and stop on close or hidden', async () => {
  const app = await mountAudio();
  try {
    await app.invokeReveal((audio) => audio.play('hatch', 'opening'));
    assert.equal(app.contexts.length, 0, 'no reveal audio before a user gesture');
    await app.invokeReveal((audio) => audio.unlock());
    assert.ok(app.requested.every((url) => /assets\/audio\/effects\/.+\.mp3$/.test(url)));
    for (const kind of ['hatch', 'pack', 'evolve'] as const) {
      await app.invokeReveal((audio) => audio.play(kind, 'opening'));
      const context = app.contexts[0];
      const previous = [...context.sources];
      await app.invokeReveal((audio) => audio.play(kind, 'revealed'));
      assert.ok(
        previous.every((source) => source.stops.includes(undefined)),
        'reveal cancels pending opening sounds',
      );
      await app.invokeReveal((audio) => audio.stop());
      assert.ok(
        context.sources.every((source) => source.stops.includes(undefined)),
        'close stops every voice',
      );
    }
    await app.invokeReveal((audio) => audio.play('evolve', 'opening'));
    await app.visibility(true);
    assert.ok(app.contexts[0].sources.every((source) => source.stops.includes(undefined)));
    await app.visibility(false);
    const count = app.contexts[0].sources.length;
    await app.invoke((audio) => audio.toggleMuted());
    await app.invokeReveal((audio) => audio.play('pack', 'revealed'));
    assert.equal(app.contexts[0].sources.length, count, 'battle mute also mutes rewards');
  } finally {
    await app.close();
  }
});

test('in-flight audio cannot start after a reveal closes or the player unmounts', async () => {
  const app = await mountAudio({ deferred: true });
  await app.invokeReveal((audio) => {
    audio.unlock();
    audio.play('hatch', 'opening');
  });
  await app.invokeReveal((audio) => audio.stop());
  await app.finishLoading();
  assert.equal(app.contexts[0].sources.length, 0);
  await app.close();
  assert.equal(app.contexts[0].state, 'closed');
});

function revealTestClock() {
  let now = 0,
    id = 0;
  const frames = new Map<number, () => void>();
  const clock: RevealClock = {
    now: () => now,
    request: (callback) => {
      frames.set(++id, callback);
      return id;
    },
    cancel: (key) => {
      frames.delete(key);
    },
  };
  return {
    clock,
    advance(ms: number) {
      now = ms;
      const batch = [...frames.values()];
      frames.clear();
      batch.forEach((frame) => frame());
    },
  };
}

test('reveal samples seek to the actual recorded egg cracks instead of playing long silent prefixes', async () => {
  const app = await mountAudio();
  try {
    await app.invokeReveal((audio) => {
      audio.unlock('hatch');
      audio.play('hatch', 'opening');
    });
    assert.deepEqual(
      app.contexts[0].sources.map((source) => source.starts[0]),
      [
        [0.35, 0],
        [0.9, 1.2],
        [1.5, 3.39],
        [2.05, 0],
      ],
    );
  } finally {
    await app.close();
  }
});

test('a dismissed reveal cancels even while audio is still downloading, without waiting for a network response', async () => {
  const app = await mountAudio({ deferred: true });
  const time = revealTestClock();
  let pending: Promise<boolean> | undefined;
  let frames = 0;
  try {
    await app.invokeReveal((audio) => {
      audio.unlock('hatch');
      pending = audio.start('hatch', {
        clock: time.clock,
        onFrame: () => {
          frames++;
        },
        onReveal: () => assert.fail('dismissed result'),
      });
    });
    await app.invokeReveal((audio) => audio.stop());
    assert.equal(await pending, false);
    await app.finishLoading();
    time.advance(5000);
    assert.equal(frames, 0);
    assert.equal(app.contexts[0].sources.length, 0);
  } finally {
    await app.close();
  }
});

test('mute cancels remaining reveal sounds while the visual result still completes', async () => {
  const app = await mountAudio();
  const time = revealTestClock();
  let revealed = false;
  try {
    await app.invokeReveal(async (audio) => {
      audio.unlock('hatch');
      await audio.start('hatch', {
        clock: time.clock,
        onFrame() {},
        onReveal: () => {
          revealed = true;
        },
      });
    });
    await app.invokeReveal(() => time.advance(350));
    assert.equal(app.contexts[0].sources.length, 1);
    await app.invokeReveal((audio) => audio.toggleMuted());
    await app.invokeReveal((audio) => audio.toggleMuted());
    await app.invokeReveal(() => time.advance(900));
    await app.invokeReveal(() => time.advance(2400));
    assert.equal(revealed, true);
    assert.equal(
      app.contexts[0].sources.length,
      1,
      'unmuting does not resume an interrupted reveal',
    );
    assert.ok(app.contexts[0].sources[0].stops.includes(undefined));
  } finally {
    await app.close();
  }
});

test('unsupported audio and reduced motion cannot block the result; hiding finishes without a late fanfare', async () => {
  const unsupported = await mountAudio({ supported: false });
  const time = revealTestClock();
  let revealed = 0;
  try {
    await unsupported.invokeReveal(async (audio) => {
      audio.unlock('pack');
      await audio.start('pack', {
        reducedMotion: true,
        clock: time.clock,
        onFrame() {},
        onReveal: () => {
          revealed++;
        },
      });
    });
    time.advance(180);
    assert.equal(revealed, 1);
    assert.equal(unsupported.contexts.length, 0);
  } finally {
    await unsupported.close();
  }
  const app = await mountAudio();
  const nextTime = revealTestClock();
  try {
    await app.invokeReveal(async (audio) => {
      audio.unlock('evolve');
      await audio.start('evolve', {
        clock: nextTime.clock,
        onFrame() {},
        onReveal: () => {
          revealed++;
        },
      });
    });
    assert.equal(app.contexts[0].sources.length, 1);
    await app.visibility(true);
    assert.equal(revealed, 2);
    await app.visibility(false);
    await app.invokeReveal(() => nextTime.advance(6000));
    assert.equal(app.contexts[0].sources.length, 1);
    assert.ok(app.contexts[0].sources[0].stops.includes(undefined));
  } finally {
    await app.close();
  }
});

test('failed or indefinitely stalled audio downloads never block a confirmed reveal', async () => {
  for (const mode of [{ failed: true }, { deferred: true }]) {
    const app = await mountAudio(mode);
    const time = revealTestClock();
    let result = false;
    try {
      await app.invokeReveal(async (audio) => {
        audio.unlock('pack');
        assert.equal(
          await audio.start('pack', {
            clock: time.clock,
            onFrame() {},
            onReveal: () => {
              result = true;
            },
          }),
          true,
        );
      });
      await app.invokeReveal(() => time.advance(1800));
      assert.equal(result, true);
      await app.finishLoading();
      assert.equal(
        app.contexts[0].sources.length,
        0,
        'late decoding cannot start out-of-sync sounds',
      );
    } finally {
      await app.close();
    }
  }
});
