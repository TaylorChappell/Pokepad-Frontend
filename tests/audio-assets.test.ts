import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MOVE_SOUNDS, BATTLE_SOUNDS, REVEAL_SOUNDS } from '../src/audio/catalog';
import { PRESENTED_MOVES } from '../src/battle/presentation';

const directory = new URL('../public/assets/audio/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8')) as {
  revision: string;
  assets: Record<
    string,
    {
      source: string;
      sourceUrl: string;
      sourceSha256: string;
      file: string;
      sha256: string;
      durationSeconds: number;
      bytes: number;
    }
  >;
};

test('every playable move and reveal phase has a verified local recorded sound', () => {
  assert.deepEqual(Object.keys(MOVE_SOUNDS).sort(), [...PRESENTED_MOVES].sort());
  assert.equal(Object.keys(MOVE_SOUNDS).length, 48);
  const layers = [
    ...Object.values(MOVE_SOUNDS),
    ...Object.values(BATTLE_SOUNDS),
    ...Object.values(REVEAL_SOUNDS).flatMap((phases) => Object.values(phases)),
  ].flat();
  const referenced = new Set(layers.map((layer) => layer.file));
  assert.deepEqual([...referenced].sort(), Object.keys(manifest.assets).sort());
  for (const layer of layers) {
    assert.ok(layer.duration! > 0 && layer.duration! <= 4, layer.file);
    assert.ok((layer.delay ?? 0) >= 0);
    assert.ok((layer.offset ?? 0) >= 0);
    assert.ok(
      (layer.offset ?? 0) < manifest.assets[layer.file].durationSeconds,
      'slice begins inside source recording',
    );
    assert.ok((layer.volume ?? 0.8) > 0 && (layer.volume ?? 0.8) <= 1);
  }
  for (const [name, entry] of Object.entries(manifest.assets)) {
    const bytes = readFileSync(new URL(entry.file, directory));
    assert.equal(bytes.length, entry.bytes, name);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, name);
    assert.ok(bytes.length > 800 && entry.durationSeconds > 0.05, `${name} is a real clip`);
    assert.match(entry.sourceSha256, /^[a-f0-9]{64}$/);
    assert.ok(entry.sourceUrl.includes(`/${manifest.revision}/${entry.source}`));
    assert.ok(entry.source.endsWith('.ogg'));
  }
});
