import { SPRITES } from '../data/sprites';
import { ART_BOUNDS } from '../data/art-bounds';
import { asset } from '../utils';

export function pokemonArtworkSources({
  id,
  shiny = false,
  artStyle = 'pixel',
  reducedMotion = false,
}: {
  id: number;
  shiny?: boolean;
  artStyle?: 'pixel' | 'drawn';
  reducedMotion?: boolean;
}) {
  if (artStyle === 'drawn')
    return [
      shiny
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${id}.png`
        : asset(`pokemon/${id}.png`),
    ];
  if (shiny) return [asset(`shiny/${id}.png`)];
  const sprite = SPRITES[id] || SPRITES[1];
  const bounds = ART_BOUNDS[id] || ART_BOUNDS[1];
  return [
    ...new Set([
      asset(bounds.staticUrl || sprite.staticUrl),
      ...(!reducedMotion && sprite.frames > 1 ? [asset(bounds.animatedUrl || sprite.url)] : []),
    ]),
  ];
}

// Retain decoded images across the handoff from opening animation to visible artwork.
const decoded = new Map<string, Promise<HTMLImageElement>>();
function prepareImage(src: string) {
  const existing = decoded.get(src);
  if (existing) return existing;
  const image = new Image();
  const ready = new Promise<HTMLImageElement>((resolve, reject) => {
    let finished = false;
    const finish = (error?: unknown) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      image.onload = image.onerror = null;
      if (error) reject(error);
      else resolve(image);
    };
    const timer = setTimeout(() => finish(new Error('Artwork download timed out')), 15000);
    image.onerror = () => finish(new Error('Artwork unavailable'));
    if (!image.decode) image.onload = () => finish();
    image.src = src;
    if (image.decode)
      void image.decode().then(
        () => finish(),
        (error) => finish(error || new Error('Artwork unavailable')),
      );
  });
  decoded.set(src, ready);
  void ready.catch(() => {
    if (decoded.get(src) === ready) decoded.delete(src);
  });
  if (decoded.size > 32) decoded.delete(decoded.keys().next().value!);
  return ready;
}

export function preloadPokemonArtwork(options: Parameters<typeof pokemonArtworkSources>[0]) {
  return Promise.all(pokemonArtworkSources(options).map(prepareImage));
}
