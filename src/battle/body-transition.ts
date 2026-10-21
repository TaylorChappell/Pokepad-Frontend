import type { CSSProperties } from 'react';

export interface BodyTransition {
  phase: 'recall' | 'sendout';
  startedAt: number;
  durationMs: number;
}

export interface BodyTransitionSample {
  visible: boolean;
  /** Number of opaque pixels in one native four-by-four dissolve tile. */
  density: number;
  silhouette: boolean;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Uses the same elapsed clock as the thrown ball, rather than a second CSS timeline. */
export function sampleBodyTransition(
  transition: BodyTransition,
  elapsedMs: number,
  reducedMotion = false,
): BodyTransitionSample {
  const progress = clamp(elapsedMs / Math.max(1, transition.durationMs));
  if (reducedMotion) {
    const visible = transition.phase === 'recall' ? progress < 0.5 : progress >= 0.45;
    return { visible, density: visible ? 16 : 0, silhouette: false };
  }
  if (transition.phase === 'recall') {
    const density = Math.ceil(16 * (1 - clamp((progress - 0.18) / 0.64)));
    return { visible: density > 0, density, silhouette: progress >= 0.1 };
  }
  const density = Math.floor(16 * clamp((progress - 0.45) / 0.3));
  return { visible: density > 0, density, silhouette: progress < 0.75 };
}

// Ordered pixel dissolve. It changes opacity of whole original sprite pixels;
// no blur, scaling, transparent bounding-box shrink or CSS transform is applied.
const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const masks = Array.from({ length: 17 }, (_, density) => {
  const pixels = bayer
    .map((rank, index) =>
      rank < density ? `<path d="M${index % 4} ${Math.floor(index / 4)}h1v1h-1z"/>` : '',
    )
    .join('');
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4" shape-rendering="crispEdges">${pixels}</svg>`)}")`;
});

export function getBodyTransitionStyle(
  transition: BodyTransition | undefined,
  sample: BodyTransitionSample | undefined,
  pixelScale = 1,
): CSSProperties {
  if (!transition || !sample) return {};
  const tileSize = `${Math.max(1, pixelScale) * 4}px`;
  return {
    visibility: sample.visible ? 'visible' : 'hidden',
    filter: sample.silhouette
      ? transition.phase === 'recall'
        ? 'brightness(0) saturate(100%) invert(74%) sepia(42%) saturate(1008%) hue-rotate(296deg) brightness(106%)'
        : 'brightness(0) invert(1)'
      : 'none',
    maskImage: sample.density < 16 ? masks[sample.density] : 'none',
    maskSize: tileSize,
    maskRepeat: 'repeat',
    WebkitMaskImage: sample.density < 16 ? masks[sample.density] : 'none',
    WebkitMaskSize: tileSize,
    WebkitMaskRepeat: 'repeat',
  };
}
