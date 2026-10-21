import type { Side } from './engine';
import type { BattleCue } from './presentation';
import {
  getBodyFrameAt,
  getBodyPreviewManifest,
  getBodyView,
  type BodyManifest,
  type BodyRect,
} from './body-animation';

export interface BattlePoint {
  x: number;
  y: number;
}
export type BattleAnchor = 'mouth' | 'hand' | 'cannon' | 'body' | 'feet' | 'crown';
export interface BattleActorGeometry {
  speciesId: number;
  side: Side;
  rect: { x: number; y: number; width: number; height: number; size: number };
  /** Union of all actual animation pixels, at one scale for every clip. */
  bounds: { x: number; y: number; width: number; height: number };
  activeBounds?: { x: number; y: number; width: number; height: number };
  anchors: Record<BattleAnchor, BattlePoint>;
  ground: BattlePoint & { rx: number; ry: number };
  origin: BattlePoint;
  pixelScale: number;
  body?: { manifest: BodyManifest; shiny: boolean };
}
export interface BattleScene {
  width: number;
  height: number;
  actors: Record<Side, BattleActorGeometry>;
}
export interface BattleActorSpec {
  speciesId: number;
  shiny?: boolean;
  manifest?: BodyManifest;
}
const anchors: BattleAnchor[] = ['mouth', 'hand', 'cannon', 'body', 'feet', 'crown'];
const validSize = (n: number, fallback: number) => (Number.isFinite(n) && n > 0 ? n : fallback);
const union = (a: BodyRect, b: BodyRect): BodyRect => {
  const x = Math.min(a[0], b[0]),
    y = Math.min(a[1], b[1]);
  return [x, y, Math.max(a[0] + a[2], b[0] + b[2]) - x, Math.max(a[1] + a[3], b[1] + b[3]) - y];
};

/** Logical sheet coordinates are transformed once, independent of the active clip's cell size. */
export function bodyPointOnField(
  actor: BattleActorGeometry,
  point: readonly [number, number],
): BattlePoint {
  return {
    x: actor.origin.x + point[0] * actor.pixelScale,
    y: actor.origin.y + point[1] * actor.pixelScale,
  };
}

