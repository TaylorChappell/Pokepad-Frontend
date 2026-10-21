import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BattleEffects } from '../src/components/BattleEffects';
import { createBattleScene, type BattleScene } from '../src/battle/geometry';
import { getBattleCue, PRESENTED_MOVES, type BattleCue } from '../src/battle/presentation';
import {
  MOVE_SPRITE_SCRIPTS,
  buildSpriteTimeline,
  bindSpriteTimeline,
  effectCueElapsed,
  getMoveSpriteScript,
  preloadEffectSprites,
  resolveEffectAnchors,
  sampleSpriteLayer,
} from '../src/battle/effect-sprites';
import { NATIVE_EFFECT_ASSETS, nativeMoveAssetIds } from '../src/battle/native-effect-art';
import { snapNativePoint } from '../src/battle/native-effect-renderer';
import { compileNativeEffects } from '../src/battle/native-effect-scene';
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
  const dive = fly.layers.filter((layer) => layer.role === 'travel')[1];
  assert.deepEqual(dive.from, fly.source, 'The actual airborne body frame supplies Fly’s height');
  assert.deepEqual(dive.to, fly.target);
  assert.equal(fly.script.motion, 'leap');
});

test('renderer provides three native pixel planes and a static reduced-motion cue', () => {
  const cue = cueFor('Hydro Pump');
  const markup = renderToStaticMarkup(createElement(BattleEffects, { cue, scene }));
  assert.equal((markup.match(/<canvas/g) || []).length, 3);
  assert.ok(markup.includes('data-depth="rear"'));
  assert.ok(markup.includes('data-depth="middle"'));
  assert.ok(markup.includes('data-depth="front"'));
  assert.ok(!markup.includes('sheet-02.png'));
  assert.ok(!markup.includes('rotate('));
  const fractional = { ...scene, width: 900.4, height: 460.6 };
  const sized = renderToStaticMarkup(createElement(BattleEffects, { cue, scene: fractional }));
  assert.ok(
    sized.includes('width:900px;height:461px'),
    'Canvas display does not stretch to fractional field pixels',
  );
  assert.ok(!markup.includes('NaN'));
  const timeline = buildSpriteTimeline(cue, scene);
  const reduced = compileNativeEffects(timeline, cue, scene, scene, 0, true);
  assert.equal(reduced.sprites.length, 1);
  assert.equal(reduced.beams.length, 0);
  assert.ok(NATIVE_EFFECT_ASSETS[reduced.sprites[0].assetId]);
});

test('effect preloading decodes native source art once and retries a failed load', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const created: string[] = [];
  let fail = true;
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    src = '';
    decode() {
      created.push(this.src);
      return this.src.includes('/scratch.svg') && fail
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
    assert.equal(created.filter((url) => url.includes('/ember.svg')).length, 1);
    await assert.rejects(preloadEffectSprites(['Scratch']), /could not load/);
    fail = false;
    await preloadEffectSprites(['Scratch']);
    await preloadEffectSprites(['Scratch']);
    assert.equal(
      created.filter((url) => url.includes('/scratch.svg')).length,
      2,
      'The rejected promise is evicted, the successful retry stays cached',
    );
  } finally {
    if (original) Object.defineProperty(globalThis, 'Image', original);
    else Reflect.deleteProperty(globalThis, 'Image');
  }
});

// Deliberately distinct, changing head/hand/body offsets expose incorrect source bindings.
const movingSceneAt = (elapsedMs: number): BattleScene => {
  const result = structuredClone(scene);
  for (const side of ['player', 'rival'] as const) {
    const phase = Math.floor(elapsedMs / 75);
    const direction = side === 'player' ? 1 : -1;
    for (const [index, anchor] of ['mouth', 'hand', 'cannon', 'body', 'feet', 'crown'].entries()) {
      const p = result.actors[side].anchors[anchor as keyof typeof result.actors.player.anchors];
      p.x += direction * phase * (index + 1);
      p.y -= phase * (index + 2);
    }
  }
  return result;
};

