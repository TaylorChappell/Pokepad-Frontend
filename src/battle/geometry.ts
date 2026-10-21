import type { Side } from './engine';
import { BATTLE_PIXEL_BOUNDS } from './sprite-geometry';

export interface BattlePoint {
  x: number;
  y: number;
}
export type BattleAnchor = 'mouth' | 'hand' | 'cannon' | 'body' | 'feet' | 'crown';
export type BattleIdle = 'grounded' | 'hover' | 'serpent';
export type BattleBodyMotion =
  | 'lunge'
  | 'claw'
  | 'leap'
  | 'cast'
  | 'beam'
  | 'hover'
  | 'shake'
  | 'guard'
  | 'drain'
  | 'sway'
  | 'hit'
  | 'arrive'
  | 'faint'
  | 'charge';
export interface BattleActorGeometry {
  speciesId: number;
  side: Side;
  rect: { x: number; y: number; size: number };
  bounds: { x: number; y: number; width: number; height: number };
  poseBounds: { minX: number; maxX: number; minY: number; maxY: number };
  anchors: Record<BattleAnchor, BattlePoint>;
  ground: BattlePoint & { rx: number; ry: number };
  idle: BattleIdle;
  idleDuration: number;
  idleAmplitude: number;
  poseWeight: number;
}
export interface BattleScene {
  width: number;
  height: number;
  actors: Record<Side, BattleActorGeometry>;
}
export interface BattleActorSpec {
  speciesId: number;
  shiny?: boolean;
}

const hovering = new Set([
  12, 15, 16, 17, 18, 21, 22, 41, 42, 49, 81, 82, 92, 93, 94, 109, 110, 142, 144, 145, 146, 151,
]);
const serpents = new Set([
  10, 11, 13, 14, 23, 24, 46, 47, 72, 73, 88, 89, 95, 114, 129, 130, 138, 139, 147, 148,
]);
const quadrupeds = new Set([
  1, 2, 3, 19, 20, 27, 28, 29, 30, 31, 32, 33, 34, 37, 38, 50, 51, 52, 53, 58, 59, 77, 78, 86, 87,
  98, 99, 111, 112, 128, 133, 134, 135, 136,
]);
const round = new Set([
  35, 36, 39, 40, 43, 44, 45, 48, 54, 60, 61, 62, 69, 70, 71, 74, 75, 76, 79, 80, 90, 91, 100, 101,
  102, 103, 113, 116, 117, 118, 119, 120, 121, 132, 137, 143,
]);
const heavy = new Set([
  3, 9, 31, 34, 59, 68, 76, 80, 95, 103, 112, 115, 128, 130, 131, 139, 142, 143, 149,
]);
// The relative anatomy coordinates below are inside each sprite's measured opaque rectangle.
// Front sprites face the near-left trainer, while rear sprites face the far-right trainer.
const anatomy: Record<
  'upright' | 'quadruped' | 'round' | 'serpent' | 'hover',
  Record<
    'front' | 'back',
    { mouth: [number, number]; hand: [number, number]; crown: [number, number] }
  >
> = {
  upright: {
    front: { mouth: [0.42, 0.28], hand: [0.25, 0.57], crown: [0.49, 0.08] },
    back: { mouth: [0.73, 0.25], hand: [0.79, 0.58], crown: [0.53, 0.08] },
  },
  quadruped: {
    front: { mouth: [0.27, 0.4], hand: [0.25, 0.78], crown: [0.45, 0.16] },
    back: { mouth: [0.76, 0.34], hand: [0.8, 0.77], crown: [0.56, 0.14] },
  },
  round: {
    front: { mouth: [0.42, 0.43], hand: [0.23, 0.65], crown: [0.47, 0.1] },
    back: { mouth: [0.73, 0.35], hand: [0.8, 0.65], crown: [0.53, 0.1] },
  },
  serpent: {
    front: { mouth: [0.4, 0.23], hand: [0.32, 0.54], crown: [0.45, 0.08] },
    back: { mouth: [0.73, 0.22], hand: [0.78, 0.58], crown: [0.53, 0.08] },
  },
  hover: {
    front: { mouth: [0.4, 0.33], hand: [0.21, 0.46], crown: [0.47, 0.1] },
    back: { mouth: [0.7, 0.27], hand: [0.79, 0.48], crown: [0.53, 0.1] },
  },
};
type AnatomyOverride = Partial<
  Record<
    'front' | 'back',
    Partial<Record<'mouth' | 'hand' | 'cannon' | 'crown' | 'feet', [number, number]>>
  >
