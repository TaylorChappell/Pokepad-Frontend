import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import React, { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { BattleEffects } from '../src/components/BattleEffects';
import { createBattle, createPlayerTeam, resolveTurn } from '../src/battle/engine';
import { createBattlePlayback, getBattleCue, PRESENTED_MOVES } from '../src/battle/presentation';
import { sampleBodyTransition } from '../src/battle/body-transition';
import { sampleSwitchVisual } from '../src/battle/switch-presentation';
import { normalizeBodyManifest, type PmdManifest } from '../src/battle/body-animation';
import { createBattleScene, sampleBattleSceneAt } from '../src/battle/geometry';
import {
  bindSpriteTimeline,
  buildSpriteTimeline,
  sampleSpriteLayer,
} from '../src/battle/effect-sprites';
import {
  NATIVE_MOVE_ART,
  NATIVE_EFFECT_ASSETS,
  NATIVE_EFFECT_SOURCE,
  NATIVE_TRANSITION_ART,
  nativeMoveAssetIds,
} from '../src/battle/native-effect-art';
import type { OwnedPokemon } from '../src/types';
import {
  paintNativeEffectBeam,
  paintNativeEffectSprite,
  type NativeCanvasFactory,
} from '../src/battle/native-effect-renderer';
import { compileNativeEffects } from '../src/battle/native-effect-scene';

const owned = (speciesId: number, moves: string[], level = 30): OwnedPokemon => ({
  id: `integration-${speciesId}`,
  speciesId,
  level,
  moves,
  rareCandy: 0,
  backing: 0.1,
  evolutionReserve: 0,
  moveOffers: [],
  originCoin: 'poke',
  rarity: 'Standard',
  acquiredAt: 1,
});

test('every move and switch uses unchanged native source pixels with matching atlas crops', () => {
  assert.deepEqual(Object.keys(NATIVE_MOVE_ART).sort(), [...PRESENTED_MOVES].sort());
  const used = new Set([
    ...PRESENTED_MOVES.flatMap(nativeMoveAssetIds),
    ...Object.values(NATIVE_TRANSITION_ART).flatMap((art) => [art.asset, art.ring]),
  ]);
  const attributes = (value: string) =>
    Object.fromEntries(
      [...value.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]),
    );
  for (const id of used) {
    const asset = NATIVE_EFFECT_ASSETS[id] as (typeof NATIVE_EFFECT_ASSETS)[string] & {
      sourceSha256: string;
      sourceCommit: string;
    };
    assert.ok(asset, `Native art exists for ${id}`);
    assert.match(asset.path, /^battle\/effects\/pmd\/[^/]+\.svg$/);
    assert.equal(asset.sourceCommit, NATIVE_EFFECT_SOURCE.commit);
    const svg = readFileSync(new URL('../public/assets/' + asset.path, import.meta.url), 'utf8');
    const original = svg.match(/<image\b[^>]*href="data:image\/png;base64,([^\"]+)"/);
    assert.ok(original, `${id} embeds the original native sheet`);
    assert.equal(
      createHash('sha256').update(Buffer.from(original[1], 'base64')).digest('hex'),
      asset.sourceSha256,
    );
    const crops = [...svg.matchAll(/<svg\b([^>]+)>\s*<use\b([^>]+)\/>\s*<\/svg>/g)].map(
      (match) => ({ ...attributes(match[1]), source: attributes(match[2]).href }),
    );
    for (const frame of asset.frames.flat()) {
      const crop = crops.find(
        (entry) => Number(entry.x) === frame.x && Number(entry.y) === frame.y,
      );
      assert.ok(crop, `${id}: rendered native frame`);
      assert.equal(crop.source, '#source');
      assert.deepEqual(crop.viewBox.split(' ').map(Number), [
        frame.sourceX,
        frame.sourceY,
        frame.width,
        frame.height,
      ]);
      assert.ok(frame.offsetX >= 0 && frame.offsetY >= 0);
      assert.ok(frame.offsetX + frame.width <= asset.frameWidth);
      assert.ok(frame.offsetY + frame.height <= asset.frameHeight);
    }
  }
});

