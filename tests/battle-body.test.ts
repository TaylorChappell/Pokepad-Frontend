import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BODY_MOVE_ACTIONS,
  bodyFrameIndexAt,
  getBodyFrameAt,
  getBodyFrameStyle,
  getBodyMoveTiming,
  normalizeBodyManifest,
  resolveBodyAction,
  validatePmdManifest,
  type PmdManifest,
  type PmdCatalogueEntry,
  type PmdClip,
  type PmdFrame,
  type BodyFacing,
} from '../src/battle/body-animation';
import { createBodyAssetStore } from '../src/battle/body-registry';
import {
  getBodyTransitionStyle,
  sampleBodyTransition,
  type BodyTransition,
} from '../src/battle/body-transition';
import { PRESENTED_MOVES, getBattleCue, type BattleCue } from '../src/battle/presentation';

test('recall and sendout hide the correct sprite without resampling its native pixels', () => {
  const recall: BodyTransition = { phase: 'recall', startedAt: 5000, durationMs: 600 };
  const sendout: BodyTransition = { phase: 'sendout', startedAt: 5600, durationMs: 1100 };
  assert.deepEqual(sampleBodyTransition(recall, 0), {
    visible: true,
    density: 16,
    silhouette: false,
  });
  assert.equal(sampleBodyTransition(recall, 100).silhouette, true);
  assert.equal(sampleBodyTransition(recall, 600).visible, false);
  assert.equal(sampleBodyTransition(sendout, 440).visible, false);
  const emerging = sampleBodyTransition(sendout, 660);
  assert.ok(emerging.density > 0 && emerging.density < 16);
  assert.equal(emerging.silhouette, true);
  assert.deepEqual(sampleBodyTransition(sendout, 1100), {
    visible: true,
    density: 16,
    silhouette: false,
  });
  const style = getBodyTransitionStyle(sendout, emerging, 5);
  assert.equal(style.maskSize, '20px');
  assert.equal(style.transform, undefined);
  assert.equal(sampleBodyTransition(sendout, 494, true).visible, false);
  assert.equal(sampleBodyTransition(sendout, 496, true).visible, true);
  assert.equal(sampleBodyTransition(sendout, 660, true).silhouette, false);
  assert.equal(sampleBodyTransition(recall, 301, true).visible, false);
});

function fixture() {
  const frame = (index: number, row: number): PmdFrame => ({
    rect: [index * 20, row * 20, 20, 20],
    offset: [0, 0],
    bounds: [2, 2, 16, 16],
    anchors: {
      body: [10, 11],
      head: [10 + index, 5],
      leftHand: [5, 11],
      rightHand: [15, 11],
      feet: [10, 18],
    },
  });
  const clip = (row: number, sourceAction: string): PmdClip => ({
    sourceAction,
    durations: [1, 3, 2, 4],
    rushFrame: 1,
    hitFrame: 2,
    returnFrame: 3,
    frames: {
      front: [0, 1, 2, 3].map((i) => frame(i, row)),
      back: [0, 1, 2, 3].map((i) => frame(i, row + 1)),
    },
  });
  const raw: PmdManifest = {
    id: 4,
    name: 'Charmander',
    canvas: [20, 20],
    ground: [10, 18],
    image: { src: 'battle/pmd/004.svg', width: 80, height: 80 },
    variants: { normal: { clips: {} }, shiny: { clips: {} } },
  };
  const entry: PmdCatalogueEntry = {
    id: 4,
    name: raw.name,
    image: raw.image,
    manifest: 'battle/pmd/004.json',
    canvas: [20, 20],
    ground: [10, 18],
    variants: {
      normal: { bounds: { front: [2, 2, 16, 16], back: [2, 2, 16, 16] }, actions: [] },
      shiny: { bounds: { front: [2, 2, 16, 16], back: [2, 2, 16, 16] }, actions: [] },
    },
  };
  for (const [variant, row] of [
    ['normal', 0],
    ['shiny', 2],
  ] as const) {
    for (const action of ['Idle', 'Walk', 'Attack', 'Shoot', 'Hurt', 'Charge', 'Sleep'])
      raw.variants[variant].clips[action] = clip(row, action);
    entry.variants[variant].actions = Object.keys(raw.variants[variant].clips);
    entry.variants[variant].idleFrame = { front: frame(0, row), back: frame(0, row + 1) };
  }
  return { raw, entry, manifest: normalizeBodyManifest(raw, entry) };
}
function cue(
  name: string,
  side: 'player' | 'rival' = 'player',
  outcome: BattleCue['outcome'] = 'hit',
): BattleCue {
  return { ...getBattleCue({ kind: 'move', side, moveName: name, text: name })!, outcome };
}