>;
const overrides: Record<number, AnatomyOverride> = {
  1: {
    front: { mouth: [0.22, 0.56], crown: [0.61, 0.22] },
    back: { mouth: [0.82, 0.47], crown: [0.49, 0.22] },
  },
  2: {
    front: { mouth: [0.23, 0.64], crown: [0.53, 0.19] },
    back: { mouth: [0.85, 0.49], crown: [0.5, 0.2] },
  },
  3: {
    front: { mouth: [0.47, 0.7], crown: [0.51, 0.18] },
    back: { mouth: [0.83, 0.68], crown: [0.51, 0.2] },
  },
  4: { front: { mouth: [0.42, 0.25] }, back: { mouth: [0.77, 0.24] } },
  5: { front: { mouth: [0.34, 0.27] }, back: { mouth: [0.76, 0.26] } },
  6: {
    front: { mouth: [0.47, 0.23], hand: [0.29, 0.54], feet: [0.54, 1] },
    back: { mouth: [0.73, 0.31], hand: [0.77, 0.64] },
  },
  7: { front: { mouth: [0.38, 0.3] }, back: { mouth: [0.77, 0.31] } },
  8: { front: { mouth: [0.41, 0.36] }, back: { mouth: [0.77, 0.3] } },
  9: {
    front: { mouth: [0.42, 0.31], cannon: [0.68, 0.19], hand: [0.24, 0.55] },
    back: { mouth: [0.7, 0.22], cannon: [0.8, 0.21], hand: [0.82, 0.6] },
  },
  12: { front: { mouth: [0.49, 0.47] }, back: { mouth: [0.66, 0.39] } },
  15: {
    front: { mouth: [0.47, 0.28], hand: [0.2, 0.62] },
    back: { mouth: [0.68, 0.28], hand: [0.87, 0.58] },
  },
  16: { front: { mouth: [0.37, 0.27] }, back: { mouth: [0.71, 0.26] } },
  17: { front: { mouth: [0.29, 0.2] }, back: { mouth: [0.74, 0.24] } },
  18: { front: { mouth: [0.35, 0.25] }, back: { mouth: [0.72, 0.25] } },
  21: { front: { mouth: [0.32, 0.25] }, back: { mouth: [0.76, 0.29] } },
  22: { front: { mouth: [0.29, 0.19] }, back: { mouth: [0.76, 0.22] } },
  23: { front: { mouth: [0.32, 0.18] }, back: { mouth: [0.76, 0.2] } },
  24: { front: { mouth: [0.47, 0.27] }, back: { mouth: [0.63, 0.23] } },
  25: {
    front: { mouth: [0.37, 0.43], hand: [0.27, 0.65] },
    back: { mouth: [0.73, 0.39], hand: [0.82, 0.65] },
  },
  26: { front: { mouth: [0.34, 0.31] }, back: { mouth: [0.72, 0.28] } },
  37: { front: { mouth: [0.31, 0.46] }, back: { mouth: [0.8, 0.33] } },
  38: { front: { mouth: [0.21, 0.43] }, back: { mouth: [0.81, 0.28] } },
  41: { front: { mouth: [0.48, 0.49] }, back: { mouth: [0.72, 0.44] } },
  42: { front: { mouth: [0.47, 0.43] }, back: { mouth: [0.67, 0.39] } },
  46: {
    front: { mouth: [0.39, 0.62], crown: [0.58, 0.15] },
    back: { mouth: [0.77, 0.67], crown: [0.48, 0.17] },
  },
  47: {
    front: { mouth: [0.43, 0.72], crown: [0.5, 0.17] },
    back: { mouth: [0.78, 0.72], crown: [0.49, 0.16] },
  },
  50: { front: { mouth: [0.48, 0.42] }, back: { mouth: [0.67, 0.35] } },
  51: { front: { mouth: [0.3, 0.4] }, back: { mouth: [0.72, 0.27] } },
  54: { front: { mouth: [0.44, 0.45] }, back: { mouth: [0.75, 0.35] } },
  55: { front: { mouth: [0.36, 0.27] }, back: { mouth: [0.75, 0.23] } },
  58: { front: { mouth: [0.28, 0.35] }, back: { mouth: [0.78, 0.34] } },
  59: { front: { mouth: [0.29, 0.32] }, back: { mouth: [0.78, 0.27] } },
  63: { front: { mouth: [0.46, 0.36] }, back: { mouth: [0.74, 0.34] } },
  64: {
    front: { mouth: [0.4, 0.26], hand: [0.18, 0.55] },
    back: { mouth: [0.74, 0.26], hand: [0.86, 0.51] },
  },
  65: {
    front: { mouth: [0.43, 0.26], hand: [0.18, 0.49] },
    back: { mouth: [0.72, 0.25], hand: [0.85, 0.48] },
  },
  69: { front: { mouth: [0.34, 0.22] }, back: { mouth: [0.71, 0.25] } },
  70: { front: { mouth: [0.47, 0.31] }, back: { mouth: [0.7, 0.28] } },
  71: { front: { mouth: [0.43, 0.31] }, back: { mouth: [0.7, 0.28] } },
  72: { front: { mouth: [0.45, 0.57] }, back: { mouth: [0.67, 0.43] } },
  73: { front: { mouth: [0.47, 0.45] }, back: { mouth: [0.71, 0.44] } },
  74: {
    front: { mouth: [0.46, 0.48], hand: [0.15, 0.51] },
    back: { mouth: [0.67, 0.43], hand: [0.86, 0.47] },
  },
  75: {
    front: { mouth: [0.42, 0.42], hand: [0.17, 0.52] },
    back: { mouth: [0.66, 0.33], hand: [0.87, 0.43] },
  },
  77: { front: { mouth: [0.22, 0.34] }, back: { mouth: [0.79, 0.31] } },
  78: { front: { mouth: [0.24, 0.28] }, back: { mouth: [0.77, 0.24] } },
  79: { front: { mouth: [0.26, 0.55] }, back: { mouth: [0.78, 0.38] } },
  80: { front: { mouth: [0.45, 0.28] }, back: { mouth: [0.72, 0.24] } },
  81: {
    front: { mouth: [0.47, 0.48], hand: [0.15, 0.5] },
    back: { mouth: [0.65, 0.45], hand: [0.86, 0.49] },
  },
  82: {
    front: { mouth: [0.37, 0.37], hand: [0.15, 0.5] },
    back: { mouth: [0.64, 0.4], hand: [0.85, 0.49] },
  },
  83: {
    front: { mouth: [0.37, 0.29], hand: [0.17, 0.65] },
    back: { mouth: [0.74, 0.25], hand: [0.84, 0.6] },
  },
  84: { front: { mouth: [0.23, 0.22] }, back: { mouth: [0.8, 0.25] } },
  85: { front: { mouth: [0.25, 0.24] }, back: { mouth: [0.83, 0.25] } },
  86: { front: { mouth: [0.25, 0.4] }, back: { mouth: [0.77, 0.39] } },
  87: { front: { mouth: [0.25, 0.32] }, back: { mouth: [0.75, 0.3] } },
  88: {
    front: { mouth: [0.42, 0.35], feet: [0.5, 1] },
    back: { mouth: [0.72, 0.26], feet: [0.5, 1] },
  },
  89: {
    front: { mouth: [0.39, 0.31], feet: [0.5, 1] },
    back: { mouth: [0.71, 0.25], feet: [0.5, 1] },
  },
  90: { front: { mouth: [0.46, 0.56] }, back: { mouth: [0.69, 0.46] } },
  91: { front: { mouth: [0.49, 0.52] }, back: { mouth: [0.7, 0.44] } },
  92: { front: { mouth: [0.47, 0.55] }, back: { mouth: [0.66, 0.45] } },
  93: {
    front: { mouth: [0.48, 0.44], hand: [0.16, 0.55] },
    back: { mouth: [0.7, 0.34], hand: [0.88, 0.51] },
  },
  94: { front: { mouth: [0.49, 0.44] }, back: { mouth: [0.72, 0.35] } },
  95: {
    front: { mouth: [0.56, 0.17], feet: [0.44, 1] },
    back: { mouth: [0.71, 0.21], feet: [0.48, 1] },
  },
  96: { front: { mouth: [0.42, 0.4] }, back: { mouth: [0.75, 0.34] } },
  97: {
    front: { mouth: [0.38, 0.28], hand: [0.18, 0.49] },
    back: { mouth: [0.76, 0.22], hand: [0.85, 0.51] },
  },
  98: {
    front: { mouth: [0.45, 0.56], hand: [0.17, 0.37] },
    back: { mouth: [0.67, 0.45], hand: [0.86, 0.36] },
  },
  99: {
    front: { mouth: [0.42, 0.51], hand: [0.14, 0.3] },
    back: { mouth: [0.66, 0.47], hand: [0.88, 0.28] },
  },
  100: { front: { mouth: [0.43, 0.51] }, back: { mouth: [0.69, 0.42] } },
  101: { front: { mouth: [0.47, 0.49] }, back: { mouth: [0.69, 0.43] } },
  103: {
    front: { mouth: [0.38, 0.28], crown: [0.49, 0.1] },
    back: { mouth: [0.74, 0.28], crown: [0.49, 0.1] },
  },
  106: { front: { hand: [0.23, 0.77] }, back: { hand: [0.83, 0.76] } },
  107: { front: { hand: [0.19, 0.44] }, back: { hand: [0.86, 0.44] } },
  108: { front: { mouth: [0.41, 0.37] }, back: { mouth: [0.75, 0.28] } },
  109: { front: { mouth: [0.45, 0.53] }, back: { mouth: [0.65, 0.4] } },
  110: { front: { mouth: [0.36, 0.52] }, back: { mouth: [0.63, 0.4] } },
  111: { front: { mouth: [0.27, 0.46] }, back: { mouth: [0.81, 0.36] } },
  112: { front: { mouth: [0.34, 0.3] }, back: { mouth: [0.76, 0.31] } },
  114: {
    front: { mouth: [0.48, 0.42], hand: [0.16, 0.54] },
    back: { mouth: [0.68, 0.38], hand: [0.85, 0.53] },
  },
  116: { front: { mouth: [0.22, 0.34] }, back: { mouth: [0.83, 0.28] } },
  117: { front: { mouth: [0.24, 0.3] }, back: { mouth: [0.82, 0.27] } },
  118: { front: { mouth: [0.24, 0.46] }, back: { mouth: [0.8, 0.4] } },
  119: { front: { mouth: [0.24, 0.44] }, back: { mouth: [0.79, 0.4] } },
  120: {
    front: { mouth: [0.48, 0.49], crown: [0.49, 0.15] },
    back: { mouth: [0.66, 0.4], crown: [0.49, 0.15] },
  },
  121: {
    front: { mouth: [0.48, 0.49], crown: [0.49, 0.15] },
    back: { mouth: [0.66, 0.4], crown: [0.49, 0.15] },
  },
  123: {
    front: { mouth: [0.4, 0.27], hand: [0.16, 0.58] },
    back: { mouth: [0.75, 0.25], hand: [0.86, 0.52] },
  },
  124: { front: { mouth: [0.45, 0.31] }, back: { mouth: [0.72, 0.28] } },
  126: { front: { mouth: [0.42, 0.27] }, back: { mouth: [0.75, 0.26] } },
  127: {
    front: { mouth: [0.46, 0.45], hand: [0.18, 0.62] },
    back: { mouth: [0.73, 0.33], hand: [0.87, 0.58] },
  },
  128: { front: { mouth: [0.26, 0.38] }, back: { mouth: [0.81, 0.31] } },
  129: {
    front: { mouth: [0.29, 0.41], feet: [0.52, 1] },
    back: { mouth: [0.8, 0.36], feet: [0.51, 1] },
  },
  130: {
    front: { mouth: [0.48, 0.23], feet: [0.47, 1] },
    back: { mouth: [0.73, 0.21], feet: [0.47, 1] },
  },
  131: { front: { mouth: [0.3, 0.24] }, back: { mouth: [0.74, 0.22] } },
  132: { front: { mouth: [0.47, 0.48] }, back: { mouth: [0.68, 0.4] } },
  133: { front: { mouth: [0.3, 0.45] }, back: { mouth: [0.79, 0.36] } },
  134: { front: { mouth: [0.28, 0.32] }, back: { mouth: [0.78, 0.32] } },
  135: { front: { mouth: [0.3, 0.42] }, back: { mouth: [0.78, 0.34] } },
  136: { front: { mouth: [0.28, 0.39] }, back: { mouth: [0.79, 0.33] } },
  137: { front: { mouth: [0.23, 0.47] }, back: { mouth: [0.8, 0.38] } },
  138: { front: { mouth: [0.42, 0.64] }, back: { mouth: [0.71, 0.58] } },
  139: { front: { mouth: [0.41, 0.59] }, back: { mouth: [0.74, 0.52] } },
  140: { front: { mouth: [0.43, 0.62] }, back: { mouth: [0.7, 0.52] } },
  141: {
    front: { mouth: [0.4, 0.24], hand: [0.17, 0.57] },
    back: { mouth: [0.76, 0.22], hand: [0.87, 0.55] },
  },
  142: { front: { mouth: [0.36, 0.35] }, back: { mouth: [0.74, 0.26] } },
  143: { front: { mouth: [0.45, 0.29], feet: [0.51, 1] }, back: { mouth: [0.71, 0.22] } },
  144: { front: { mouth: [0.43, 0.24] }, back: { mouth: [0.73, 0.21] } },
  145: { front: { mouth: [0.37, 0.25] }, back: { mouth: [0.76, 0.25] } },
  146: { front: { mouth: [0.4, 0.22] }, back: { mouth: [0.74, 0.23] } },
  147: { front: { mouth: [0.38, 0.22] }, back: { mouth: [0.74, 0.24] } },
  148: { front: { mouth: [0.41, 0.18] }, back: { mouth: [0.73, 0.21] } },
  149: { front: { mouth: [0.44, 0.2], feet: [0.53, 1] }, back: { mouth: [0.76, 0.23] } },
  150: { front: { mouth: [0.39, 0.19] }, back: { mouth: [0.76, 0.23] } },
  151: { front: { mouth: [0.43, 0.25] }, back: { mouth: [0.72, 0.23] } },
};
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max));
const validSize = (n: number, fallback: number) => (Number.isFinite(n) && n > 0 ? n : fallback);

