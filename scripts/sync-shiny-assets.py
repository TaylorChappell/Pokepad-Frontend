"""Restore genuine source sprites without modifying their pixels; validate SHA-256."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen
import hashlib, json
ROOT = Path(__file__).resolve().parents[1]
def restore(entry):
    target = ROOT / entry['path']
    if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == entry['sha256']:
        return
    data = urlopen(entry['url'], timeout=45).read()
    if hashlib.sha256(data).hexdigest() != entry['sha256']:
        raise RuntimeError('Sprite checksum mismatch: ' + entry['path'])
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
entries = []
for name in ['shiny-assets.json', 'full-sprite-assets.json']:
    entries.extend(json.loads((ROOT / 'scripts' / name).read_text()))
with ThreadPoolExecutor(max_workers=12) as pool:
    list(pool.map(restore, entries))
print('Verified', len(entries), 'original Pokémon sprites')