test('all playable moves map to real action families and source aliases retain their provenance', () => {
  assert.deepEqual(Object.keys(BODY_MOVE_ACTIONS).sort(), [...PRESENTED_MOVES].sort());
  const { raw, entry } = fixture();
  raw.variants.normal.clips.Shoot.sourceAction = 'Charge';
  const manifest = normalizeBodyManifest(raw, entry);
  for (const facing of ['front', 'back'] as BodyFacing[]) {
    const view = manifest.variants.normal[facing];
    for (const name of PRESENTED_MOVES)
      assert.ok(resolveBodyAction(view, name).frames.length > 1, name);
    assert.equal(resolveBodyAction(view, 'Ember').action, 'Charge');
    assert.equal(view.clips.Faint.action, 'Sleep');
    assert.throws(() => resolveBodyAction(view, 'Not a real move'), /mapping unavailable/);
  }
});

test('native frame durations, directions and shiny crops remain distinct at a constant pixel scale', () => {
  const { manifest } = fixture();
  const normal = manifest.variants.normal.front.clips.idle;
  assert.deepEqual(
    normal.frames.map((frame) => frame.at),
    [0, 0.1, 0.4, 0.6],
  );
  assert.equal(bodyFrameIndexAt(normal, 0.39), 1);
  assert.equal(bodyFrameIndexAt(normal, 0.4), 2);
  const first = getBodyFrameStyle(manifest, normal.frames[0]);
  for (const frame of normal.frames) {
    const style = getBodyFrameStyle(manifest, frame);
    assert.equal(style.width, first.width);
    assert.equal(style.height, first.height);
    assert.equal(style.backgroundSize, first.backgroundSize);
  }
  const rects = new Set<string>();
  for (const side of ['player', 'rival'] as const)
    for (const shiny of [false, true]) {
      rects.add(JSON.stringify(getBodyFrameAt(manifest, { side, shiny, elapsedMs: 0 }).frame.rect));
    }
  assert.equal(rects.size, 4);
});

test('single-frame native idle becomes a short real Walk fidget with a resting dwell', () => {
  const { raw, entry } = fixture();
  for (const variant of ['normal', 'shiny'] as const) {
    raw.variants[variant].clips.Idle.durations = [30];
    for (const facing of ['front', 'back'] as const)
      raw.variants[variant].clips.Idle.frames[facing] = raw.variants[variant].clips.Idle.frames[
        facing
      ].slice(0, 1);
  }
  const manifest = normalizeBodyManifest(raw, entry);
  const idle = manifest.variants.normal.back.clips.idle;
  assert.equal(idle.durationMs, 2800);
  assert.equal(idle.frames[0].sourceAction, 'Idle');
  assert.equal(idle.frames[1].at, 0.63);
  assert.equal(idle.frames[1].sourceAction, 'Walk');
  assert.equal(idle.frames.at(-1)?.sourceAction, 'Idle');
  assert.equal(idle.frames.at(-1)?.at, 0.95);
});

test('physical impacts, incoming Hurt, charge and faint use one shared cue timeline', () => {
  const { manifest } = fixture();
  const attack = cue('Scratch');
  const impactMs = getBodyMoveTiming('Scratch').impactAt * attack.durationMs;
  const actor = getBodyFrameAt(manifest, { side: 'player', cue: attack, elapsedMs: impactMs });
  assert.equal(actor.frameIndex, 2);
  assert.equal(actor.animation, 'Scratch');
  const before = getBodyFrameAt(manifest, { side: 'rival', cue: attack, elapsedMs: impactMs - 1 });
  assert.equal(before.animation, 'idle');
  const hit = getBodyFrameAt(manifest, { side: 'rival', cue: attack, elapsedMs: impactMs });
  assert.equal(hit.animation, 'Hurt');
  for (const outcome of ['miss', 'immune'] as const)
    assert.equal(
      getBodyFrameAt(manifest, {
        side: 'rival',
        cue: cue('Scratch', 'player', outcome),
        elapsedMs: attack.durationMs,
      }).animation,
      'idle',
    );
  for (const name of ['Growl', 'Hypnosis', 'Thunder Wave', 'Sleep Powder', 'Poison Powder'])
    assert.equal(
      getBodyFrameAt(manifest, {
        side: 'rival',
        cue: cue(name),
        elapsedMs: attack.durationMs,
      }).animation,
      'idle',
    );
  for (const name of ['Night Shade', 'Dragon Rage'])
    assert.equal(
      getBodyFrameAt(manifest, {
        side: 'rival',
        cue: cue(name),
        elapsedMs: attack.durationMs,
      }).animation,
      'Hurt',
    );
  const charge = getBodyFrameAt(manifest, {
    side: 'player',
    cue: cue('Solar Beam', 'player', 'charge'),
    elapsedMs: 800,
  });
  assert.equal(charge.clip.action, 'Charge');
  const faint: BattleCue = { ...attack, kind: 'faint' };
  const down = getBodyFrameAt(manifest, {
    side: 'player',
    cue: faint,
    elapsedMs: faint.durationMs,
    paused: true,
  });
  assert.equal(down.phase, 'faint');
  assert.equal(down.frameIndex, down.clip.frames.length - 1);
});