/** One measured sprite, platform and anatomy transform is shared by both actors and VFX. */
export function getBattleActorGeometry(
  speciesId: number,
  side: Side,
  width = 1000,
  height = 600,
  shiny = false,
): BattleActorGeometry {
  width = validSize(width, 1000);
  height = validSize(height, 600);
  const id = clamp(Math.floor(speciesId) || 1, 1, 151);
  const facing = side === 'player' ? 'back' : 'front';
  const [left, top, right, bottom, groundX, bodyX, bodyY] =
    BATTLE_PIXEL_BOUNDS[`${facing}${shiny ? '-shiny' : ''}`][id - 1];
  const pixelW = right - left,
    pixelH = bottom - top;
  const idle: BattleIdle = hovering.has(id) ? 'hover' : serpents.has(id) ? 'serpent' : 'grounded';
  const archetype =
    idle === 'hover'
      ? 'hover'
      : serpents.has(id)
        ? 'serpent'
        : quadrupeds.has(id)
          ? 'quadruped'
          : round.has(id)
            ? 'round'
            : 'upright';
  const profile = { ...anatomy[archetype][facing], ...overrides[id]?.[facing] };
  const limitW = width * (side === 'player' ? 0.36 : 0.28);
  const limitH = height * (side === 'player' ? 0.48 : 0.35);
  const pixelScale = Math.min(limitW / pixelW, limitH / pixelH);
  const size = 64 * pixelScale;
  const ground = {
    x: width * (side === 'player' ? 0.255 : 0.738),
    y: height * (side === 'player' ? 0.875 : 0.445),
    rx: width * (side === 'player' ? 0.225 : 0.18),
    ry: height * (side === 'player' ? 0.072 : 0.054),
  };
  const relativePoint = (point: [number, number]): BattlePoint => ({
    x: left + pixelW * point[0],
    y: top + pixelH * point[1],
  });
  const contact = profile.feet
    ? relativePoint(profile.feet)
    : { x: idle === 'hover' ? (left + right) / 2 : groundX * 0.5 + bodyX * 0.5, y: bottom };
  const hoverLift = idle === 'hover' ? height * 0.022 : 0;
  let x = ground.x - contact.x * pixelScale,
    y = ground.y - contact.y * pixelScale - hoverLift;
  // Reserve opaque-art margins for idle motion and large/long-tailed species, on every aspect ratio.
  const margin = Math.min(width, height) * 0.018;
  x = clamp(x, margin - left * pixelScale, width - margin - right * pixelScale);
  y = clamp(y, margin - top * pixelScale, height - margin - bottom * pixelScale);
  const transform = (p: BattlePoint): BattlePoint => ({
    x: x + p.x * pixelScale,
    y: y + p.y * pixelScale,
  });
  const mouth = transform(relativePoint(profile.mouth));
  return {
    speciesId: id,
    side,
    rect: { x, y, size },
    bounds: {
      x: x + left * pixelScale,
      y: y + top * pixelScale,
      width: pixelW * pixelScale,
      height: pixelH * pixelScale,
    },
    poseBounds: {
      minX: Math.ceil(margin - x - left * pixelScale),
      maxX: Math.floor(width - margin - x - right * pixelScale),
      minY: Math.ceil(margin - y - top * pixelScale),
      maxY: Math.floor(height - margin - y - bottom * pixelScale),
    },
    anchors: {
      mouth,
      hand: transform(relativePoint(profile.hand)),
      cannon: profile.cannon ? transform(relativePoint(profile.cannon)) : mouth,
      body: transform({ x: bodyX, y: bodyY }),
      feet: transform(contact),
      crown: transform(relativePoint(profile.crown)),
    },
    ground,
    idle,
    idleDuration:
      idle === 'hover'
        ? 1900 + (id % 7) * 95
        : idle === 'serpent'
          ? 2300 + (id % 7) * 110
          : 2600 + (id % 9) * 100,
    idleAmplitude: Math.min(3, Math.max(1, pixelScale * (heavy.has(id) ? 0.35 : 0.65))),
    poseWeight: heavy.has(id) ? 0.72 : 1 + (id % 5) * 0.035,
  };
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
      player: getBattleActorGeometry(player.speciesId, 'player', width, height, player.shiny),
      rival: getBattleActorGeometry(rival.speciesId, 'rival', width, height, rival.shiny),
    },
  };
}
/** Travel is limited by the complete opaque sprite, never by a universal canvas centre. */
export function getBattleMotionVector(
  scene: BattleScene,
  side: Side,
  motion: BattleBodyMotion,
): BattlePoint {
  const actor = scene.actors[side],
    other = scene.actors[side === 'player' ? 'rival' : 'player'];
  const maxTravel = motion === 'claw' ? 0.66 : motion === 'leap' ? 0.9 : 0.8;
  const dx = (other.anchors.body.x - actor.anchors.body.x) * maxTravel;
  const dy = (other.anchors.body.y - actor.anchors.body.y) * maxTravel;
  const margin = Math.min(scene.width, scene.height) * 0.02;
  return {
    x: clamp(
      dx,
      margin - actor.bounds.x,
      scene.width - margin - actor.bounds.x - actor.bounds.width,
    ),
    y: clamp(
      dy,
      margin - actor.bounds.y,
      scene.height - margin - actor.bounds.y - actor.bounds.height,
    ),
  };
}

