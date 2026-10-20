import { ART_BOUNDS } from './art-bounds';
import { SPRITES } from './sprites';
import { PORTRAIT_HEADS_A, SHINY_PORTRAIT_HEADS_A } from './portrait-heads-a';
import { PORTRAIT_HEADS_B, SHINY_PORTRAIT_HEADS_B } from './portrait-heads-b';
import { PORTRAIT_HEADS_C, SHINY_PORTRAIT_HEADS_C } from './portrait-heads-c';

export const PORTRAIT_HEADS = { ...PORTRAIT_HEADS_A, ...PORTRAIT_HEADS_B, ...PORTRAIT_HEADS_C };
const SHINY_PORTRAIT_HEADS = {
  ...SHINY_PORTRAIT_HEADS_A,
  ...SHINY_PORTRAIT_HEADS_B,
  ...SHINY_PORTRAIT_HEADS_C,
};

/** A static, source-aware headshot. Every crop is fitted in full, on the pixel grid. */
export function getPortraitLayout(speciesId: number, shiny: boolean, size: number) {
  const id = PORTRAIT_HEADS[speciesId] ? speciesId : 1;
  const bounds = ART_BOUNDS[id];
  const [sourceX, sourceY, sourceWidth, sourceHeight] = PORTRAIT_HEADS[id];
  const crop = shiny
    ? SHINY_PORTRAIT_HEADS[id] || [
        sourceX + bounds.shiny[0] - bounds.static[0],
        sourceY + bounds.shiny[1] - bounds.static[1],
        sourceWidth,
        sourceHeight,
      ]
    : [sourceX, sourceY, sourceWidth, sourceHeight];
  const [x, y, cropWidth, cropHeight] = crop;
  const canvas = shiny ? bounds.shinyCanvas : bounds.staticCanvas;
  // Powers of two preserve an even pixel grid; large heads can reduce by half
  // without arbitrarily stretching source pixels or cutting off ears/horns.
  let scale = 2 ** Math.floor(Math.log2(size / Math.max(cropWidth, cropHeight)));
  const measure = () => ({
    originX: Math.floor(x * scale),
    originY: Math.floor(y * scale),
    width: Math.ceil((x + cropWidth) * scale) - Math.floor(x * scale),
    height: Math.ceil((y + cropHeight) * scale) - Math.floor(y * scale),
  });
  let pixels = measure();
  // Account for outward rounding when a large native head is downsampled.
  if (pixels.width > size || pixels.height > size) {
    scale /= 2;
    pixels = measure();
  }
  const { originX, originY, width, height } = pixels;
  return {
    width,
    height,
    left: Math.floor((size - width) / 2),
    top: Math.floor((size - height) / 2),
    scale,
    backgroundSize: `${canvas[0] * scale}px ${canvas[1] * scale}px`,
    backgroundPosition: `${-originX}px ${-originY}px`,
    url: shiny ? `shiny/${id}.png` : bounds.staticUrl || SPRITES[id].staticUrl,
  };
}
