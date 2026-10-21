import { asset } from '../utils';
import { NATIVE_EFFECT_ASSETS, type NativeEffectAsset } from './native-effect-art';
import type { EffectPoint } from './effect-sprites';

export type NativeCanvasFactory = (width: number, height: number) => HTMLCanvasElement;
const browserCanvas: NativeCanvasFactory = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};
export const getNativeEffectAsset = (id: string): NativeEffectAsset => {
  const found = NATIVE_EFFECT_ASSETS[id];
  if (!found) throw new Error(`Native battle effect unavailable: ${id}`);
  return found;
};
export const nativeEffectDirection = (angle: number) =>
  ((Math.round((angle - 90) / 45) % 8) + 8) % 8;
export const nativeEffectFrameAt = (id: string, elapsed: number, duration?: number) => {
  const art = getNativeEffectAsset(id),
    count = art.frames[0].length;
  return duration === undefined
    ? Math.floor(Math.max(0, elapsed) / art.frameMs) % count
    : Math.min(count - 1, Math.floor((Math.max(0, elapsed) / Math.max(1, duration)) * count));
};
const images = new Map<string, HTMLImageElement>();
const loading = new Map<string, Promise<void>>();
export const getNativeEffectImage = (id: string) => images.get(id);
export async function preloadNativeEffectImages(ids: readonly string[]): Promise<void> {
  if (typeof Image === 'undefined') return;
  await Promise.all(
    [...new Set(ids)].map((id) => {
      if (images.has(id)) return Promise.resolve();
      const cached = loading.get(id);
      if (cached) return cached;
      const pending = new Promise<void>((resolve, reject) => {
        const image = new Image();
        let settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          image.onload = null;
          image.onerror = null;
          if (error) reject(error);
          else {
            images.set(id, image);
            resolve();
          }
        };
        const failed = () => finish(new Error('Battle effects could not load. Please try again.'));
        const timeout = setTimeout(failed, 15000);
        image.onerror = failed;
        image.onload = () => {
          if (typeof image.decode !== 'function') finish();
        };
        image.src = asset(getNativeEffectAsset(id).path);
        if (typeof image.decode === 'function') image.decode().then(() => finish(), failed);
        else if (image.complete && image.naturalWidth > 0) finish();
      }).catch((error) => {
        loading.delete(id);
        throw error;
      });
      loading.set(id, pending);
      return pending;
    }),
  );
}