test('the final native painter keeps rotated sprites and perspective beams on whole pixel blocks', () => {
  // A recording canvas checks the final paint boundary, independently of CSS or
  // logical timeline sizes. Opaque sample pixels make every beam block observable.
  const factory: NativeCanvasFactory = (width, height) => {
    const context = {
      imageSmoothingEnabled: true,
      drawImage() {},
      translate() {},
      rotate() {},
      scale() {},
      putImageData() {},
      getImageData: () => ({
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4).fill(255),
      }),
    };
    return { width, height, getContext: () => context } as unknown as HTMLCanvasElement;
  };
  const rectangles: number[][] = [];
  const images: unknown[][] = [];
  const context = {
    imageSmoothingEnabled: true,
    save() {},
    restore() {},
    drawImage: (...args: unknown[]) => images.push(args),
    fillRect: (...args: number[]) => rectangles.push(args),
  } as unknown as CanvasRenderingContext2D;
  for (const direction of [0, 1, 3, 5, 7]) {
    paintNativeEffectSprite(
      context,
      {} as CanvasImageSource,
      NATIVE_EFFECT_ASSETS.scratch,
      { direction, frameIndex: 1, pixelScale: 3, x: 103.4, y: 57.8, gridOrigin: { x: 1, y: 2 } },
      factory,
    );
    const [canvas, x, y, width, height] = images.at(-1)! as [
      HTMLCanvasElement,
      number,
      number,
      number,
      number,
    ];
    assert.equal(width, canvas.width * 3);
    assert.equal(height, canvas.height * 3);
    assert.equal(Math.abs((x - 1) % 3), 0);
    assert.equal(Math.abs((y - 2) % 3), 0);
    assert.equal(context.imageSmoothingEnabled, false);
  }
  for (const sourceScale of [2, 4]) {
    rectangles.length = 0;
    paintNativeEffectBeam(
      context,
      {} as CanvasImageSource,
      NATIVE_EFFECT_ASSETS.beam_column_red_body,
      {
        source: { x: 25, y: 120 },
        target: { x: 300, y: 30 },
        sourceScale,
        targetScale: 6 - sourceScale,
        sourceGrid: { x: 1, y: 2 },
        targetGrid: { x: 3, y: 1 },
        frameIndex: 3,
        progress: 1,
        phase: 2,
        style: 'fire',
      },
      factory,
    );
    assert.ok(rectangles.length > 100, 'A continuous beam is painted from native pixel blocks');
    for (const [x, y, width, height] of rectangles) {
      assert.ok(Number.isInteger(x) && Number.isInteger(y));
      assert.ok(Number.isInteger(width) && width >= 2 && width <= 4);
      assert.equal(width, height, 'Perspective never stretches source pixels into thin rectangles');
    }
    assert.deepEqual([...new Set(rectangles.map((rect) => rect[2]))].sort(), [2, 3, 4]);
  }
});

