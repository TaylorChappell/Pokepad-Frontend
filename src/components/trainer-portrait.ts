import type { Profile } from '../types';

// Measured source-pixel bounds, including Leaf's complete ponytail. Keeping an
// extra source pixel on each side prevents hair touching the rounded frame.
export const TRAINER_HEAD_BOUNDS = {
  red: { left: 24, right: 39, top: 8, headHeight: 16 },
  leaf: { left: 23, right: 49, top: 8, headHeight: 24 },
  misty: { left: 25, right: 49, top: 2, headHeight: 24 },
  brock: { left: 22, right: 41, top: 1, headHeight: 18 },
  blue: { left: 25, right: 46, top: 6, headHeight: 17 },
} as const;

export function trainerPortraitGeometry(character: Profile['character'], size: number) {
  const crop = TRAINER_HEAD_BOUNDS[character] || TRAINER_HEAD_BOUNDS.red;
  const innerSize = size - 2;
  const scale = Math.max(
    1,
    Math.min(
      Math.round(innerSize / 24),
      Math.floor(innerSize / (crop.right - crop.left + 2)),
      Math.floor((innerSize - 4) / crop.headHeight),
    ),
  );
  const portraitHeight = 26;
  const insetTop = Math.max(2, Math.round((innerSize - portraitHeight * scale) / 2));
  return {
    scale,
    width: 64 * scale,
    height: 64 * scale,
    left: Math.round(innerSize / 2 - ((crop.left + crop.right) / 2) * scale),
    top: insetTop - crop.top * scale,
    // Curate a shoulder portrait instead of leaving detached outstretched arms
    // visible beside a small head. Source pixels always stay integer-scaled.
    clipPath: `inset(${crop.top * scale}px ${(64 - crop.right - 2) * scale}px ${(64 - crop.top - portraitHeight) * scale}px ${(crop.left - 2) * scale}px)`,
  };
}