test('projectiles retain exact emission and arrival frame anchors after the body moves again', () => {
  for (const side of ['player', 'rival'] as const) {
    const cue = cueFor('Ember', side);
    const raw = buildSpriteTimeline(cue, scene);
    const bound = bindSpriteTimeline(raw, cue, scene, movingSceneAt);
    const original = raw.layers.find((layer) => layer.role === 'travel')!;
    const shot = bound.layers.find((layer) => layer.key === original.key)!;
    assert.ok(shot.delay >= Math.floor(cue.durationMs * raw.script.releaseAt));
    assert.deepEqual(shot.from, resolveEffectAnchors(cue, movingSceneAt(shot.delay)).source);
    const arrival = resolveEffectAnchors(cue, movingSceneAt(shot.delay + shot.duration)).target;
    assert.deepEqual(shot.to, {
      x: original.to.x + arrival.x - raw.target.x,
      y: original.to.y + arrival.y - raw.target.y,
    });
    const midpoint = shot.delay + shot.duration * 0.4;
    const first = sampleSpriteLayer(shot, bound, cue, scene, movingSceneAt(midpoint), midpoint);
    const laterBody = sampleSpriteLayer(
      shot,
      bound,
      cue,
      scene,
      movingSceneAt(cue.durationMs),
      midpoint,
    );
    assert.deepEqual(first, laterBody, 'A fired particle is not pulled around by a later pose');
  }
});

test('beam and vine endpoints track current pose anchors throughout emission', () => {
  for (const name of ['Flamethrower', 'Hydro Pump', 'Lick', 'Vine Whip', 'String Shot']) {
    for (const side of ['player', 'rival'] as const) {
      const cue = cueFor(name, side);
      const timeline = bindSpriteTimeline(
        buildSpriteTimeline(cue, scene),
        cue,
        scene,
        movingSceneAt,
      );
      const chain = timeline.layers.filter((layer) => layer.space === 'tether');
      const first = chain[0],
        last = chain.at(-1)!;
      assert.ok(
        first.delay + first.duration >= last.delay + last.duration - 1,
        `${name}: source remains during the beam`,
      );
      const now = cue.durationMs * 0.78;
      const current = movingSceneAt(now);
      const anchors = resolveEffectAnchors(cue, current);
      const start = sampleSpriteLayer(first, timeline, cue, scene, current, now);
      const end = sampleSpriteLayer(last, timeline, cue, scene, current, now);
      assert.deepEqual(
        start.position,
        snapNativePoint(anchors.source, start.pixelScale, start.gridOrigin),
        `${name}: live source`,
      );
      assert.deepEqual(
        end.position,
        snapNativePoint(anchors.target, end.pixelScale, end.gridOrigin),
        `${name}: live target`,
      );
      assert.ok(start.opacity > 0 && end.opacity > 0, `${name}: no detached tail`);
    }
  }
});

test('life return uses the receiver body landmark and ground attacks remain on the field', () => {
  const cue = cueFor('Dream Eater');
  const raw = buildSpriteTimeline(cue, scene);
  const bound = bindSpriteTimeline(raw, cue, scene, movingSceneAt);
  const returning = bound.layers.find((layer) => layer.role === 'return')!;
  assert.deepEqual(
    returning.to,
    rounded(movingSceneAt(returning.delay + returning.duration).actors.player.anchors.body),
  );
  const quakeCue = cueFor('Earthquake');
  const quake = bindSpriteTimeline(
    buildSpriteTimeline(quakeCue, scene),
    quakeCue,
    scene,
    movingSceneAt,
  );
  for (const layer of quake.layers) {
    const now = layer.delay + layer.duration / 2;
    assert.equal(layer.space, 'ground');
    assert.deepEqual(
      sampleSpriteLayer(layer, quake, quakeCue, scene, scene, now),
      sampleSpriteLayer(layer, quake, quakeCue, scene, movingSceneAt(now), now),
      'Ground cracks cannot float upward with a raised foot',
    );
  }
});

test('the shared cue epoch catches up delayed mounts and all 48 move launches follow body release', () => {
  assert.equal(effectCueElapsed(400, 150, 1000), 250);
  assert.equal(effectCueElapsed(140, 150, 1000), 0);
  assert.equal(effectCueElapsed(1500, 150, 1000), 1000);
  for (const name of PRESENTED_MOVES) {
    const cue = cueFor(name);
    const timeline = buildSpriteTimeline(cue, scene);
    assert.equal(timeline.script.releaseAt, 0.13);
    if (cue.target === 'self') continue;
    for (const layer of timeline.layers.filter((entry) => entry.role === 'travel')) {
      assert.ok(layer.delay >= Math.floor(cue.durationMs * timeline.script.releaseAt), name);
    }
  }
});

