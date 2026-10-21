import type { EffectDepth, EffectPoint } from './effect-sprites';
import {
  getNativeEffectAsset,
  rasterizeNativeEffect,
  snapNativePoint,
  type NativeCanvasFactory,
} from './native-effect-renderer';

export interface NativeTetherCommand {
  assetId: string;
  source: EffectPoint;
  target: EffectPoint;
  sourceScale: number;
  targetScale: number;
  sourceGrid: EffectPoint;
  targetGrid: EffectPoint;
  progress: number;
  phase: number;
  style: 'vine' | 'tongue';
  depthAt: (point: EffectPoint) => EffectDepth;
}
const palettes = new WeakMap<object, Map<string, string[]>>();
function palette(image: CanvasImageSource, id: string, factory?: NativeCanvasFactory) {
  let cache = palettes.get(image as object);
  if (!cache) {
    cache = new Map();
    palettes.set(image as object, cache);
  }
  const cached = cache.get(id);
  if (cached) return cached;
  const art = getNativeEffectAsset(id);
  const raster = rasterizeNativeEffect(image, art, Math.min(2, art.frameCount - 1), 0, factory);
  const pixels = raster.canvas
    .getContext('2d')!
    .getImageData(0, 0, raster.canvas.width, raster.canvas.height).data;
  const colors = new Map<string, { rgb: number[]; count: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 180) continue;
    const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]],
      key = rgb.join(',');
    const previous = colors.get(key);
    if (previous) previous.count++;
    else colors.set(key, { rgb, count: 1 });
  }
  const ranked = [...colors.values()]
    .filter((c) => c.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    .sort((a, b) => a.rgb.reduce((n, v) => n + v, 0) - b.rgb.reduce((n, v) => n + v, 0));
  const chosen = [
    ranked[0],
    ranked[Math.floor(ranked.length * 0.5)],
    ranked[Math.floor(ranked.length * 0.8)],
  ].map((c) => `rgb(${(c?.rgb || [70, 90, 40]).join(',')})`);
  cache.set(id, chosen);
  return chosen;
}
/** A native-pixel stem joins the original move clip to the actual mouth/bulb.
 * Colors come from that unmodified clip; paths never resize its pixel blocks.
 */
export function paintNativeTether(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  tether: NativeTetherCommand,
  depth: EffectDepth,
  factory?: NativeCanvasFactory,
) {
  const dx = tether.target.x - tether.source.x,
    dy = tether.target.y - tether.source.y;
  const length = Math.hypot(dx, dy);
  if (!length || tether.progress <= 0) return;
  const points: { p: EffectPoint; scale: number }[] = [];
  const curve =
    tether.style === 'vine' ? Math.min(48, length * 0.1) * Math.sin(tether.phase * 0.8) : 0;
  for (let at = 0; at <= length * tether.progress; ) {
    const t = at / length;
    const scale = Math.max(
      1,
      Math.round(tether.sourceScale + (tether.targetScale - tether.sourceScale) * t),
    );
    const p = {
      x: tether.source.x + dx * t - (dy / length) * Math.sin(t * Math.PI) * curve,
      y: tether.source.y + dy * t + (dx / length) * Math.sin(t * Math.PI) * curve,
    };
    const origin =
      scale === tether.sourceScale && scale === tether.targetScale
        ? t > 0.5
          ? tether.targetGrid
          : tether.sourceGrid
        : scale === tether.sourceScale
          ? tether.sourceGrid
          : scale === tether.targetScale
            ? tether.targetGrid
            : { x: 0, y: 0 };
    if (tether.depthAt(p) === depth) points.push({ p: snapNativePoint(p, scale, origin), scale });
    at += Math.max(1, scale * 0.45);
  }
  // Exact normal Lickitung body palette from the imported PMD source. The native
  // Lick effect itself is a yellow contact flash, so it is retained only at impact.
  const colors =
    tether.style === 'tongue'
      ? ['rgb(231,63,103)', 'rgb(255,143,175)', 'rgb(255,199,215)']
      : palette(image, tether.assetId, factory);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const core = tether.style === 'tongue' ? 2 : 1;
  for (const [index, radius] of [core + 1, core, 0].entries()) {
    ctx.fillStyle = colors[index];
    for (const { p, scale } of points) {
      // Whole source-pixel squares, including outlines and the small highlight ridge.
      for (let x = -radius; x <= radius; x++)
        for (let y = -radius; y <= radius; y++)
          ctx.fillRect(p.x + x * scale, p.y + y * scale, scale, scale);
    }
  }
  ctx.restore();
}