export interface NativeEffectRaster {
  canvas: HTMLCanvasElement;
  pivot: EffectPoint;
}
const rasterCache = new WeakMap<object, Map<string, NativeEffectRaster>>();
/** Rotation happens on the ORIGINAL pixel grid, never on enlarged Pokémon-sized blocks. */
export function rasterizeNativeEffect(
  image: CanvasImageSource,
  art: NativeEffectAsset,
  frameIndex: number,
  direction = 0,
  canvasFactory: NativeCanvasFactory = browserCanvas,
  forceRotation?: number,
): NativeEffectRaster {
  direction = ((Math.round(direction) % 8) + 8) % 8;
  let row = 0,
    angle = 0,
    flip = false;
  if (art.directionMode === 'Dir8') row = direction;
  else if (art.directionMode === 'Dir5') {
    row = direction > 4 ? 8 - direction : direction;
    flip = direction > 4;
  } else if (art.directionMode === 'Dir2') {
    row = direction % 2;
    angle = Math.floor(direction / 2) * 90;
  } else if (art.directionMode === 'Dir1') angle = direction * 45;
  else if (art.directionMode === 'Flip') flip = direction >= 4;
  if (forceRotation !== undefined) angle = Math.round(forceRotation / 22.5) * 22.5;
  const frames = art.frames[Math.min(row, art.frames.length - 1)];
  const index = Math.max(0, Math.min(frames.length - 1, Math.floor(frameIndex)));
  const key = `${art.id}:${art.pivot.x}:${art.pivot.y}:${index}:${row}:${angle}:${flip}`;
  let cache = rasterCache.get(image as object);
  if (!cache) {
    cache = new Map();
    rasterCache.set(image as object, cache);
  }
  const cached = cache.get(key);
  if (cached) return cached;
  const frame = frames[index];
  const logical = canvasFactory(art.frameWidth, art.frameHeight);
  const lctx = logical.getContext('2d')!;
  lctx.imageSmoothingEnabled = false;
  lctx.drawImage(
    image,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    frame.offsetX,
    frame.offsetY,
    frame.width,
    frame.height,
  );
  const radians = (angle * Math.PI) / 180,
    cos = Math.cos(radians),
    sin = Math.sin(radians);
  const corners = [
    [0, 0],
    [art.frameWidth, 0],
    [0, art.frameHeight],
    [art.frameWidth, art.frameHeight],
  ].map(([x, y]) => {
    x = (x - art.pivot.x) * (flip ? -1 : 1);
    y -= art.pivot.y;
    return { x: x * cos - y * sin, y: x * sin + y * cos };
  });
  const minX = Math.floor(Math.min(...corners.map((p) => p.x))),
    minY = Math.floor(Math.min(...corners.map((p) => p.y)));
  const width = Math.ceil(Math.max(...corners.map((p) => p.x))) - minX + 2;
  const height = Math.ceil(Math.max(...corners.map((p) => p.y))) - minY + 2;
  const pivot = { x: 1 - minX, y: 1 - minY };
  const canvas = canvasFactory(width, height),
    ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(pivot.x, pivot.y);
  ctx.rotate(radians);
  ctx.scale(flip ? -1 : 1, 1);
  ctx.drawImage(logical, -art.pivot.x, -art.pivot.y);
  // Native-grid edge coverage is quantized before enlargement: no translucent rotated diamonds.
  if (angle % 90 !== 0) {
    const pixels = ctx.getImageData(0, 0, width, height);
    for (let i = 3; i < pixels.data.length; i += 4)
      pixels.data[i] = pixels.data[i] >= 128 ? 255 : 0;
    ctx.putImageData(pixels, 0, 0);
  }
  const result = { canvas, pivot };
  // Bound retained canvases even when many frames and directions are viewed.
  if (cache.size >= 192) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}
export const snapNativePoint = (
  point: EffectPoint,
  pixelScale: number,
  origin: EffectPoint = { x: 0, y: 0 },
): EffectPoint => ({
  x: Math.round(origin.x) + Math.round((point.x - Math.round(origin.x)) / pixelScale) * pixelScale,
  y: Math.round(origin.y) + Math.round((point.y - Math.round(origin.y)) / pixelScale) * pixelScale,
});
export interface NativeSpritePaint {
  frameIndex: number;
  direction: number;
  pixelScale: number;
  x: number;
  y: number;
  opacity?: number;
  gridOrigin?: EffectPoint;
  forceRotation?: number;
}
/** Reusable in browser and Node canvas QA; source pixels always occupy whole square blocks. */
export function paintNativeEffectSprite(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  art: NativeEffectAsset,
  options: NativeSpritePaint,
  canvasFactory: NativeCanvasFactory = browserCanvas,
) {
  const raster = rasterizeNativeEffect(
    image,
    art,
    options.frameIndex,
    options.direction,
    canvasFactory,
    options.forceRotation,
  );
  const scale = Math.max(1, Math.round(options.pixelScale));
  const p = snapNativePoint({ x: options.x, y: options.y }, scale, options.gridOrigin);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = options.opacity ?? 1;
  ctx.drawImage(
    raster.canvas,
    p.x - raster.pivot.x * scale,
    p.y - raster.pivot.y * scale,
    raster.canvas.width * scale,
    raster.canvas.height * scale,
  );
  ctx.restore();
}
export interface NativeBeamPaint {
  source: EffectPoint;
  target: EffectPoint;
  sourceScale: number;
  targetScale: number;
  sourceGrid?: EffectPoint;
  targetGrid?: EffectPoint;
  frameIndex: number;
  progress: number;
  phase: number;
  style: 'fire' | 'water' | 'energy' | 'ice' | 'electric';
  opacity?: number;
  acceptPoint?: (point: EffectPoint, fraction: number) => boolean;
}
/** A continuous native cross-section, not repeated full flame pictures.
 * Depth and perspective are sampled along its length; the fire boundary is tapered and stepped.
 */