test('native choreography uses connected beams, single complete tethers and straddled area clips', () => {
  for (const name of PRESENTED_MOVES) {
    for (const side of ['player', 'rival'] as const) {
      for (const outcome of ['hit', 'miss', 'immune', 'charge'] as const) {
        const cue = cueFor(name, side, outcome),
          timeline = buildSpriteTimeline(cue, scene);
        for (const phase of [0.2, 0.5, 0.78]) {
          const compiled = compileNativeEffects(
            timeline,
            cue,
            scene,
            scene,
            cue.durationMs * phase,
          );
          for (const command of compiled.sprites) {
            assert.ok(NATIVE_EFFECT_ASSETS[command.assetId], name);
            assert.ok(Number.isInteger(command.paint.pixelScale));
            assert.ok(command.paint.frameIndex < NATIVE_EFFECT_ASSETS[command.assetId].frameCount);
            if ((outcome === 'miss' || outcome === 'immune') && cue.target !== 'self')
              assert.ok(!['impact', 'return', 'self'].includes(command.role), `${name}:${outcome}`);
          }
        }
      }
    }
  }
  const fire = cueFor('Flamethrower'),
    fireTime = buildSpriteTimeline(fire, scene);
  const beam = compileNativeEffects(fireTime, fire, scene, scene, fire.durationMs * 0.5);
  assert.equal(beam.beams.length, 1);
  assert.ok(
    beam.sprites.filter((s) => s.role === 'travel').length <= 1,
    'No chain of flame stamps',
  );
  for (const name of ['Fire Spin', 'Night Shade', 'Rock Slide']) {
    const cue = cueFor(name),
      timeline = buildSpriteTimeline(cue, scene);
    const compiled = compileNativeEffects(timeline, cue, scene, scene, cue.durationMs * 0.82);
    assert.ok(
      compiled.sprites.some((s) => s.assetId.endsWith('_back') && s.depth === 'rear'),
      name,
    );
    assert.ok(
      compiled.sprites.some((s) => s.assetId.endsWith('_front') && s.depth === 'middle'),
      name,
    );
  }
  assert.ok(nativeMoveAssetIds('Flamethrower').every((id) => NATIVE_EFFECT_ASSETS[id]));
});

test('equal-size actors keep impact pixels on the victim lattice and reduced misses stay at source', () => {
  const equal = structuredClone(scene);
  equal.actors.player.pixelScale = 6;
  equal.actors.rival.pixelScale = 6;
  equal.actors.player.origin = { x: -22, y: 95 };
  equal.actors.rival.origin = { x: 442, y: -41 };
  const cue = cueFor('Ember');
  const timeline = buildSpriteTimeline(cue, equal);
  const effect = compileNativeEffects(timeline, cue, equal, equal, cue.durationMs * 0.76);
  const impact = effect.sprites.find((s) => s.role === 'impact')!;
  assert.deepEqual(impact.paint.gridOrigin, equal.actors.rival.origin);
  for (const outcome of ['miss', 'immune'] as const) {
    const failed = cueFor('Ember', 'player', outcome);
    const reduced = compileNativeEffects(
      buildSpriteTimeline(failed, equal),
      failed,
      equal,
      equal,
      0,
      true,
    );
    assert.equal(reduced.sprites[0].role, 'release');
    assert.deepEqual(reduced.sprites[0].paint.gridOrigin, equal.actors.player.origin);
  }
});

test('native tethers reach the current target in either direction and small swords orbit at actor scale', () => {
  for (const name of ['Vine Whip', 'Lick'])
    for (const side of ['player', 'rival'] as const) {
      const cue = cueFor(name, side),
        timeline = buildSpriteTimeline(cue, scene);
      const compiled = compileNativeEffects(timeline, cue, scene, scene, cue.durationMs * 0.76);
      assert.equal(compiled.tethers.length, 1);
      assert.equal(compiled.tethers[0].progress, 1);
      const anchors = resolveEffectAnchors(cue, scene);
      assert.deepEqual(compiled.tethers[0].source, anchors.source);
      assert.deepEqual(compiled.tethers[0].target, anchors.target);
    }
  const cue = cueFor('Swords Dance'),
    timeline = buildSpriteTimeline(cue, scene);
  const compiled = compileNativeEffects(timeline, cue, scene, scene, cue.durationMs * 0.4);
  assert.equal(compiled.sprites.length, 3);
  assert.ok(compiled.sprites.every((s) => s.assetId === 'sword_lightblue'));
  assert.equal(new Set(compiled.sprites.map((s) => s.depth)).size, 2);
  const harden = cueFor('Harden');
  const guarded = compileNativeEffects(
    buildSpriteTimeline(harden, scene),
    harden,
    scene,
    scene,
    harden.durationMs * 0.4,
  );
  assert.equal(guarded.sprites.length, 3);
  assert.ok(guarded.sprites.every((s) => NATIVE_EFFECT_ASSETS[s.assetId].frameWidth <= 16));
  assert.ok(
    guarded.sprites.every(
      (s) => s.clip === scene.actors.player.activeBounds || s.clip === scene.actors.player.bounds,
    ),
  );
});
