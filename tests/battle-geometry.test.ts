import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createBattleScene,
  getBattleActorGeometry,
  bodyPointOnField,
  sampleBattleSceneAt,
} from '../src/battle/geometry';
import {
  getBodyPreviewManifest,
  getBodyView,
  getBodyFrameAt,
  normalizeBodyManifest,
  type BodyRect,
  type BodyManifest,
} from '../src/battle/body-animation';
import { getBattleCue, PRESENTED_MOVES } from '../src/battle/presentation';

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
const manifests = new Map<number, BodyManifest>();
function body(speciesId: number) {
  if (!manifests.has(speciesId)) {
    const raw = JSON.parse(
      readFileSync(
        new URL(
          `../public/assets/battle/pmd/${String(speciesId).padStart(3, '0')}.json`,
          import.meta.url,
        ),
        'utf8',
      ),
    );
    manifests.set(speciesId, normalizeBodyManifest(raw));
  }
  return manifests.get(speciesId)!;
}
function assertRectFits(rect: BodyRect, width: number, height: number, label: string) {
  assert.ok(rect.every(Number.isFinite), label);
  assert.ok(rect[0] >= -tolerance && rect[1] >= -tolerance, label + ' top/left');
  assert.ok(rect[0] + rect[2] <= width + tolerance, label + ' right');
  assert.ok(rect[1] + rect[3] <= height + tolerance, label + ' bottom');
}

test('all151 PMD bodies retain every real animation pixel at one scale in six field shapes', () => {
  for (let speciesId = 1; speciesId <= 151; speciesId++) {
    const manifest = body(speciesId);
    for (const [width, height] of fields) {
      for (const side of sides) {
        let normalScale = 0;
        for (const shiny of [false, true]) {
          const actor = getBattleActorGeometry(speciesId, side, width, height, shiny, manifest);
          const view = getBodyView(manifest, side, shiny);
          const label = `${speciesId}/${side}/${shiny}/${width}x${height}`;
          assert.ok(actor.pixelScale > 0 && Number.isFinite(actor.pixelScale));
          if (shiny) assert.equal(actor.pixelScale, normalScale, label + ' palette scale');
          else normalScale = actor.pixelScale;
          assertRectFits(
            [actor.bounds.x, actor.bounds.y, actor.bounds.width, actor.bounds.height],
            width,
            height,
            label,
          );
          const pivot = bodyPointOnField(actor, view.contact);
          assert.ok(Math.abs(pivot.x - actor.ground.x) < tolerance, label + ' platform x');
          assert.ok(Math.abs(pivot.y - actor.ground.y) < tolerance, label + ' platform y');
          for (const clip of Object.values(view.clips)) {
            for (const frame of clip.frames) {
              const [x, y, w, h] = frame.bounds;
              const point = bodyPointOnField(actor, [x, y]);
              assertRectFits(
                [point.x, point.y, w * actor.pixelScale, h * actor.pixelScale],
                width,
                height,
                label + '/' + clip.action,
              );
            }
          }
          const preview = getBattleActorGeometry(
            speciesId,
            side,
            width,
            height,
            shiny,
            getBodyPreviewManifest(speciesId),
          );
          assert.deepEqual(preview.rect, actor.rect, label + ' no jump after metadata loads');
        }
      }
    }
  }
});

test('all48 moves use current real body-frame anchors while ground and body scale remain fixed', () => {
  for (let speciesId = 1; speciesId <= 151; speciesId++) {
    const manifest = body(speciesId);
    const scene = createBattleScene({
      player: { speciesId, manifest },
      rival: { speciesId, manifest, shiny: true },
    });
    for (const name of PRESENTED_MOVES) {
      for (const side of sides) {
        const cue = getBattleCue({
          kind: 'move',
          side,
          moveName: name,
          movePhase: 'release',
          text: '',
        })!;
        for (const elapsed of [
          0,
          cue.durationMs * 0.13,
          cue.durationMs * 0.5,
          cue.durationMs * 0.8,
          cue.durationMs,
        ]) {
          const sampled = sampleBattleSceneAt(scene, cue, elapsed);
          for (const actorSide of sides) {
            const actor = sampled.actors[actorSide];
            const frame = getBodyFrameAt(manifest, {
              side: actorSide,
              shiny: actorSide === 'rival',
              cue,
              elapsedMs: elapsed,
            }).frame;
            assert.deepEqual(actor.rect, scene.actors[actorSide].rect);
            assert.deepEqual(actor.ground, scene.actors[actorSide].ground);
            for (const anchor of Object.keys(actor.anchors) as Array<keyof typeof actor.anchors>) {
              assert.deepEqual(
                actor.anchors[anchor],
                bodyPointOnField(actor, frame.anchors[anchor]),
              );
            }
          }
        }
      }
    }
  }
});

test('reduced motion samples the same static pose for both body and effect anchors', () => {
  const manifest = body(9);
  const scene = createBattleScene({
    player: { speciesId: 9, manifest },
    rival: { speciesId: 9, manifest },
  });
  const cue = getBattleCue({
    kind: 'move',
    side: 'player',
    moveName: 'Hydro Pump',
    movePhase: 'release',
    text: '',
  })!;
  const frozen = sampleBattleSceneAt(scene, cue, 500, true);
  const frame = getBodyFrameAt(manifest, {
    side: 'player',
    cue,
    elapsedMs: 500,
    reducedMotion: true,
  }).frame;
  assert.deepEqual(
    frozen.actors.player.anchors.cannon,
    bodyPointOnField(scene.actors.player, frame.anchors.cannon),
  );
  assert.deepEqual(frozen.actors.player.ground, scene.actors.player.ground);
});
