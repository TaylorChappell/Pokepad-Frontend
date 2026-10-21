import sheet01 from './effect-art/sheet-01.json';
import sheet02 from './effect-art/sheet-02.json';
import sheet03 from './effect-art/sheet-03.json';
import sheet04 from './effect-art/sheet-04.json';
import sheet05 from './effect-art/sheet-05.json';
import sheet06 from './effect-art/sheet-06.json';
import sheet07 from './effect-art/sheet-07.json';
import sheet08 from './effect-art/sheet-08.json';
import type { EffectSpriteLayer } from './effect-sprites';

export interface EffectFrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}
export interface EffectAtlas {
  imageWidth: number;
  imageHeight: number;
  /** Every frame keeps this logical canvas. Crop size never changes its scale. */
  frameWidth: number;
  frameHeight: number;
  rows: {
    move: string;
    pivotX?: number;
    pivotY?: number;
    frames: EffectFrameRect[];
  }[];
}

export const EFFECT_ATLASES: readonly EffectAtlas[] = [
  sheet01,
  sheet02,
  sheet03,
  sheet04,
  sheet05,
  sheet06,
  sheet07,
  sheet08,
];

const frameSequences = {
  full: [0, 1, 2, 3, 4, 5],
  charge: [0, 1, 2],
  impact: [3, 4, 5],
} as const;

/** Select an integer source rectangle, never an interpolated atlas position. */
export function effectFrameAt(
  set: EffectSpriteLayer['frames'],
  elapsed: number,
  delay: number,
  duration: number,
): number {
  const frames = frameSequences[set];
  const progress = Math.max(0, Math.min(0.999999, (elapsed - delay) / Math.max(1, duration)));
  return frames[Math.floor(progress * frames.length)];
}

export function effectFrameGeometry(sheet: number, row: number, frame: number, size: number) {
  const atlas = EFFECT_ATLASES[sheet - 1];
  const strip = atlas.rows[row];
  const rect = strip.frames[frame];
  const scale = size / atlas.frameWidth;
  return {
    // Row pivots keep the visible art aligned even when its transparent margin is asymmetric.
    canvas: {
      left: -(strip.pivotX ?? atlas.frameWidth / 2) * scale,
      top: -(strip.pivotY ?? atlas.frameHeight / 2) * scale,
      width: atlas.frameWidth * scale,
      height: atlas.frameHeight * scale,
    },
    crop: {
      left: rect.offsetX * scale,
      top: rect.offsetY * scale,
      width: rect.width * scale,
      height: rect.height * scale,
      backgroundSize: `${atlas.imageWidth * scale}px ${atlas.imageHeight * scale}px`,
      backgroundPosition: `${-rect.x * scale}px ${-rect.y * scale}px`,
    },
  };
}
