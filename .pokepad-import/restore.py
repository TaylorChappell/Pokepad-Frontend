import base64, concurrent.futures, hashlib, io, json, os, re, time, urllib.request
from pathlib import Path
from PIL import Image, ImageSequence, features
ROOT = Path(os.environ.get('GITHUB_WORKSPACE', Path.cwd()))
HELPERS = ROOT / '.pokepad-import'
manifest = json.loads((HELPERS / 'manifest.json').read_text())
bundled = json.loads((HELPERS / 'bundled.json').read_text())

def blob_sha(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()

def matches(entry):
    p = ROOT / entry['path']
    return p.is_file() and blob_sha(p.read_bytes()) == entry['sha']

def write(path, data):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(data)

def fetch(url):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Pokepad-source-import/1.0'}), timeout=45) as response:
                return response.read()
        except Exception:
            if attempt == 3:
                raise
            time.sleep(attempt + 1)

for path, content in bundled.items():
    write(path, base64.b64decode(content, validate=True))

def restore_art(entry):
    if matches(entry):
        return
    path = entry['path']
    suffix = path.removeprefix('public/assets/pokemon/')
    if suffix.startswith('back/'):
        url = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/' + suffix
    else:
        url = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/' + suffix
    content = fetch(url)
    if blob_sha(content) != entry['sha']:
        raise RuntimeError('Source checksum mismatch: ' + path)
    write(path, content)

entries = {entry['path']: entry for entry in manifest}

def restore_sprite(i):
    pixel_path = 'public/assets/pixel/' + str(i) + '.png'
    sheet_path = 'public/assets/sheets/' + str(i) + '.png'
    if matches(entries[pixel_path]) and matches(entries[sheet_path]):
        return
    url = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/' + str(i) + '.gif'
    im = Image.open(io.BytesIO(fetch(url)))
    frames = []
    for frame in ImageSequence.Iterator(im):
        f = frame.convert('RGBA')
        canvas = Image.new('RGBA', (96, 96))
        canvas.alpha_composite(f, ((96 - f.width) // 2, 96 - f.height - 6))
        frames.append(canvas)
    sheet = Image.new('RGBA', (96 * len(frames), 96))
    for n, frame in enumerate(frames):
        sheet.alpha_composite(frame, (96 * n, 0))
    for path, image in [(sheet_path, sheet), (pixel_path, frames[0])]:
        buffer = io.BytesIO()
        image.save(buffer, format='PNG', optimize=True)
        content = buffer.getvalue()
        if blob_sha(content) != entries[path]['sha']:
            raise RuntimeError('Generated sprite checksum mismatch: ' + path + '; Pillow zlib ' + features.version_codec('zlib'))
        write(path, content)

with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
    futures = [pool.submit(restore_art, e) for e in manifest if e['path'].startswith('public/assets/pokemon/')]
    futures += [pool.submit(restore_sprite, i) for i in range(1, 152)]
    for count, future in enumerate(concurrent.futures.as_completed(futures), 1):
        future.result()
        if count % 50 == 0:
            print('Restored', count, 'artwork tasks', flush=True)

errors = [entry['path'] for entry in manifest if not matches(entry)]
if errors:
    raise RuntimeError('Frontend checksum verification failed: ' + ', '.join(errors))
print('Verified all', len(manifest), 'frontend files against the original source.', flush=True)
