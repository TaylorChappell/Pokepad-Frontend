import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { useBattleAudio } from '../src/battle/audio';
import { useRevealAudio } from '../src/audio/sound';

const key = 'kanto-audio-muted';
const legacyKey = 'pokepad-battle-muted';
type AudioControls = ReturnType<typeof useBattleAudio>;

async function mountAudio({ savedMuted = false, supported = true, deferred = false } = {}) {
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
    connect() {}
    disconnect() {}
    start() {}
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
      return Promise.resolve({ duration: 1.5 });
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