/** PMD's ground pivot stays on the ellipse, including when a pose's feet lift off the ground. */
export function getBattleActorGeometry(
  speciesId: number,
  side: Side,
  width = 1000,
  height = 600,
  shiny = false,
  manifest?: BodyManifest,
): BattleActorGeometry {
  width = validSize(width, 1000);
  height = validSize(height, 600);
  const id = Math.max(1, Math.min(151, Math.floor(speciesId) || 1));
  manifest ||= getBodyPreviewManifest(id);
  const view = getBodyView(manifest, side, shiny);
  const allBounds = union(
    getBodyView(manifest, side, false).bounds,
    getBodyView(manifest, side, true).bounds,
  );
  const [left, top, bodyWidth, bodyHeight] = allBounds;
  const idle = getBodyFrameAt(manifest, { side, shiny, cue: null, elapsedMs: 0, paused: true });
  const idleBounds = union(
    getBodyView(manifest, side, false).clips.Idle.frames[0].bounds,
    getBodyView(manifest, side, true).clips.Idle.frames[0].bounds,
  );
  const contact = view.contact;
  const canvasWidth = manifest.canvasWidth;
  const canvasHeight = manifest.canvasHeight;
  const ground = {
    x: width * (side === 'player' ? 0.255 : 0.738),
    y: height * (side === 'player' ? 0.82 : 0.445),
    rx: width * (side === 'player' ? 0.225 : 0.18),
    ry: height * (side === 'player' ? 0.072 : 0.054),
  };
  const margin = Math.max(1, Math.min(width, height) * 0.025);
  const limitW = width * (side === 'player' ? 0.36 : 0.28);
  const limitH = height * (side === 'player' ? 0.48 : 0.35);
  // Fit all animation pixels about the real ground point. Never shift the body off its platform.
  const leftExtent = Math.max(0, contact[0] - left);
  const rightExtent = Math.max(0, left + bodyWidth - contact[0]);
  const upperExtent = Math.max(0, contact[1] - top);
  const lowerExtent = Math.max(0, top + bodyHeight - contact[1]);
  const fittedScale = Math.max(
    0.01,
    Math.min(
      limitW / Math.max(1, idleBounds[2]),
      limitH / Math.max(1, idleBounds[3]),
      leftExtent ? (ground.x - margin) / leftExtent : Infinity,
      rightExtent ? (width - margin - ground.x) / rightExtent : Infinity,
      upperExtent ? (ground.y - margin) / upperExtent : Infinity,
      lowerExtent ? (height - margin - ground.y) / lowerExtent : Infinity,
    ),
  );
  // Every source pixel gets the same whole-pixel footprint, except on extremely small fields.
  const pixelScale = fittedScale >= 1 ? Math.floor(fittedScale) : fittedScale;
  if (pixelScale >= 1) {
    ground.x = Math.round(ground.x - contact[0] * pixelScale) + contact[0] * pixelScale;
    ground.y = Math.round(ground.y - contact[1] * pixelScale) + contact[1] * pixelScale;
  }
  const origin = { x: ground.x - contact[0] * pixelScale, y: ground.y - contact[1] * pixelScale };
  const actor: BattleActorGeometry = {
    speciesId: id,
    side,
    origin,
    pixelScale,
    rect: {
      ...origin,
      width: canvasWidth * pixelScale,
      height: canvasHeight * pixelScale,
      size: Math.max(canvasWidth, canvasHeight) * pixelScale,
    },
    bounds: {
      x: origin.x + left * pixelScale,
      y: origin.y + top * pixelScale,
      width: bodyWidth * pixelScale,
      height: bodyHeight * pixelScale,
    },
    anchors: {} as Record<BattleAnchor, BattlePoint>,
    ground,
    body: { manifest, shiny },
  };
  for (const anchor of anchors)
    actor.anchors[anchor] = bodyPointOnField(actor, idle.frame.anchors[anchor]);
  const idlePoint = bodyPointOnField(actor, [idle.frame.bounds[0], idle.frame.bounds[1]]);
  actor.activeBounds = {
    ...idlePoint,
    width: idle.frame.bounds[2] * pixelScale,
    height: idle.frame.bounds[3] * pixelScale,
  };
  return actor;
}

export function createBattleScene({
  width = 1000,
  height = 600,
  player,
  rival,
}: {
  width?: number;
  height?: number;
  player: BattleActorSpec;
  rival: BattleActorSpec;
}): BattleScene {
  width = validSize(width, 1000);
  height = validSize(height, 600);
  return {
    width,
    height,
    actors: {
      player: getBattleActorGeometry(
        player.speciesId,
        'player',
        width,
        height,
        player.shiny,
        player.manifest,
      ),
      rival: getBattleActorGeometry(
        rival.speciesId,
        'rival',
        width,
        height,
        rival.shiny,
        rival.manifest,
      ),
    },
  };
}

/** Body rendering and VFX read exactly the same frame at the same shared cue elapsed time. */
export function sampleBattleSceneAt(
  scene: BattleScene,
  cue: BattleCue | null,
  elapsedMs: number,
  reducedMotion = false,
): BattleScene {
  const sampled = { ...scene, actors: { ...scene.actors } };
  for (const side of ['player', 'rival'] as const) {
    const actor = scene.actors[side];
    if (!actor.body) continue;
    const sample = getBodyFrameAt(actor.body.manifest, {
      side,
      shiny: actor.body.shiny,
      cue,
      elapsedMs: Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0),
      reducedMotion,
    });
    sampled.actors[side] = {
      ...actor,
      activeBounds: {
        ...bodyPointOnField(actor, [sample.frame.bounds[0], sample.frame.bounds[1]]),
        width: sample.frame.bounds[2] * actor.pixelScale,
        height: sample.frame.bounds[3] * actor.pixelScale,
      },
      anchors: Object.fromEntries(
        anchors.map((anchor) => [anchor, bodyPointOnField(actor, sample.frame.anchors[anchor])]),
      ) as Record<BattleAnchor, BattlePoint>,
    };
  }
  return sampled;
}
