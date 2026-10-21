import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattleScene } from '../src/battle/geometry';
import { sampleSwitchVisual } from '../src/battle/switch-presentation';
import { NATIVE_EFFECT_ASSETS } from '../src/battle/native-effect-art';

// Real source alpha bounds, not CSS cell bounds, must stay visible during the throw/release.
test('all151 switch sequences retain native pixels inside six battlefield shapes', () => {
  const fields = [
    [1000, 600],
    [800, 450],
    [390, 430],
    [320, 260],
    [760, 220],
    [480, 160],
  ];
  const native = NATIVE_EFFECT_ASSETS.materialize;
  for (const [width, height] of fields) {
    for (let speciesId = 1; speciesId <= 151; speciesId++) {
      for (const shiny of [false, true]) {
        const scene = createBattleScene({
          width,
          height,
          player: { speciesId, shiny },
          rival: { speciesId, shiny },
        });
        for (const side of ['player', 'rival'] as const) {
          for (const phase of ['recall', 'sendout'] as const) {
            for (let elapsedMs = 0; elapsedMs <= 100; elapsedMs++) {
              const frame = sampleSwitchVisual(scene, side, phase, elapsedMs, 100);
              const label = `${speciesId}/${shiny}/${side}/${phase}/${elapsedMs}/${width}x${height}`;
              const { ball } = frame;
              assert.ok(Number.isInteger(ball.pixelScale), label);
              assert.equal(ball.rotation % 90, 0, label);
              // The original 30px item occupies source pixels [6,24] on each axis.
              if (ball.opacity > 0) {
                assert.ok(ball.x - 9 * ball.pixelScale >= 0, label);
                assert.ok(ball.x + 9 * ball.pixelScale <= width, label);
                assert.ok(ball.y - 9 * ball.pixelScale >= 0, label);
                assert.ok(ball.y + 9 * ball.pixelScale <= height, label);
              }
              for (const particle of frame.energy) {
                assert.ok(Number.isInteger(particle.pixelScale), label);
                if (phase === 'sendout')
                  assert.equal(
                    particle.pixelScale,
                    Math.max(1, Math.round(scene.actors[side].pixelScale)),
                    label,
                  );
                const crop = native.frames[0][particle.frameIndex];
                const x = particle.x + (crop.offsetX - native.pivot.x) * particle.pixelScale;
                const y = particle.y + (crop.offsetY - native.pivot.y) * particle.pixelScale;
                assert.ok(x >= 0 && y >= 0, label);
                assert.ok(x + crop.width * particle.pixelScale <= width, label);
                assert.ok(y + crop.height * particle.pixelScale <= height, label);
              }
            }
          }
          const landed = sampleSwitchVisual(scene, side, 'sendout', 40, 100);
          assert.equal(landed.ball.x, Math.round(scene.actors[side].ground.x));
          assert.equal(
            landed.ball.y + 9 * landed.ball.pixelScale,
            Math.round(scene.actors[side].ground.y),
          );
        }
      }
    }
  }
});
