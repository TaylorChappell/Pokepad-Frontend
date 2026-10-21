import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BattleEffects } from '../src/components/BattleEffects';
import { createBattleScene } from '../src/battle/geometry';
import { getBattleCue, PRESENTED_MOVES, type BattleCue } from '../src/battle/presentation';
import {
  MOVE_SPRITE_SCRIPTS,
  buildSpriteTimeline,
  getMoveSpriteScript,
  preloadEffectSprites,
  resolveEffectAnchors,
} from '../src/battle/effect-sprites';
import { EFFECT_ATLASES, effectFrameAt, effectFrameGeometry } from '../src/battle/effect-atlases';

const scene = createBattleScene({
  width: 1000,
  height: 600,
  player: { speciesId: 9 },
  rival: { speciesId: 6 },
});
const cueFor = (
  moveName: string,
  side: 'player' | 'rival' = 'player',
  outcome: BattleCue['outcome'] = 'hit',
): BattleCue => ({
  ...getBattleCue({
    kind: 'move',
    side,
    moveName,
    movePhase: outcome === 'charge' ? 'charge' : 'release',
    text: 'Test',
  })!,
  outcome,
});
const rounded = (p: { x: number; y: number }) => ({ x: Math.round(p.x), y: Math.round(p.y) });

test('all 48 playable attacks have a unique authored strip with six safe frame rectangles', () => {
  assert.deepEqual(Object.keys(MOVE_SPRITE_SCRIPTS).sort(), [...PRESENTED_MOVES].sort());
  const strips = new Set<string>();
  for (const move of Object.values(MOVE_SPRITE_SCRIPTS)) {
    strips.add(`${move.sheet}:${move.row}`);
    const atlas = EFFECT_ATLASES[move.sheet - 1];
    const row = atlas.rows[move.row];
    assert.equal(row.move, move.name);
    assert.equal(row.frames.length, 6);
    for (const frame of row.frames) {
      assert.ok(frame.x >= 0 && frame.y >= 0, move.name);
      assert.ok(frame.width > 0 && frame.height > 0, move.name);
      assert.ok(frame.x + frame.width <= atlas.imageWidth, move.name);
      assert.ok(frame.y + frame.height <= atlas.imageHeight, move.name);
    }
  }
  assert.equal(strips.size, 48);
});

test('frame clocks only select exact source rectangles and preserve logical scale and row pivot', () => {
  for (const set of ['full', 'charge', 'impact'] as const) {
    const expected = set === 'full' ? [0, 1, 2, 3, 4, 5] : set === 'charge' ? [0, 1, 2] : [3, 4, 5];
    assert.equal(effectFrameAt(set, 0, 100, 600), expected[0]);
    assert.equal(effectFrameAt(set, 9000, 100, 600), expected.at(-1));
    assert.deepEqual(
      [...new Set(Array.from({ length: 700 }, (_, t) => effectFrameAt(set, t + 100, 100, 600)))],
      expected,
    );
  }
  for (const move of Object.values(MOVE_SPRITE_SCRIPTS)) {
    const reference = effectFrameGeometry(move.sheet, move.row, 0, 100);
    for (let frame = 1; frame < 6; frame++) {
      const next = effectFrameGeometry(move.sheet, move.row, frame, 100);
      assert.deepEqual(
        next.canvas,
        reference.canvas,
        `${move.name}: crop changes must not shift the pivot`,
      );
      assert.equal(
        next.crop.backgroundSize,
        reference.crop.backgroundSize,
        `${move.name}: crops must not rescale`,
      );
    }
  }
});

test('source points use species anatomy, planted tethers and exact opposite-side targets', () => {
  for (const name of PRESENTED_MOVES) {
    for (const side of ['player', 'rival'] as const) {
      const cue = cueFor(name, side);
      const timeline = buildSpriteTimeline(cue, scene);
      const anchor = resolveEffectAnchors(cue, scene);
      assert.deepEqual(timeline.source, rounded(scene.actors[side].anchors[timeline.origin]), name);
      assert.deepEqual(timeline.target, anchor.target);
      assert.ok(timeline.layers.length > 0, name);
      for (const layer of timeline.layers) {
        assert.ok(
          [
            layer.from.x,
            layer.from.y,
            layer.via.x,
            layer.via.y,
            layer.to.x,
            layer.to.y,
            layer.rotation,
            layer.size,
          ].every(Number.isFinite),
          name,
        );
        assert.ok(layer.delay >= 0 && layer.duration > 0, name);
        assert.ok(
          layer.delay + layer.duration <= cue.durationMs + 2,
          `${name}: all layers finish during cue`,
        );
        assert.equal(layer.flip, side === 'rival', name);
      }
    }
  }
  assert.equal(buildSpriteTimeline(cueFor('Hydro Pump'), scene).origin, 'cannon');
  assert.deepEqual(
    buildSpriteTimeline(cueFor('Ember'), scene).source,
    rounded(scene.actors.player.anchors.mouth),
  );
  const plant = createBattleScene({
    width: 1000,
    height: 600,
    player: { speciesId: 1 },
    rival: { speciesId: 7 },
  });
  assert.equal(buildSpriteTimeline(cueFor('Vine Whip'), plant).origin, 'crown');
  assert.equal(getMoveSpriteScript('Vine Whip').motion, 'beam');
  assert.equal(getMoveSpriteScript('Lick').motion, 'beam');
  assert.equal(getMoveSpriteScript('Sand Attack').motion, 'cast');
  assert.equal(getMoveSpriteScript('Wing Attack').motion, 'cast');
  for (const [speciesId, origin] of [
    [15, 'hand'],
    [13, 'crown'],
    [32, 'crown'],
  ] as const) {
    const stingScene = createBattleScene({
      width: 1000,
      height: 600,
      player: { speciesId },
      rival: { speciesId: 7 },
    });
    assert.equal(buildSpriteTimeline(cueFor('Poison Sting'), stingScene).origin, origin);
  }
});

