#!/usr/bin/env python3
"""Reproduce Kanto's pinned PMDO sound imports (Python 3 + ffmpeg required).

Uses the committed source manifest, verifies every original SHA-256 before conversion,
and refreshes output metadata. No ROM, runtime CDN, or synthesized replacement is used.
"""
import concurrent.futures
import hashlib
import json
import pathlib
import subprocess
import tempfile
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'public/assets/audio/manifest.json'


def main():
    manifest = json.loads(MANIFEST.read_text())
    with tempfile.TemporaryDirectory(prefix='kanto-sounds-') as temporary:
        def convert(item):
            name, entry = item
            original = pathlib.Path(temporary) / (name + '.ogg')
            data = urllib.request.urlopen(entry['sourceUrl'], timeout=40).read()
            if hashlib.sha256(data).hexdigest() != entry['sourceSha256']:
                raise RuntimeError(f'Source checksum mismatch: {name}')
            original.write_bytes(data)
            output = ROOT / 'public/assets/audio' / entry['file']
            output.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run([
                'ffmpeg', '-v', 'error', '-y', '-i', str(original), '-map_metadata', '-1',
                '-ar', '44100', '-c:a', 'libmp3lame', '-q:a', '4', str(output),
            ], check=True)
            entry['sha256'] = hashlib.sha256(output.read_bytes()).hexdigest()
            entry['bytes'] = output.stat().st_size
            entry['durationSeconds'] = float(subprocess.check_output([
                'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                '-of', 'default=nw=1:nk=1', str(output),
            ]))
            return name, entry

        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            manifest['assets'] = dict(executor.map(convert, manifest['assets'].items()))
    MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n')
    print(f"Imported {len(manifest['assets'])} verified sound samples.")


if __name__ == '__main__':
    main()
