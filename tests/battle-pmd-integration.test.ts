import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createInitialState } from '../src/data/demo';
import { STORAGE_KEY } from '../src/state/model';
import {
  getBodyFrameAt,
  normalizeBodyManifest,
  PMD_CATALOGUE,
  type BodyClip,
  type BodyFrame,
  type BodyManifest,
  type PmdManifest,
} from '../src/battle/body-animation';
import { createBattleScene, sampleBattleSceneAt, bodyPointOnField } from '../src/battle/geometry';
import { getBattleCue, type BattleCue } from '../src/battle/presentation';
import {
  bindSpriteTimeline,
  buildSpriteTimeline,
  effectCueElapsed,
  getMoveSpriteScript,
  sampleSpriteLayer,
} from '../src/battle/effect-sprites';

test('the actual atlas imports the authored facing rows without cancelling attack displacement', () => {
  assert.equal(Object.keys(PMD_CATALOGUE).length, 151);
  for (const entry of Object.values(PMD_CATALOGUE)) {
    const raw = JSON.parse(
      readFileSync(new URL('../public/assets/' + entry.manifest, import.meta.url), 'utf8'),
    ) as PmdManifest & {
      source: { commit: string; directionRows: { front: number; back: number } };
    };
    assert.deepEqual(raw.source.directionRows, { front: 7, back: 3 }, entry.name);
    assert.match(raw.source.commit, /^[0-9a-f]{40}$/);
    const svg = readFileSync(new URL('../public/assets/' + raw.image.src, import.meta.url), 'utf8');
    const attributes = (value: string) =>
      Object.fromEntries([...value.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
    const rows = [...svg.matchAll(/<svg\b([^>]+)>\s*<use\b([^>]+)\/>\s*<\/svg>/g)].map((match) => ({
      ...attributes(match[1]),
      href: attributes(match[2]).href,
    }));
    const normalized = normalizeBodyManifest(raw);
    for (const variant of ['normal', 'shiny'] as const) {
      for (const facing of ['front', 'back'] as const) {
        assert.ok(normalized.variants[variant][facing].clips.idle.frames.length > 1);
        for (const [action, rawClip] of Object.entries(raw.variants[variant].clips)) {
          const clip = rawClip as typeof rawClip & {
            sourceAction: string;
            sourceCell: [number, number];
            frames: Record<
              'front' | 'back',
              Array<
                (typeof rawClip.frames.front)[number] & {
                  sourceRect: [number, number, number, number];
                }
              >
            >;
          };
          const [cellWidth, cellHeight] = clip.sourceCell;
          const frames = clip.frames[facing];
          const originalOrigins: string[] = [];
          for (const [index, frame] of frames.entries()) {
            const source = rows.find(
              (row) => Number(row.x) === frame.rect[0] && Number(row.y) === frame.rect[1],
            );
            assert.ok(source, `${entry.name} ${variant} ${facing} ${action}: actual SVG crop`);
            const viewBox = source.viewBox.split(' ').map(Number);
            assert.deepEqual(
              viewBox,
              frame.sourceRect,
              'Rendered source viewport matches metadata',
            );
            assert.equal(
              Math.floor(viewBox[1] / cellHeight),
              raw.source.directionRows[facing],
              `${entry.name} ${action}: authored source direction`,
            );
            assert.equal(
              Math.floor(viewBox[0] / cellWidth),
              index,
              'Frames use successive authored source poses',
            );
            assert.deepEqual(
              viewBox.slice(2),
              frame.rect.slice(2),
              'Atlas crops preserve source dimensions',
            );
            assert.equal(source.href, `#${variant}-${clip.sourceAction}`);
            originalOrigins.push(
              [
                frame.offset[0] - (viewBox[0] - index * cellWidth),
                frame.offset[1] - (viewBox[1] - raw.source.directionRows[facing] * cellHeight),
              ].join(','),
            );
          }
          assert.equal(
            new Set(originalOrigins).size,
            1,
            `${entry.name} ${action}: fixed original cell origin retains authored displacement`,
          );
        }
      }
    }
  }
  const charmander = JSON.parse(
    readFileSync(new URL('../public/assets/battle/pmd/004.json', import.meta.url), 'utf8'),
  ) as PmdManifest;
  for (const facing of ['front', 'back'] as const) {
    const frames = charmander.variants.normal.clips.Attack.frames[facing];
    assert.ok(
      new Set(frames.map((frame) => frame.anchors.feet.join(','))).size > 2,
      'Authored movement of the feet remains in the attack',
    );
    assert.ok(
      new Set(frames.map((frame) => frame.anchors.head.join(','))).size > 2,
      'Moving emission points retain the original body action',
    );
  }
});

// Deliberately asymmetric moving anatomy makes a stale/static anchor observable.
// These fixtures exercise the contract between body sampling, geometry and VFX;
// the real imported sprite catalogue is checked separately.
function bodyFixture(speciesId: number): BodyManifest {
  const clip = (action: string, count: number, y: number): BodyClip => ({
    action,
    durationMs: 800,
    releaseAt: 0.25,
    impactAt: 0.5,
    returnAt: 0.75,
    frames: Array.from(
      { length: count },
      (_, index): BodyFrame => ({
        sheet: 0,
        rect: [index * 64, y, 64, 64],
        offset: [0, 0],
        bounds: [8 + index, 7, 43, 49],
        at: index / count,
        anchors: {
          body: [32 + index * 2, 36],
          mouth: [23 + index * 4, 17 - index],
          cannon: [42 + index * 3, 24],
          hand: [39 + index * 3, 33],
          crown: [29 + index * 2, 9],
          feet: [32, 56 - index],
        },
      }),
    ),
  });
  const view = (y: number) => ({
    bounds: [7, 6, 51, 51] as [number, number, number, number],
    contact: [32, 56] as [number, number],
    clips: {
      idle: clip('Idle', 4, y),
      Idle: clip('Idle', 4, y),
      Attack: clip('Attack', 4, y + 64),
      Shoot: clip('Shoot', 4, y + 128),
      Hurt: clip('Hurt', 2, y + 192),
      Faint: clip('Faint', 4, y + 256),
    },
  });
  return {
    version: 1,
    speciesId,
    canvasWidth: 64,
    canvasHeight: 64,
    sheets: [{ src: 'battle/pmd/fixture.svg', imageWidth: 256, imageHeight: 1536 }],
    variants: {
      normal: { front: view(0), back: view(320) },
      shiny: { front: view(640), back: view(960) },
    },
  };
}

function moveCue(name: string, outcome: BattleCue['outcome'] = 'hit'): BattleCue {
  return {
    ...getBattleCue({ kind: 'move', side: 'player', moveName: name, text: name })!,
    outcome,
  };
}

test('one cue clock synchronizes actual body frames, effect origins and target reactions', () => {
  const player = bodyFixture(4);
  const rival = bodyFixture(7);
  const base = createBattleScene({
    width: 900,
    height: 460,
    player: { speciesId: 4, manifest: player },
    rival: { speciesId: 7, shiny: true, manifest: rival },
  });
  const cue = moveCue('Ember');
  const startedAt = 5000;
  const elapsed = effectCueElapsed(5260, startedAt, cue.durationMs);
  const current = sampleBattleSceneAt(base, cue, elapsed);
  const selected = getBodyFrameAt(player, { side: 'player', cue, elapsedMs: elapsed });
  assert.equal(selected.clip.action, 'Shoot');
  assert.equal(selected.frameIndex, 2, 'The firing pose has reached its authored release frame');
  assert.deepEqual(
    current.actors.player.anchors.mouth,
    bodyPointOnField(base.actors.player, selected.frame.anchors.mouth),
  );
  assert.notDeepEqual(current.actors.player.anchors.mouth, base.actors.player.anchors.mouth);

  const impact = cue.durationMs * getMoveSpriteScript('Ember').impactAt;
  assert.equal(
    getBodyFrameAt(rival, { side: 'rival', shiny: true, cue, elapsedMs: impact - 1 }).phase,
    'idle',
  );
  const hurt = getBodyFrameAt(rival, { side: 'rival', shiny: true, cue, elapsedMs: impact });
  assert.equal(hurt.phase, 'hurt');
  assert.ok(hurt.frame.rect[1] >= 640, 'The target retains its shiny front-facing source frames');
  for (const outcome of ['miss', 'immune', 'charge'] as const) {
    const failed = { ...cue, outcome };
    assert.equal(
      getBodyFrameAt(rival, { side: 'rival', shiny: true, cue: failed, elapsedMs: impact + 30 })
        .phase,
      'idle',
      `${outcome} must not animate a hit on the opponent`,
    );
  }
  const still = getBodyFrameAt(player, {
    side: 'player',
    cue,
    elapsedMs: elapsed,
    reducedMotion: true,
  });
  assert.deepEqual(
    sampleBattleSceneAt(base, cue, elapsed, true).actors.player.anchors.mouth,
    bodyPointOnField(base.actors.player, still.frame.anchors.mouth),
    'Reduced motion still emits from the exact frame displayed',
  );
});

test('emitted projectiles keep their launch path when the Pokémon changes pose', () => {
  const manifest = bodyFixture(4);
  const base = createBattleScene({
    width: 900,
    height: 460,
    player: { speciesId: 4, manifest },
    rival: { speciesId: 7, manifest: bodyFixture(7) },
  });
  const cue = moveCue('Ember');
  const timeline = bindSpriteTimeline(buildSpriteTimeline(cue, base), cue, base, (elapsed) =>
    sampleBattleSceneAt(base, cue, elapsed),
  );
  const particle = timeline.layers.find((layer) => layer.space === 'flight')!;
  assert.ok(particle, 'Ember emits a travelling particle');
  const elapsed = particle.delay + particle.duration / 2;
  const real = sampleBattleSceneAt(base, cue, elapsed);
  const moved = structuredClone(real);
  for (const point of Object.values(moved.actors.player.anchors)) {
    point.x += 100;
    point.y -= 80;
  }
  assert.deepEqual(
    sampleSpriteLayer(particle, timeline, cue, base, real, elapsed),
    sampleSpriteLayer(particle, timeline, cue, base, moved, elapsed),
    'Changing the caster after launch cannot drag the projectile through the air',
  );
  assert.equal(
    sampleSpriteLayer(particle, timeline, cue, base, real, particle.delay - 1).opacity,
    0,
  );
  assert.equal(
    sampleSpriteLayer(particle, timeline, cue, base, real, particle.delay + particle.duration)
      .opacity,
    0,
  );
  assert.equal(effectCueElapsed(5200, 5000, cue.durationMs), 200);
  assert.equal(effectCueElapsed(4990, 5000, cue.durationMs), 0);
});

test('zero HP remains visible through real faint frames and stays hidden after the cue ends', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://example.test/pokepad/#/battles',
    pretendToBeVisual: true,
  });
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const replace = (key: string, value: unknown) => {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  for (const key of [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'HTMLInputElement',
    'HTMLTextAreaElement',
    'MutationObserver',
    'localStorage',
    'Event',
    'MouseEvent',
    'Image',
  ]) {
    replace(key, (dom.window as unknown as Record<string, unknown>)[key]);
  }
  replace('IS_REACT_ACT_ENVIRONMENT', true);
  let time = 10000,
    nextId = 100000;
  const frames = new Map<number, FrameRequestCallback>();
  const timers = new Map<number, { at: number; run: () => void }>();
  const nativeTimeout = globalThis.setTimeout;
  const nativeClearTimeout = globalThis.clearTimeout;
  const random = Math.random;
  const dateNow = Date.now;
  // The rival roster is seeded from the clock, independently of combat rolls.
  // Fix both so this visibility test always reaches the same lethal hit.
  Date.now = () => 1700000000000;
  Math.random = () => 0.01;
  replace('performance', { now: () => time });
  replace('setTimeout', ((
    callback: (...args: unknown[]) => void,
    delay = 0,
    ...args: unknown[]
  ) => {
    if (delay >= 300 && delay <= 1200) {
      const id = nextId++;
      timers.set(id, { at: time + delay, run: () => callback(...args) });
      return id;
    }
    return nativeTimeout(callback, delay, ...args);
  }) as unknown as typeof setTimeout);
  replace('clearTimeout', ((id: number | ReturnType<typeof setTimeout>) => {
    if (typeof id === 'number' && timers.delete(id)) return;
    nativeClearTimeout(id);
  }) as typeof clearTimeout);
  const requestFrame = (callback: FrameRequestCallback) => {
    const id = nextId++;
    frames.set(id, callback);
    return id;
  };
  const cancelFrame = (id: number) => {
    frames.delete(id);
  };
  dom.window.requestAnimationFrame = requestFrame;
  dom.window.cancelAnimationFrame = cancelFrame;
  replace('requestAnimationFrame', requestFrame);
  replace('cancelAnimationFrame', cancelFrame);
  dom.window.HTMLImageElement.prototype.decode = async () => {};
  // This DOM fixture checks faint visibility and event timing. Native canvas
  // drawing is covered separately; JSDOM has no raster context implementation.
  dom.window.HTMLCanvasElement.prototype.getContext = () => null;
  dom.window.scrollTo = () => {};
  replace('fetch', async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const match = url.match(/assets\/battle\/pmd\/(\d+\.json)(?:[?#].*)?$/);
    assert.ok(match, 'Only local battle manifests are requested');
    return new Response(
      readFileSync(new URL('../public/assets/battle/pmd/' + match[1], import.meta.url), 'utf8'),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  });
  const state = createInitialState();
  state.profile.reducedMotion = false;
  state.profile.rewardNotifications = false;
  state.rewards = [];
  state.pokemon = [
    {
      ...state.pokemon[0],
      id: 'faint-test',
      speciesId: 4,
      level: 5,
      moves: ['Growl'],
      moveOffers: [],
      rareCandy: 0,
    },
  ];
  state.profile.equippedId = 'faint-test';
  dom.window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const { createRoot } = await import('react-dom/client');
  const { AppProvider } = await import('../src/state/AppContext');
  const { BattlesPage } = await import('../src/pages/Battles');
  const root = createRoot(dom.window.document.getElementById('root')!);
  const document = dom.window.document;
  const click = async (selector: string) => {
    const element = document.querySelector(selector);
    assert.ok(element, 'Control exists: ' + selector);
    await act(async () =>
      element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })),
    );
  };
  const renderFrame = async (at = time) => {
    time = at;
    const pending = [...frames.values()];
    frames.clear();
    await act(async () => {
      for (const callback of pending) callback(time);
    });
  };
  const advance = async () => {
    const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    assert.ok(next, 'Playback has a following event');
    timers.delete(next[0]);
    time = next[1].at;
    await act(async () => next[1].run());
    await renderFrame();
  };
  let sawZeroBeforeFaint = false,
    sawFaint = false,
    sawHiddenAfterFaint = false;
  try {
    await act(async () =>
      root.render(React.createElement(AppProvider, null, React.createElement(BattlesPage))),
    );
    await click('[aria-label="Master difficulty"]');
    await click('.arena-hero .button');
    await click('[aria-label="Choose Pokémon for slot 1"]');
    await click('.battle-picker-pokemon:not(:disabled)');
    await click('.battle-review>.button');
    assert.ok(
      document.querySelector('.classic-match'),
      'Decoded body art permits battle start: ' +
        document.querySelector('.battle-review')?.textContent,
    );
    for (let turn = 0; turn < 30 && !sawHiddenAfterFaint; turn++) {
      await click('.classic-fight');
      await click('.battle-moves>button');
      while (
        document.querySelector('.classic-handheld')?.getAttribute('data-state') === 'playing'
      ) {
        const actor = document.querySelector('.classic-player')!;
        const sprite = actor.querySelector('.battle-body-sprite')!;
        const phase = sprite.getAttribute('data-body-phase');
        const zero = /, 0 of /.test(
          document.querySelector('.classic-health-player')!.getAttribute('aria-label')!,
        );
        if (zero && !sawFaint && phase !== 'faint') {
          sawZeroBeforeFaint = true;
          assert.equal(
            actor.classList.contains('is-fainted'),
            false,
            'Damage cannot hide the Pokémon before its faint cue',
          );
        }
        if (phase === 'faint' && !sawFaint) {
          sawFaint = true;
          assert.equal(
            actor.classList.contains('is-fainted'),
            false,
            'The faint animation is visible',
          );
          const initialFrame = sprite.getAttribute('data-body-frame');
          await renderFrame(time + 500);
          assert.notEqual(
            document
              .querySelector('.classic-player .battle-body-sprite')!
              .getAttribute('data-body-frame'),
            initialFrame,
            'The character changes actual frames while fainting',
          );
          assert.equal(actor.classList.contains('is-fainted'), false);
        } else if (sawFaint && phase !== 'faint') {
          assert.equal(
            actor.classList.contains('is-fainted'),
            true,
            'The completed faint cannot flash back to idle',
          );
          sawHiddenAfterFaint = true;
        }
        await advance();
      }
    }
    assert.ok(sawZeroBeforeFaint, 'Observed the lethal damage snapshot');
    assert.ok(sawFaint, 'Observed the real faint sequence');
    assert.ok(sawHiddenAfterFaint, 'Observed the hidden completed faint');
    assert.ok(
      document.querySelector('.classic-player.is-fainted'),
      'The result screen keeps the fainted body hidden',
    );
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    Date.now = dateNow;
    Math.random = random;
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
