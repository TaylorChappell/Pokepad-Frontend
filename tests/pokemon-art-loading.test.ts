import test from 'node:test';
import assert from 'node:assert/strict';
import {
  preloadPokemonArtwork,
  pokemonArtworkSources,
} from '../src/components/pokemon-art-loading';

test('reward preload includes animated and still pixel art, and respects shiny/drawn/reduced-motion choices', () => {
  const moving = pokemonArtworkSources({ id: 4 });
  assert.ok(moving.length > 1);
  assert.ok(moving.every((src) => src.includes('assets/')));
  const still = pokemonArtworkSources({ id: 4, reducedMotion: true });
  assert.equal(still.length, 1);
  assert.ok(moving.includes(still[0]));
  assert.match(pokemonArtworkSources({ id: 6, shiny: true })[0], /shiny\/6\.png$/);
  assert.match(pokemonArtworkSources({ id: 6, artStyle: 'drawn' })[0], /pokemon\/6\.png$/);
  assert.match(
    pokemonArtworkSources({ id: 6, shiny: true, artStyle: 'drawn' })[0],
    /official-artwork\/shiny\/6\.png$/,
  );
});

test('preload waits for image decoding, reuses decoded art, and retries a failed image', async () => {
  const original = globalThis.Image;
  const requests: { src: string; resolve: () => void; reject: (reason: Error) => void }[] = [];
  class TestImage {
    src = '';
    onload = null;
    onerror = null;
    decode() {
      return new Promise<void>((resolve, reject) =>
        requests.push({ src: this.src, resolve, reject }),
      );
    }
  }
  Object.defineProperty(globalThis, 'Image', {
    value: TestImage,
    configurable: true,
    writable: true,
  });
  try {
    let done = false;
    const first = preloadPokemonArtwork({ id: 25, shiny: true }).then(() => {
      done = true;
    });
    await Promise.resolve();
    assert.equal(done, false);
    assert.equal(requests.length, 1);
    requests[0].resolve();
    await first;
    await preloadPokemonArtwork({ id: 25, shiny: true });
    assert.equal(requests.length, 1, 'Decoded pixels remain cached for the reveal');
    const failed = preloadPokemonArtwork({ id: 133, shiny: true });
    const rejected = assert.rejects(failed, /network/);
    requests[1].reject(new Error('network'));
    await rejected;
    const retry = preloadPokemonArtwork({ id: 133, shiny: true });
    assert.equal(requests.length, 3);
    requests[2].resolve();
    await retry;
  } finally {
    Object.defineProperty(globalThis, 'Image', {
      value: original,
      configurable: true,
      writable: true,
    });
  }
});