export function paintNativeEffectBeam(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  art: NativeEffectAsset,
  options: NativeBeamPaint,
  canvasFactory: NativeCanvasFactory = browserCanvas,
) {
  const raster = rasterizeNativeEffect(image, art, options.frameIndex, 0, canvasFactory);
  const pixels = raster.canvas
    .getContext('2d')!
    .getImageData(0, 0, raster.canvas.width, raster.canvas.height);
  const dx = options.target.x - options.source.x,
    dy = options.target.y - options.source.y,
    distance = Math.hypot(dx, dy);
  if (!distance || options.progress <= 0) return;
  const ux = dx / distance,
    uy = dy / distance,
    end = distance * Math.min(1, options.progress);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = options.opacity ?? 1;
  for (let length = 0; length <= end; ) {
    const t = length / distance,
      scale = Math.max(
        1,
        Math.round(options.sourceScale + (options.targetScale - options.sourceScale) * t),
      );
    const center = { x: options.source.x + ux * length, y: options.source.y + uy * length };
    if (options.acceptPoint && !options.acceptPoint(center, t)) {
      length += scale * 0.65;
      continue;
    }
    // A perspective band owns a fixed lattice. Sliding its origin per segment
    // would overlap whole blocks by a single screen pixel and create thin slivers.
    const sourceScale = Math.round(options.sourceScale);
    const targetScale = Math.round(options.targetScale);
    const origin =
      scale === sourceScale && scale === targetScale
        ? (t > 0.5 ? options.targetGrid : options.sourceGrid) || { x: 0, y: 0 }
        : scale === sourceScale
          ? options.sourceGrid || { x: 0, y: 0 }
          : scale === targetScale
            ? options.targetGrid || { x: 0, y: 0 }
            : { x: 0, y: 0 };
    const wave = Math.sin((length / Math.max(1, scale)) * 0.35 - options.phase * 1.2);
    const fire = options.style === 'fire';
    const electric = options.style === 'electric';
    // Width is in original pixels. Remap the WHOLE native colour profile into
    // this width; clipping the profile to its centre erases the coloured rim.
    const half = electric
      ? Math.floor(art.frameWidth / 2)
      : Math.max(
          2,
          Math.round(
            fire
              ? 3 + t * 4 + wave
              : options.style === 'water'
                ? 4 + t * 3
                : options.style === 'ice'
                  ? 3 + t * 2
                  : 5 + t * 3,
          ),
        );
    const row =
      1 +
      Math.floor(
        electric
          ? ((length / distance) * art.frameHeight + Math.floor(options.phase) * 3) %
              art.frameHeight
          : (length / scale + options.phase * 2) % art.frameHeight,
      );
    // Outer pixels first, bright centre last, so neighbouring sections connect
    // without their dark rims punching single-pixel holes through the core.
    const crossSections = Array.from({ length: half * 2 + 1 }, (_, i) => i - half).sort(
      (a, b) => Math.abs(b) - Math.abs(a),
    );
    for (const cross of crossSections) {
      const profile = electric
        ? cross + art.pivot.x
        : ((cross / half + 1) / 2) * (art.frameWidth - 1);
      const sourceX = Math.max(1, Math.min(pixels.width - 2, Math.round(profile) + 1));
      const pixel = (Math.min(pixels.height - 1, row) * pixels.width + sourceX) * 4;
      const a = pixels.data[pixel + 3];
      if (a < 64 && !fire) continue;
      const p = snapNativePoint(
        { x: center.x - uy * cross * scale, y: center.y + ux * cross * scale },
        scale,
        origin,
      );
      if (fire) {
        // The exact five colours of native Ember, composed as a narrow flame
        // stream. Its yellow body prevents a white laser-like muzzle plume.
        const heat = Math.abs(cross) / half;
        const colour =
          heat < 0.13 && wave > 0.1
            ? '255,255,255'
            : heat < 0.5
              ? '255,247,0'
              : heat < 0.73
                ? '255,132,90'
                : heat < 0.92
                  ? '214,57,0'
                  : '156,0,0';
        ctx.fillStyle = `rgb(${colour})`;
      } else {
        ctx.fillStyle = `rgba(${pixels.data[pixel]},${pixels.data[pixel + 1]},${pixels.data[pixel + 2]},${a / 255})`;
      }
      ctx.fillRect(p.x, p.y, scale, scale);
    }
    length += scale * 0.65;
  }
  ctx.restore();
}