test('all 48 moves preserve the actors’ pixel scale and depth in both attack directions', () => {
  for (const [width, height] of [
    [1000, 600],
    [900, 460],
    [560, 320],
  ]) {
    const scene = createBattleScene({
      width,
      height,
      player: { speciesId: 6 },
      rival: { speciesId: 68 },
    });
    const scales = Object.values(scene.actors).map((actor) => actor.pixelScale);
    for (const side of ['player', 'rival'] as const) {
      for (const moveName of PRESENTED_MOVES) {
        const cue = getBattleCue({ kind: 'move', side, moveName, text: moveName })!;
        const timeline = bindSpriteTimeline(
          buildSpriteTimeline(cue, scene),
          cue,
          scene,
          (elapsed) => sampleBattleSceneAt(scene, cue, elapsed),
        );
        for (const layer of timeline.layers) {
          const elapsed = layer.delay + layer.duration / 2;
          const sampled = sampleSpriteLayer(
            layer,
            timeline,
            cue,
            scene,
            sampleBattleSceneAt(scene, cue, elapsed),
            elapsed,
          );
          assert.ok(Number.isInteger(sampled.pixelScale), `${moveName}: integer source pixels`);
          assert.ok(
            sampled.pixelScale >= Math.min(...scales) && sampled.pixelScale <= Math.max(...scales),
            `${moveName}: consistent near/far perspective`,
          );
          assert.equal(
            Math.abs((sampled.position.x - Math.round(sampled.gridOrigin.x)) % sampled.pixelScale),
            0,
          );
          assert.equal(
            Math.abs((sampled.position.y - Math.round(sampled.gridOrigin.y)) % sampled.pixelScale),
            0,
          );
          assert.ok(['rear', 'middle', 'front'].includes(sampled.depth));
          if (layer.role === 'impact' && layer.space === 'target' && cue.targetSide !== side)
            assert.equal(
              sampled.depth,
              cue.targetSide === 'player' ? 'front' : 'middle',
              `${moveName}: impact is in front of its target`,
            );
        }
        let commands = 0;
        for (const progress of [0.2, 0.4, 0.6, 0.8]) {
          const elapsed = cue.durationMs * progress;
          const current = sampleBattleSceneAt(scene, cue, elapsed);
          const compiled = compileNativeEffects(timeline, cue, scene, current, elapsed);
          commands += compiled.sprites.length + compiled.beams.length;
          for (const sprite of compiled.sprites) {
            const art = NATIVE_EFFECT_ASSETS[sprite.assetId];
            assert.ok(art, `${moveName}: renderer uses a mapped native asset`);
            assert.match(art.path, /^battle\/effects\/pmd\//);
            assert.ok(Number.isInteger(sprite.paint.pixelScale));
            assert.ok(
              sprite.paint.frameIndex >= 0 && sprite.paint.frameIndex < art.frames[0].length,
            );
          }
          for (const beam of compiled.beams) {
            assert.ok(NATIVE_EFFECT_ASSETS[beam.assetId]);
            assert.equal(beam.paint.sourceScale, scene.actors[side].pixelScale);
            assert.equal(beam.paint.targetScale, scene.actors[cue.targetSide].pixelScale);
            assert.equal(
              beam.depthAt(current.actors[cue.targetSide].anchors.body),
              cue.targetSide === 'player' ? 'front' : 'middle',
              `${moveName}: beam crosses in front of its target`,
            );
          }
        }
        assert.ok(commands > 0, `${moveName}: the actual native renderer has visible commands`);
      }
    }
  }
});

test('the rendered effect planes straddle the actors and remain below the health HUD', () => {
  const scene = createBattleScene({ player: { speciesId: 6 }, rival: { speciesId: 68 } });
  const cue = getBattleCue({
    kind: 'move',
    side: 'player',
    moveName: 'Flamethrower',
    text: 'Flamethrower',
  })!;
  const markup = renderToStaticMarkup(React.createElement(BattleEffects, { cue, scene }));
  const styles = [
    'battle-screen-v8.css',
    'battle-geometry-v10.css',
    'battle-effects-v10.css',
    'battle/switch-effects.css',
  ]
    .map((path) => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8'))
    .join('\n');
  const dom =
    new JSDOM(`<style>${styles}</style><div class="battle-v8"><div class="battle-field classic-field">
    <div class="classic-ground"></div><div class="classic-fighter classic-rival battle-placed-actor"></div>
    <div class="classic-fighter classic-player battle-placed-actor"></div><div class="classic-health classic-health-player"></div>
    ${markup}<div class="battle-switch-effects"></div></div></div>`);
  try {
    const field = dom.window.document.querySelector('.classic-field')!;
    const planes = [...field.querySelectorAll('canvas.pixel-battle-effects')];
    assert.equal(planes.length, 3);
    assert.deepEqual(planes.map((plane) => plane.getAttribute('data-depth')).sort(), [
      'front',
      'middle',
      'rear',
    ]);
    for (const plane of planes)
      assert.equal(
        plane.parentElement,
        field,
        'An overlay wrapper must not trap every plane above the actors',
      );
    const z = (selector: string) =>
      Number(dom.window.getComputedStyle(field.querySelector(selector)!).zIndex);
    assert.ok(z('.classic-ground') < z('[data-depth="rear"]'));
    assert.ok(z('[data-depth="rear"]') < z('.classic-rival'));
    assert.ok(z('.classic-rival') < z('[data-depth="middle"]'));
    assert.ok(z('[data-depth="middle"]') < z('.classic-player'));
    assert.ok(z('.classic-player') < z('[data-depth="front"]'));
    assert.ok(z('[data-depth="front"]') < z('.battle-switch-effects'));
    assert.ok(
      z('.battle-switch-effects') < z('.classic-health'),
      'Neither attacks nor thrown balls cover the health panel',
    );
  } finally {
    dom.window.close();
  }
});

test('manual switching recalls the outgoing fighter before revealing the replacement', () => {
  const previous = createBattle(
    [owned(4, ['Ember']), owned(7, ['Water Gun'])],
    createPlayerTeam([owned(133, ['Growl'])]),
    'Easy',
  );
  const next = resolveTurn(previous, { kind: 'switch', index: 1 }, () => 0.5);
  const frames = createBattlePlayback(previous, next);
  const switching = frames.filter((frame) => frame.switch);
  assert.equal(switching.length, 2);
  const [recall, sendout] = switching;
  assert.equal(recall.switch!.phase, 'recall');
  assert.equal(sendout.switch!.phase, 'sendout');
  assert.equal(recall.switch!.forced, false);
  assert.equal(
    recall.displayState.player[recall.displayState.active.player].id,
    previous.player[0].id,
  );
  assert.equal(
    sendout.displayState.player[sendout.displayState.active.player].id,
    previous.player[1].id,
  );
  assert.equal(recall.switch!.outgoingId, previous.player[0].id);
  assert.equal(sendout.switch!.incomingId, previous.player[1].id);
  const recalled = { phase: 'recall' as const, startedAt: 1000, durationMs: recall.durationMs };
  const released = {
    phase: 'sendout' as const,
    startedAt: 1000 + recall.durationMs,
    durationMs: sendout.durationMs,
  };
  assert.equal(sampleBodyTransition(recalled, 0).visible, true);
  assert.equal(sampleBodyTransition(recalled, recall.durationMs).visible, false);
  assert.equal(
    sampleBodyTransition(released, 0).visible,
    false,
    'The incoming fighter is inside its travelling ball',
  );
  assert.equal(sampleBodyTransition(released, sendout.durationMs * 0.4).visible, false);
  assert.equal(sampleBodyTransition(released, sendout.durationMs * 0.65).visible, true);
  assert.equal(sampleBodyTransition(released, sendout.durationMs * 0.65).silhouette, true);
  assert.deepEqual(sampleBodyTransition(released, sendout.durationMs), {
    visible: true,
    density: 16,
    silhouette: false,
  });
  assert.equal(previous.active.player, 0, 'Playback does not mutate the engine input');
  assert.equal(next.active.player, 1);
});

test('forced switching never recalls or resurrects the already-fainted fighter', () => {
  for (const side of ['player', 'rival'] as const) {
    const previous = createBattle(
      [owned(4, ['Growl']), owned(7, ['Water Gun'])],
      createPlayerTeam([owned(133, ['Growl']), owned(1, ['Tackle'])]),
      'Easy',
    );
    previous[side][0].hp = 0;
    const next = resolveTurn(previous, { kind: 'move', index: 0 }, () => 0.5);
    const switching = createBattlePlayback(previous, next).filter((frame) => frame.switch);
    assert.equal(switching.length, 1);
    const release = switching[0];
    assert.equal(release.cue?.side, side);
    assert.equal(release.switch!.phase, 'sendout');
    assert.equal(release.switch!.forced, true);
    assert.equal(release.displayState.active[side], 1);
    assert.equal(release.displayState[side][0].hp, 0);
    assert.equal(
      sampleBodyTransition({ phase: 'sendout', startedAt: 0, durationMs: release.durationMs }, 0)
        .visible,
      false,
      'The replacement remains hidden until its own ball opens',
    );
  }
});

test('reduced motion preserves switch visibility ordering without flashing a silhouette', () => {
  for (const phase of ['recall', 'sendout'] as const) {
    const transition = { phase, startedAt: 5000, durationMs: 1000 };
    for (const elapsed of [0, 100, 440, 500, 650, 1000]) {
      const sampled = sampleBodyTransition(transition, elapsed, true);
      assert.equal(sampled.silhouette, false);
      assert.ok(
        sampled.density === 0 || sampled.density === 16,
        'Reduced motion uses a single visibility change',
      );
    }
    assert.equal(sampleBodyTransition(transition, 0, true).visible, phase === 'recall');
    assert.equal(sampleBodyTransition(transition, 1000, true).visible, phase === 'sendout');
  }
});

test('both trainers throw a closed ball that opens before the new body materializes', () => {
  const scene = createBattleScene({
    width: 1000,
    height: 600,
    player: { speciesId: 6 },
    rival: { speciesId: 68 },
  });
  for (const side of ['player', 'rival'] as const) {
    const transition = { phase: 'sendout' as const, startedAt: 1000, durationMs: 1100 };
    const visual = (progress: number, reduced = false) =>
      sampleSwitchVisual(scene, side, 'sendout', progress * 1100, 1100, reduced);
    const thrown = visual(0);
    const airborne = visual(0.2);
    const landed = visual(0.4);
    assert.equal(thrown.ball.open, 0);
    assert.equal(airborne.ball.open, 0);
    assert.notDeepEqual([thrown.ball.x, thrown.ball.y], [airborne.ball.x, airborne.ball.y]);
    assert.ok(
      airborne.ball.y < (thrown.ball.y + landed.ball.y) / 2,
      'The ball travels along an arc',
    );
    assert.ok(visual(0.46).ball.open > 0);
    assert.equal(sampleBodyTransition(transition, 1100 * 0.4).visible, false);
    assert.equal(sampleBodyTransition(transition, 1100 * 0.6).visible, true);
    assert.equal(visual(0.8).ball.opacity, 0);
    assert.equal(sampleBodyTransition(transition, 1100 * 0.8).silhouette, false);
    for (const progress of [0, 0.2, 0.4, 0.6, 0.8]) {
      const frame = visual(progress);
      assert.ok(Number.isInteger(frame.ball.x) && Number.isInteger(frame.ball.y));
      assert.ok(Number.isInteger(frame.ball.pixelScale) && frame.ball.pixelScale >= 1);
      assert.equal(frame.ball.rotation % 90, 0, 'Ball rotation preserves its pixel grid');
      assert.equal(visual(progress, true).energy.length, 0);
      assert.equal(visual(progress, true).ball.rotation, 0);
    }
    assert.deepEqual(
      [visual(0.1, true).ball.x, visual(0.1, true).ball.y],
      [visual(0.4, true).ball.x, visual(0.4, true).ball.y],
      'Reduced motion removes the throw arc',
    );
  }
});

test('cancelling a switch clears its animation and reduced-motion timer without hiding the next view', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true });
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const replace = (key: string, value: unknown) => {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Image'])
    replace(key, (dom.window as unknown as Record<string, unknown>)[key]);
  replace('IS_REACT_ACT_ENVIRONMENT', true);
  let now = 1000;
  replace('performance', { now: () => now });
  const frames = new Map<number, FrameRequestCallback>();
  const timers = new Map<number, () => void>();
  let nextId = 1;
  dom.window.requestAnimationFrame = (callback) => {
    const id = nextId++;
    frames.set(id, callback);
    return id;
  };
  dom.window.cancelAnimationFrame = (id) => {
    frames.delete(id);
  };
  dom.window.setTimeout = ((callback: () => void) => {
    const id = nextId++;
    timers.set(id, callback);
    return id;
  }) as typeof dom.window.setTimeout;
  dom.window.clearTimeout = (id) => {
    timers.delete(id);
  };
  dom.window.HTMLImageElement.prototype.decode = async () => {};
  const raw = JSON.parse(
    readFileSync(new URL('../public/assets/battle/pmd/004.json', import.meta.url), 'utf8'),
  ) as PmdManifest;
  const manifest = normalizeBodyManifest(raw);
  replace(
    'fetch',
    async () =>
      new Response(JSON.stringify(raw), { headers: { 'Content-Type': 'application/json' } }),
  );
  const { createRoot } = await import('react-dom/client');
  const { BattleSprite } = await import('../src/battle/BattleSprite');
  const root = createRoot(dom.window.document.getElementById('root')!);
  const scene = createBattleScene({ player: { speciesId: 4, manifest }, rival: { speciesId: 7 } });
  const base = {
    speciesId: 4,
    side: 'player' as const,
    manifest,
    actor: scene.actors.player,
    paused: true,
  };
  const canvas = () => dom.window.document.querySelector<HTMLElement>('.battle-body-canvas')!;
  try {
    await act(async () =>
      root.render(
        React.createElement(BattleSprite, {
          ...base,
          transition: { phase: 'recall', startedAt: 1000, durationMs: 600 },
        }),
      ),
    );
    assert.ok(frames.size > 0);
    now = 1500;
    const pending = [...frames.values()];
    frames.clear();
    await act(async () => {
      pending.forEach((callback) => callback(now));
    });
    assert.equal(canvas().style.visibility, 'hidden', 'The outgoing sprite has dissolved');
    await act(async () => root.render(React.createElement(BattleSprite, base)));
    assert.equal(frames.size, 0, 'Cancelling removes the pending animation callback');
    assert.equal(canvas().style.visibility, '', 'A cancelled recall cannot hide a later idle view');
    assert.equal(canvas().style.maskImage, '');
    assert.equal(canvas().style.filter, '');
    now = 2000;
    await act(async () =>
      root.render(
        React.createElement(BattleSprite, {
          ...base,
          reducedMotion: true,
          transition: { phase: 'sendout', startedAt: 2000, durationMs: 1100 },
        }),
      ),
    );
    assert.equal(canvas().style.visibility, 'hidden');
    assert.equal(timers.size, 1);
    await act(async () =>
      root.render(React.createElement(BattleSprite, { ...base, reducedMotion: true })),
    );
    assert.equal(timers.size, 0, 'The delayed reduced-motion reveal is cancelled too');
    assert.equal(canvas().style.visibility, '');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