test('shooting frames hold through beam emission and reduced motion uses a meaningful authored frame', () => {
  const { manifest } = fixture();
  const attack = cue('Hydro Pump');
  for (const progress of [0.13, 0.4, 0.75, 0.89]) {
    const selected = getBodyFrameAt(manifest, {
      side: 'player',
      cue: attack,
      elapsedMs: attack.durationMs * progress,
    });
    assert.equal(selected.frameIndex, 2);
  }
  const reduced = getBodyFrameAt(manifest, {
    side: 'player',
    cue: attack,
    elapsedMs: 0,
    reducedMotion: true,
  });
  assert.equal(reduced.frameIndex, 2);
  const water = getBodyFrameAt(manifest, { side: 'player', cue: attack, elapsedMs: 500 });
  assert.deepEqual(
    water.frame.anchors.cannon,
    water.frame.anchors.mouth,
    'Most species emit water from the mouth',
  );
});

test('Charizard flames use the authored open mouth and Weedle fires from its horn', () => {
  const load = (id: number) =>
    normalizeBodyManifest(
      JSON.parse(
        readFileSync(
          new URL(
            `../public/assets/battle/pmd/${String(id).padStart(3, '0')}.json`,
            import.meta.url,
          ),
          'utf8',
        ),
      ) as PmdManifest,
    );
  const charizard = load(6);
  for (const shiny of [false, true]) {
    for (const side of ['player', 'rival'] as const) {
      const move = cue('Flamethrower', side);
      const frame = getBodyFrameAt(charizard, {
        side,
        shiny,
        cue: move,
        elapsedMs: move.durationMs * 0.5,
      }).frame;
      assert.deepEqual(frame.anchors.mouth, side === 'player' ? [56, 36] : [35, 46]);
    }
  }
  const weedle = load(13);
  for (const side of ['player', 'rival'] as const) {
    const move = cue('Poison Sting', side);
    const selected = getBodyFrameAt(weedle, {
      side,
      cue: move,
      elapsedMs: move.durationMs * 0.5,
    });
    assert.equal(selected.clip.action, 'Shoot');
    assert.deepEqual(selected.frame.anchors.crown, side === 'player' ? [39, 29] : [38, 27]);
  }
});

test('invalid identity or source crops cannot enter the loaded animation cache', () => {
  const { raw, entry } = fixture();
  const invalidId = structuredClone(raw);
  invalidId.id = 5;
  assert.throws(() => validatePmdManifest(invalidId, entry), /identity/);
  const invalidCrop = structuredClone(raw);
  invalidCrop.variants.normal.clips.Idle.frames.front[0].rect[0] = 80;
  assert.throws(() => validatePmdManifest(invalidCrop, entry), /source frame/);
});

test('body metadata and images are cached per species, errors retry, and unsubscription cleans listeners', async () => {
  const { raw, entry } = fixture();
  let metadataRequests = 0,
    imageRequests = 0,
    failMetadata = true,
    failImage = true,
    notifications = 0;
  const store = createBodyAssetStore(
    {
      fetchManifest: async () => {
        metadataRequests++;
        if (failMetadata) throw new Error('offline');
        return raw;
      },
      decodeImage: async () => {
        imageRequests++;
        if (failImage) throw new Error('decode failed');
      },
    },
    { 4: entry },
  );
  const unsubscribe = store.subscribe(4, () => notifications++);
  await assert.rejects(store.load(4), /offline/);
  assert.equal(store.getState(4).status, 'error');
  failMetadata = false;
  const [a, b] = await Promise.all([store.load(4), store.load(4)]);
  assert.equal(a, b);
  assert.equal(metadataRequests, 2);
  await assert.rejects(store.preload([{ speciesId: 4 }]), /decode failed/);
  assert.equal(store.getState(4).status, 'error');
  failImage = false;
  await Promise.all([
    store.preload([{ speciesId: 4 }, { speciesId: 4, shiny: true }]),
    store.preload([{ speciesId: 4 }]),
  ]);
  assert.equal(imageRequests, 2);
  assert.equal(metadataRequests, 2);
  assert.equal(store.getState(4).status, 'ready');
  assert.ok(notifications >= 4);
  unsubscribe();
  const before = notifications;
  await store.load(4);
  assert.equal(notifications, before);
});