test('misses and immunities never create impacts, healing or life-return particles', () => {
  for (const name of PRESENTED_MOVES) {
    if (cueFor(name).target === 'self') continue;
    for (const outcome of ['miss', 'immune'] as const) {
      const timeline = buildSpriteTimeline(cueFor(name, 'player', outcome), scene);
      assert.ok(
        !timeline.layers.some((layer) => ['impact', 'return', 'self'].includes(layer.role)),
        `${name} ${outcome}`,
      );
    }
  }
  const hit = buildSpriteTimeline(cueFor('Dream Eater'), scene);
  const returning = hit.layers.filter((layer) => layer.role === 'return');
  assert.ok(returning.length > 0);
  assert.ok(returning.every((layer) => layer.from.x > layer.to.x));
  assert.ok(
    returning.every(
      (layer) =>
        JSON.stringify(layer.to) === JSON.stringify(rounded(scene.actors.player.anchors.body)),
    ),
  );
  const reversed = buildSpriteTimeline(cueFor('Leech Life', 'rival'), scene).layers.filter(
    (layer) => layer.role === 'return',
  );
  assert.ok(reversed.every((layer) => layer.from.x < layer.to.x));
});

test('charge and self-moves stay with their caster; Fly release dives toward the opponent', () => {
  for (const name of ['Fly', 'Solar Beam']) {
    for (const side of ['player', 'rival'] as const) {
      const charge = buildSpriteTimeline(cueFor(name, side, 'charge'), scene);
      assert.deepEqual(charge.target, charge.source);
      assert.ok(charge.layers.every((layer) => layer.role === 'self'));
    }
  }
  for (const name of ['Recover', 'Rest', 'Agility', 'Harden', 'Swords Dance']) {
    const self = buildSpriteTimeline(cueFor(name, 'rival'), scene);
    assert.deepEqual(self.target, self.source);
    assert.ok(self.layers.every((layer) => layer.role === 'self'));
  }
  const fly = buildSpriteTimeline(cueFor('Fly'), scene);
  const dive = fly.layers.find((layer) => layer.role === 'travel')!;
  assert.ok(dive.from.y < fly.source.y);
  assert.deepEqual(dive.to, fly.target);
  assert.equal(fly.script.motion, 'leap');
});

test('renderer uses raster source crops and one static cue for reduced motion', () => {
  const cue = cueFor('Hydro Pump');
  const markup = renderToStaticMarkup(createElement(BattleEffects, { cue, scene }));
  assert.ok(markup.includes('sheet-02.png'));
  assert.ok(markup.includes('data-sprite-frame="0"'));
  assert.ok(!markup.includes('<svg'));
  assert.ok(!markup.includes('NaN'));
  const reduced = renderToStaticMarkup(
    createElement(BattleEffects, { cue, scene, reducedMotion: true }),
  );
  assert.ok(reduced.includes('pixel-vfx-reduced-cue'));
  assert.ok(!reduced.includes('pixel-vfx-particle'));
  assert.equal((reduced.match(/data-sprite-frame/g) || []).length, 1);
});

test('effect preloading decodes each sheet once and retries a failed load', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const created: string[] = [];
  let fail = true;
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    src = '';
    decode() {
      created.push(this.src);
      return this.src.includes('sheet-05') && fail
        ? Promise.reject(new Error('offline'))
        : Promise.resolve();
    }
  }
  Object.defineProperty(globalThis, 'Image', {
    configurable: true,
    writable: true,
    value: FakeImage,
  });
  try {
    await Promise.all([
      preloadEffectSprites(['Ember', 'Fire Blast']),
      preloadEffectSprites(['Hyper Beam']),
    ]);
    assert.equal(created.filter((url) => url.includes('sheet-01')).length, 1);
    await assert.rejects(preloadEffectSprites(['Scratch']), /could not load/);
    fail = false;
    await preloadEffectSprites(['Scratch']);
    await preloadEffectSprites(['Slash']);
    assert.equal(
      created.filter((url) => url.includes('sheet-05')).length,
      2,
      'The rejected promise is evicted, the successful retry stays cached',
    );
  } finally {
    if (original) Object.defineProperty(globalThis, 'Image', original);
    else Reflect.deleteProperty(globalThis, 'Image');
  }
});