export interface BattlePoseOptions {
  motion?: BattleBodyMotion;
  vector?: BattlePoint;
  impactAt?: number;
  durationMs?: number;
}
const translate = (x = 0, y = 0) => `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
/** Six small, deliberately stepped poses keep native pixels sharp, without changing sprite scale. */
export function getBattleIdleFrames(actor: BattleActorGeometry): Keyframe[] {
  const n = actor.idleAmplitude;
  if (actor.idle === 'hover')
    return [
      { transform: translate(), offset: 0 },
      { transform: translate(0, -n * 1.6), offset: 0.5 },
      { transform: translate(), offset: 1 },
    ];
  if (actor.idle === 'serpent')
    return [
      { transform: translate(), offset: 0 },
      { transform: translate(n, 0), offset: 0.3 },
      { transform: translate(-n, 0), offset: 0.7 },
      { transform: translate(), offset: 1 },
    ];
  return [
    { transform: translate(), offset: 0 },
    { transform: translate(0, -n), offset: 0.3 },
    { transform: translate(), offset: 0.55 },
    { transform: translate(n * 0.5, 0), offset: 0.8 },
    { transform: translate(), offset: 1 },
  ];
}
/** Actor pose timing shares the move's impact point with its pixel effects. */
export function getBattlePoseFrames(
  actor: BattleActorGeometry,
  { motion = 'cast', vector = { x: 0, y: 0 }, impactAt = 0.55 }: BattlePoseOptions,
): Keyframe[] {
  const facing = actor.side === 'player' ? 1 : -1;
  const n = Math.max(2, actor.rect.size / 40) * actor.poseWeight;
  const t = clamp(impactAt, 0.35, 0.8);
  const pose = (x: number, y: number, offset: number, opacity = 1): Keyframe => ({
    transform: translate(
      clamp(x, actor.poseBounds.minX, actor.poseBounds.maxX),
      clamp(y, actor.poseBounds.minY, actor.poseBounds.maxY),
    ),
    offset,
    opacity,
  });
  if (motion === 'lunge' || motion === 'claw' || motion === 'leap') {
    const jump =
      motion === 'leap' ? -Math.min(actor.rect.size * 0.22, 28) : motion === 'claw' ? -n * 1.5 : 0;
    return [
      pose(0, 0, 0),
      pose(-facing * n * 1.2, n * 0.4, t * 0.25),
      pose(vector.x * 0.48, vector.y * 0.48 + jump, t * 0.62),
      pose(vector.x, vector.y, t),
      pose(vector.x * 0.9, vector.y * 0.9, t + 0.08),
      pose(0, 0, 0.94),
      pose(0, 0, 1),
    ];
  }
  // Beams use the same fixed anatomy point throughout emission; no idle or recoil can detach them.
  if (motion === 'beam') return [pose(0, 0, 0), pose(0, 0, 1)];
  if (motion === 'cast')
    return [pose(0, 0, 0), pose(0, 0, 0.9), pose(-facing * n * 0.4, n * 0.15, 0.95), pose(0, 0, 1)];
  if (motion === 'charge')
    return [pose(0, 0, 0), pose(0, -n, 0.25), pose(0, -n * 2, 0.65), pose(0, 0, 1)];
  if (motion === 'hover')
    return [
      pose(0, 0, 0),
      pose(facing * n, -n * 2, 0.3),
      pose(-facing * n, -n * 3, 0.6),
      pose(0, 0, 1),
    ];
  if (motion === 'shake')
    return [
      pose(0, 0, 0),
      pose(0, -n * 2, 0.22),
      pose(0, n * 0.8, t),
      pose(-n, 0, 0.72),
      pose(n, 0, 0.84),
      pose(0, 0, 1),
    ];
  if (motion === 'guard')
    return [pose(0, 0, 0), pose(0, n * 0.6, 0.25), pose(0, -n * 0.5, 0.68), pose(0, 0, 1)];
  if (motion === 'drain')
    return [
      pose(0, 0, 0),
      pose(facing * n, -n * 0.5, 0.3),
      pose(-facing * n * 0.5, 0, 0.66),
      pose(0, 0, 1),
    ];
  if (motion === 'sway')
    return [pose(0, 0, 0), pose(-facing * n, 0, 0.25), pose(facing * n, 0, 0.6), pose(0, 0, 1)];
  if (motion === 'hit')
    return [
      pose(0, 0, 0),
      pose(0, 0, Math.max(0, t - 0.08)),
      pose(-facing * n * 2, n * 0.5, t, 0.45),
      pose(facing * n, 0, Math.min(0.92, t + 0.14), 1),
      pose(0, 0, 1),
    ];
  if (motion === 'arrive')
    return [pose(0, -n * 2, 0, 0), pose(0, 0, 0.45, 1), pose(0, -n * 0.5, 0.7), pose(0, 0, 1)];
  return [pose(0, 0, 0), pose(0, n * 2, 1, 0)];
}
