import type { CSSProperties } from 'react';
import { asset } from '../utils';

// Pixel-aligned jacket regions from the original trainer sprites. Only clothing is
// recoloured: skin, hair, eyes and black outlines remain the original artwork.
const jackets = {
  brock: {
    body: 'M30 19h1v1h-1zM32 19h2v1h-2zM30 20h2v1h-2zM38 21h1v1h-1zM23 22h2v1h-2zM37 22h2v1h-2zM23 23h2v1h-2zM37 23h1v1h-1zM39 23h1v1h-1zM22 24h3v1h-3zM36 24h3v1h-3zM21 25h1v1h-1zM23 25h2v1h-2zM26 25h3v1h-3zM30 25h5v1h-5zM36 25h1v1h-1zM38 25h3v1h-3zM20 26h2v1h-2zM23 26h2v1h-2zM26 26h3v1h-3zM30 26h6v1h-6zM37 26h1v1h-1zM39 26h4v1h-4zM20 27h4v1h-4zM26 27h2v1h-2zM29 27h7v1h-7zM39 27h3v1h-3zM20 28h3v1h-3zM26 28h2v1h-2zM29 28h6v1h-6zM40 28h1v1h-1zM29 29h1v1h-1zM31 29h1v1h-1zM33 29h1v1h-1zM30 30h1v1h-1zM32 30h1v1h-1zM31 31h1v1h-1z',
    shadow:
      'M28 19h2v1h-2zM29 20h1v1h-1zM32 20h1v1h-1zM37 20h1v1h-1zM23 21h2v1h-2zM22 22h1v1h-1zM39 22h1v1h-1zM22 23h1v1h-1zM38 23h1v1h-1zM21 24h1v1h-1zM39 24h2v1h-2zM20 25h1v1h-1zM22 25h1v1h-1zM25 25h1v1h-1zM29 25h1v1h-1zM35 25h1v1h-1zM37 25h1v1h-1zM41 25h2v1h-2zM19 26h1v1h-1zM22 26h1v1h-1zM25 26h1v1h-1zM29 26h1v1h-1zM36 26h1v1h-1zM38 26h1v1h-1zM43 26h1v1h-1zM19 27h1v1h-1zM25 27h1v1h-1zM28 27h1v1h-1zM38 27h1v1h-1zM23 28h1v1h-1zM25 28h1v1h-1zM28 28h1v1h-1zM35 28h2v1h-2zM39 28h1v1h-1zM41 28h1v1h-1zM21 29h2v1h-2zM25 29h4v1h-4zM30 29h1v1h-1zM32 29h1v1h-1zM34 29h3v1h-3zM40 29h1v1h-1zM26 30h4v1h-4zM31 30h1v1h-1zM35 30h1v1h-1zM26 31h5v1h-5zM32 31h1v1h-1zM35 31h1v1h-1zM25 32h1v1h-1zM27 32h5v1h-5zM34 32h2v1h-2zM25 33h1v1h-1zM27 33h5v1h-5zM34 33h2v1h-2zM25 34h11v1h-11zM25 35h10v1h-10zM26 36h7v1h-7z',
  },
  blue: {
    body: 'M26 24h2v1h-2zM35 24h1v1h-1zM25 25h4v1h-4zM35 25h1v1h-1zM25 26h4v1h-4zM30 26h1v1h-1zM34 26h1v1h-1zM36 26h2v1h-2zM27 27h2v1h-2zM30 27h2v1h-2zM33 27h1v1h-1zM36 27h3v1h-3zM29 28h3v1h-3zM33 28h3v1h-3zM37 28h1v1h-1zM29 29h7v1h-7zM29 30h6v1h-6zM29 31h3v1h-3zM26 35h1v1h-1zM29 35h1v1h-1zM31 35h2v1h-2zM25 36h5v1h-5zM25 37h1v1h-1zM25 38h1v1h-1zM27 38h1v1h-1zM26 39h1v1h-1z',
    shadow:
      'M28 23h1v1h-1zM30 23h1v1h-1zM32 23h1v1h-1zM25 24h1v1h-1zM28 24h4v1h-4zM30 25h2v1h-2zM34 25h1v1h-1zM36 25h1v1h-1zM24 26h1v1h-1zM31 26h1v1h-1zM33 26h1v1h-1zM35 26h1v1h-1zM38 26h1v1h-1zM32 27h1v1h-1zM34 27h2v1h-2zM39 27h1v1h-1zM32 28h1v1h-1zM36 28h1v1h-1zM38 28h2v1h-2zM37 29h3v1h-3zM35 30h1v1h-1zM37 30h4v1h-4zM28 31h1v1h-1zM32 31h4v1h-4zM38 31h2v1h-2zM28 32h8v1h-8zM28 33h8v1h-8zM26 34h1v1h-1zM29 34h6v1h-6zM29 37h6v1h-6zM28 38h6v1h-6zM28 39h6v1h-6z',
  },
};

export function trainerClothingColors(color: string) {
  const normalized = /^#[0-9a-f]{6}$/i.test(color) ? color : '#4e9ee8';
  const rgb = [1, 3, 5].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16));
  const shade = rgb.map((channel, index) =>
    Math.round(channel * 0.56 + [35, 54, 77][index] * 0.44),
  );
  return { body: normalized, shadow: `rgb(${shade.join(' ')})` };
}

/** Keeps the existing portrait crop while making its visible jacket customizable. */
export function TrainerPalettePixels({
  character,
  color,
  className,
  style,
  label,
}: {
  character: 'brock' | 'blue';
  color: string;
  className?: string;
  style?: CSSProperties;
  label?: string;
}) {
  const palette = trainerClothingColors(color);
  const jacket = jackets[character];
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      style={style}
      role="img"
      aria-label={label || `${character} trainer avatar`}
      focusable="false"
    >
      <image
        href={asset(`trainers/${character}.png`)}
        width="64"
        height="64"
        style={{ imageRendering: 'pixelated' }}
      />
      <g shapeRendering="crispEdges" aria-hidden="true">
        <path d={jacket.body} fill={palette.body} />
        <path d={jacket.shadow} fill={palette.shadow} />
      </g>
    </svg>
  );
}
