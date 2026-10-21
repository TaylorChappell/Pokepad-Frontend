import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BattleSprite } from '../src/battle/BattleSprite';
import {
  createBattleScene,
  getBattleIdleFrames,
  getBattleMotionVector,
  getBattlePoseFrames,
  type BattleActorGeometry,
} from '../src/battle/geometry';
import { BATTLE_PIXEL_BOUNDS } from '../src/battle/sprite-geometry';
import { getMoveSpriteScript } from '../src/battle/effect-sprites';
import { PRESENTED_MOVES } from '../src/battle/presentation';

const fields = [
  [1000, 600],
  [1000, 340],
  [390, 400],
  [800, 180],
  [280, 240],
  [1600, 800],
];
const sides = ['player', 'rival'] as const;
const tolerance = 0.00001;
const translation = (frame: Keyframe) => {
  const values = String(frame.transform)
    .match(/-?[\d.]+/g)
    ?.map(Number);
  assert.equal(values?.length, 2, 'A pose only translates; it cannot stretch the native pixels');
  assert.ok(values!.every(Number.isFinite));
  return values!;
};
const withinField = (actor: BattleActorGeometry, width: number, height: number, x = 0, y = 0) => {
  const b = actor.bounds;
  assert.ok(b.x + x >= -tolerance, `${actor.speciesId}/${actor.side} left edge`);
  assert.ok(b.y + y >= -tolerance, `${actor.speciesId}/${actor.side} upper edge`);
  assert.ok(b.x + b.width + x <= width + tolerance, `${actor.speciesId}/${actor.side} right edge`);
  assert.ok(
    b.y + b.height + y <= height + tolerance,
    `${actor.speciesId}/${actor.side} lower edge`,
  );
};

test('all 151 native front/back and shiny sprites fit the field and stand on their shared platform', () => {
  for (const view of Object.values(BATTLE_PIXEL_BOUNDS)) assert.equal(view.length, 151);
  for (const [width, height] of fields) {
    for (let speciesId = 1; speciesId <= 151; speciesId++) {
      for (const shiny of [false, true]) {
        const scene = createBattleScene({
          width,
          height,
          player: { speciesId, shiny },
          rival: { speciesId, shiny },
        });
        for (const side of sides) {
          const actor = scene.actors[side];
          withinField(actor, width, height);
          assert.ok(Math.abs(actor.anchors.feet.x - actor.ground.x) < tolerance);
          const lift = actor.idle === 'hover' ? height * 0.022 : 0;
          assert.ok(Math.abs(actor.anchors.feet.y + lift - actor.ground.y) < tolerance);
          for (const anchor of Object.values(actor.anchors)) {
            assert.ok(Number.isFinite(anchor.x) && Number.isFinite(anchor.y));
            assert.ok(anchor.x >= actor.bounds.x - tolerance);
            assert.ok(anchor.y >= actor.bounds.y - tolerance);
            assert.ok(anchor.x <= actor.bounds.x + actor.bounds.width + tolerance);
            assert.ok(anchor.y <= actor.bounds.y + actor.bounds.height + tolerance);
          }
          for (const frame of getBattleIdleFrames(actor)) {
            const [x, y] = translation(frame);
            withinField(actor, width, height, x, y);
          }
        }
      }
    }
  }
});

test('every move pose keeps every species fully visible across desktop, phone and landscape fields', () => {
  assert.equal(PRESENTED_MOVES.length, 48);
  for (const [width, height] of fields) {
    for (let speciesId = 1; speciesId <= 151; speciesId++) {
      const scene = createBattleScene({
        width,
        height,
        player: { speciesId },
        rival: { speciesId: 152 - speciesId },
      });
      for (const side of sides) {
        const actor = scene.actors[side];
        for (const name of PRESENTED_MOVES) {
          const script = getMoveSpriteScript(name);
          const frames = getBattlePoseFrames(actor, {
            motion: script.motion,
            impactAt: script.impactAt,
            vector: getBattleMotionVector(scene, side, script.motion),
          });
          assert.deepEqual(translation(frames[0]), [0, 0]);
          assert.deepEqual(translation(frames.at(-1)!), [0, 0]);
          let offset = -1;
          for (const frame of frames) {
            assert.ok(Number.isFinite(frame.offset));
            assert.ok(frame.offset! >= offset && frame.offset! <= 1);
            offset = frame.offset!;
            const [x, y] = translation(frame);
            withinField(actor, width, height, x, y);
            if (script.motion === 'beam')
              assert.deepEqual(
                [x, y],
                [0, 0],
                'Beams remain attached during their complete emission',
              );
          }
        }
      }
    }
  }
});

test('native crop, anatomy origins and idle profiles differ with the species, not with shiny color', () => {
  const scene = createBattleScene({ player: { speciesId: 9 }, rival: { speciesId: 1 } });
  assert.notDeepEqual(scene.actors.player.anchors.cannon, scene.actors.player.anchors.mouth);
  assert.notDeepEqual(scene.actors.rival.anchors.crown, scene.actors.rival.anchors.mouth);
  assert.deepEqual(
    scene.actors.player,
    createBattleScene({ player: { speciesId: 9, shiny: true }, rival: { speciesId: 1 } }).actors
      .player,
  );
  const flying = createBattleScene({ player: { speciesId: 144 }, rival: { speciesId: 95 } });
  assert.equal(flying.actors.player.idle, 'hover');
  assert.equal(flying.actors.rival.idle, 'serpent');
  assert.notDeepEqual(scene.actors.player.rect, flying.actors.player.rect);
  const markup = renderToStaticMarkup(
    createElement(BattleSprite, {
      speciesId: 9,
      side: 'player',
      shiny: true,
      actor: scene.actors.player,
    }),
  );
  assert.ok(markup.includes('back-shiny.svg'));
  assert.ok(markup.includes('data-facing="back"'));
  assert.ok(markup.includes('battle-sprite-pose'));
  assert.ok(markup.includes('battle-sprite-pixels'));
  assert.ok(!markup.includes('scale('), 'Native sprite is never distorted to fake an attack');
});
