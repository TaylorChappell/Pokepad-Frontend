import type { BattlePoint, BattleScene } from './geometry';
import type { Side } from './engine';
import { NATIVE_EFFECT_ASSETS } from './native-effect-art';

export type SwitchPhase = 'recall' | 'sendout';
export interface SwitchVisual {
  progress: number;
  ball: BattlePoint & { pixelScale: number; rotation: number; open: number; opacity: number };
  energy: Array<
    BattlePoint & { frameIndex: number; pixelScale: number; recall: boolean; opacity: number }
  >;
}
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const pixelPoint = (x: number, y: number): BattlePoint => ({ x: Math.round(x), y: Math.round(y) });

function fittedMaterializeFrame(
  scene: BattleScene,
  point: BattlePoint,
  index: number,
  scale: number,
) {
  const asset = NATIVE_EFFECT_ASSETS.materialize;
  for (let frameIndex = index; frameIndex >= 0; frameIndex--) {
    const frame = asset.frames[0][frameIndex];
    const x = point.x + (frame.offsetX - asset.pivot.x) * scale;
    const y = point.y + (frame.offsetY - asset.pivot.y) * scale;
    if (
      x >= 0 &&
      y >= 0 &&
      x + frame.width * scale <= scene.width &&
      y + frame.height * scale <= scene.height
    )
      return frameIndex;
  }
  return 0;
}

/** Pure shared-clock presentation: real item pixels and native materialization frames. */
export function sampleSwitchVisual(
  scene: BattleScene,
  side: Side,
  phase: SwitchPhase,
  elapsedMs: number,
  durationMs: number,
  reducedMotion = false,
): SwitchVisual {
  const progress = clamp(Math.max(0, elapsedMs) / Math.max(1, durationMs));
  const actor = scene.actors[side];
  const pixelScale = clamp(Math.floor(Math.min(scene.width / 390, scene.height / 210)), 1, 3);
  const perspective = side === 'player' ? pixelScale : Math.max(1, pixelScale - 1);
  const bodyPixelScale = Math.max(1, Math.round(actor.pixelScale));
  const hand = pixelPoint(
    scene.width * (side === 'player' ? 0.065 : 0.935),
    scene.height * (side === 'player' ? 0.9 : 0.12),
  );
  // The native item's opaque bottom is nine source pixels below its centre.
  const landing = pixelPoint(actor.ground.x, actor.ground.y - 9 * perspective);
  const energy: SwitchVisual['energy'] = [];
  if (phase === 'recall') {
    if (!reducedMotion) {
      for (let i = 0; i < 3; i++) {
        const t = (progress - 0.16 - i * 0.12) / 0.52;
        if (t < 0 || t > 1) continue;
        const eased = t * t;
        energy.push({
          ...pixelPoint(
            mix(actor.anchors.body.x, hand.x, eased),
            mix(actor.anchors.body.y, hand.y, eased),
          ),
          frameIndex: Math.round((1 - t) * 4),
          pixelScale: Math.max(1, Math.round(mix(bodyPixelScale, perspective, eased))),
          recall: true,
          opacity: 1,
        });
      }
    }
    return {
      progress,
      ball: {
        ...hand,
        pixelScale: perspective,
        rotation: 0,
        open: !reducedMotion && progress < 0.88 ? 1 : 0,
        opacity: 1,
      },
      energy,
    };
  }
  const flight = clamp(progress / 0.4);
  const arc = Math.max(
    0,
    Math.min(scene.height * 0.22, 80 * perspective, Math.min(hand.y, landing.y) - 12 * perspective),
  );
  const airborne = pixelPoint(
    mix(hand.x, landing.x, flight),
    mix(hand.y, landing.y, flight) - Math.sin(Math.PI * flight) * arc,
  );
  const ballPoint = reducedMotion ? landing : airborne;
  const open = progress < 0.4 ? 0 : clamp((progress - 0.4) / 0.055);
  if (!reducedMotion && progress >= 0.4 && progress < 0.84) {
    const release = clamp((progress - 0.4) / 0.44);
    const lift = clamp(release / 0.34);
    // Native frames 0–8 fit around a full body at its own pixel scale. The late
    // 64px source ring is deliberately omitted because it would clip the stage.
    const burstFrames = [0, 1, 2, 3, 4, 5, 6, 7, 8, 7, 5, 3, 1];
    const point = pixelPoint(
      mix(landing.x, actor.anchors.body.x, lift),
      mix(landing.y, actor.anchors.body.y, lift),
    );
    const authoredFrame =
      burstFrames[Math.min(burstFrames.length - 1, Math.floor(release * burstFrames.length))];
    energy.push({
      ...point,
      frameIndex: fittedMaterializeFrame(scene, point, authoredFrame, bodyPixelScale),
      pixelScale: bodyPixelScale,
      recall: false,
      opacity: release < 0.7 ? 1 : 1 - (release - 0.7) / 0.3,
    });
  }
  return {
    progress,
    ball: {
      ...ballPoint,
      pixelScale: perspective,
      rotation: reducedMotion || flight === 1 ? 0 : Math.floor(flight * 4) * 90,
      open: reducedMotion ? 0 : open,
      opacity:
        progress < 0.55 ? 1 : progress < 0.65 && !reducedMotion ? 1 - (progress - 0.55) / 0.1 : 0,
    },
    energy,
  };
}
