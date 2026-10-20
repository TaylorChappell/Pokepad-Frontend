import base64, concurrent.futures, hashlib, io, json, os, re, time, urllib.request
from pathlib import Path
from PIL import Image, ImageSequence, features
ROOT = Path(os.environ.get('GITHUB_WORKSPACE', Path.cwd()))
HELPERS = ROOT / '.pokepad-import'
manifest = json.loads((HELPERS / 'manifest.json').read_text())
bundled = json.loads((HELPERS / 'bundled.json').read_text())
bundled['public/assets/fonts/PixelifySans-OFL.txt'] = 'Q29weXJpZ2h0IDIwMjEgVGhlIFBpeGVsaWZ5IFNhbnMgUHJvamVjdCBBdXRob3JzIChodHRwczovL2dpdGh1Yi5jb20vZWlmZXR4L1BpeGVsaWZ5LVNhbnMpDQoNClRoaXMgRm9udCBTb2Z0d2FyZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgU0lMIE9wZW4gRm9udCBMaWNlbnNlLCBWZXJzaW9uIDEuMS4NClRoaXMgbGljZW5zZSBpcyBjb3BpZWQgYmVsb3csIGFuZCBpcyBhbHNvIGF2YWlsYWJsZSB3aXRoIGEgRkFRIGF0Og0KaHR0cHM6Ly9zY3JpcHRzLnNpbC5vcmcvT0ZMDQoNCg0KLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0NClNJTCBPUEVOIEZPTlQgTElDRU5TRSBWZXJzaW9uIDEuMSAtIDI2IEZlYnJ1YXJ5IDIwMDcNCi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tDQoNClBSRUFNQkxFDQpUaGUgZ29hbHMgb2YgdGhlIE9wZW4gRm9udCBMaWNlbnNlIChPRkwpIGFyZSB0byBzdGltdWxhdGUgd29ybGR3aWRlDQpkZXZlbG9wbWVudCBvZiBjb2xsYWJvcmF0aXZlIGZvbnQgcHJvamVjdHMsIHRvIHN1cHBvcnQgdGhlIGZvbnQgY3JlYXRpb24NCmVmZm9ydHMgb2YgYWNhZGVtaWMgYW5kIGxpbmd1aXN0aWMgY29tbXVuaXRpZXMsIGFuZCB0byBwcm92aWRlIGEgZnJlZSBhbmQNCm9wZW4gZnJhbWV3b3JrIGluIHdoaWNoIGZvbnRzIG1heSBiZSBzaGFyZWQgYW5kIGltcHJvdmVkIGluIHBhcnRuZXJzaGlwDQp3aXRoIG90aGVycy4NCg0KVGhlIE9GTCBhbGxvd3MgdGhlIGxpY2Vuc2VkIGZvbnRzIHRvIGJlIHVzZWQsIHN0dWRpZWQsIG1vZGlmaWVkIGFuZA0KcmVkaXN0cmlidXRlZCBmcmVlbHkgYXMgbG9uZyBhcyB0aGV5IGFyZSBub3Qgc29sZCBieSB0aGVtc2VsdmVzLiBUaGUNCmZvbnRzLCBpbmNsdWRpbmcgYW55IGRlcml2YXRpdmUgd29ya3MsIGNhbiBiZSBidW5kbGVkLCBlbWJlZGRlZCwgDQpyZWRpc3RyaWJ1dGVkIGFuZC9vciBzb2xkIHdpdGggYW55IHNvZnR3YXJlIHByb3ZpZGVkIHRoYXQgYW55IHJlc2VydmVkDQpuYW1lcyBhcmUgbm90IHVzZWQgYnkgZGVyaXZhdGl2ZSB3b3Jrcy4gVGhlIGZvbnRzIGFuZCBkZXJpdmF0aXZlcywNCmhvd2V2ZXIsIGNhbm5vdCBiZSByZWxlYXNlZCB1bmRlciBhbnkgb3RoZXIgdHlwZSBvZiBsaWNlbnNlLiBUaGUNCnJlcXVpcmVtZW50IGZvciBmb250cyB0byByZW1haW4gdW5kZXIgdGhpcyBsaWNlbnNlIGRvZXMgbm90IGFwcGx5DQp0byBhbnkgZG9jdW1lbnQgY3JlYXRlZCB1c2luZyB0aGUgZm9udHMgb3IgdGhlaXIgZGVyaXZhdGl2ZXMuDQoNCkRFRklOSVRJT05TDQoiRm9udCBTb2Z0d2FyZSIgcmVmZXJzIHRvIHRoZSBzZXQgb2YgZmlsZXMgcmVsZWFzZWQgYnkgdGhlIENvcHlyaWdodA0KSG9sZGVyKHMpIHVuZGVyIHRoaXMgbGljZW5zZSBhbmQgY2xlYXJseSBtYXJrZWQgYXMgc3VjaC4gVGhpcyBtYXkNCmluY2x1ZGUgc291cmNlIGZpbGVzLCBidWlsZCBzY3JpcHRzIGFuZCBkb2N1bWVudGF0aW9uLg0KDQoiUmVzZXJ2ZWQgRm9udCBOYW1lIiByZWZlcnMgdG8gYW55IG5hbWVzIHNwZWNpZmllZCBhcyBzdWNoIGFmdGVyIHRoZQ0KY29weXJpZ2h0IHN0YXRlbWVudChzKS4NCg0KIk9yaWdpbmFsIFZlcnNpb24iIHJlZmVycyB0byB0aGUgY29sbGVjdGlvbiBvZiBGb250IFNvZnR3YXJlIGNvbXBvbmVudHMgYXMNCmRpc3RyaWJ1dGVkIGJ5IHRoZSBDb3B5cmlnaHQgSG9sZGVyKHMpLg0KDQoiTW9kaWZpZWQgVmVyc2lvbiIgcmVmZXJzIHRvIGFueSBkZXJpdmF0aXZlIG1hZGUgYnkgYWRkaW5nIHRvLCBkZWxldGluZywNCm9yIHN1YnN0aXR1dGluZyAtLSBpbiBwYXJ0IG9yIGluIHdob2xlIC0tIGFueSBvZiB0aGUgY29tcG9uZW50cyBvZiB0aGUNCk9yaWdpbmFsIFZlcnNpb24sIGJ5IGNoYW5naW5nIGZvcm1hdHMgb3IgYnkgcG9ydGluZyB0aGUgRm9udCBTb2Z0d2FyZSB0byBhDQpuZXcgZW52aXJvbm1lbnQuDQoNCiJBdXRob3IiIHJlZmVycyB0byBhbnkgZGVzaWduZXIsIGVuZ2luZWVyLCBwcm9ncmFtbWVyLCB0ZWNobmljYWwNCndyaXRlciBvciBvdGhlciBwZXJzb24gd2hvIGNvbnRyaWJ1dGVkIHRvIHRoZSBGb250IFNvZnR3YXJlLg0KDQpQRVJNSVNTSU9OICYgQ09ORElUSU9OUw0KUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nDQphIGNvcHkgb2YgdGhlIEZvbnQgU29mdHdhcmUsIHRvIHVzZSwgc3R1ZHksIGNvcHksIG1lcmdlLCBlbWJlZCwgbW9kaWZ5LA0KcmVkaXN0cmlidXRlLCBhbmQgc2VsbCBtb2RpZmllZCBhbmQgdW5tb2RpZmllZCBjb3BpZXMgb2YgdGhlIEZvbnQNClNvZnR3YXJlLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczoNCg0KMSkgTmVpdGhlciB0aGUgRm9udCBTb2Z0d2FyZSBub3IgYW55IG9mIGl0cyBpbmRpdmlkdWFsIGNvbXBvbmVudHMsDQppbiBPcmlnaW5hbCBvciBNb2RpZmllZCBWZXJzaW9ucywgbWF5IGJlIHNvbGQgYnkgaXRzZWxmLg0KDQoyKSBPcmlnaW5hbCBvciBNb2RpZmllZCBWZXJzaW9ucyBvZiB0aGUgRm9udCBTb2Z0d2FyZSBtYXkgYmUgYnVuZGxlZCwNCnJlZGlzdHJpYnV0ZWQgYW5kL29yIHNvbGQgd2l0aCBhbnkgc29mdHdhcmUsIHByb3ZpZGVkIHRoYXQgZWFjaCBjb3B5DQpjb250YWlucyB0aGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBsaWNlbnNlLiBUaGVzZSBjYW4gYmUNCmluY2x1ZGVkIGVpdGhlciBhcyBzdGFuZC1hbG9uZSB0ZXh0IGZpbGVzLCBodW1hbi1yZWFkYWJsZSBoZWFkZXJzIG9yDQppbiB0aGUgYXBwcm9wcmlhdGUgbWFjaGluZS1yZWFkYWJsZSBtZXRhZGF0YSBmaWVsZHMgd2l0aGluIHRleHQgb3INCmJpbmFyeSBmaWxlcyBhcyBsb25nIGFzIHRob3NlIGZpZWxkcyBjYW4gYmUgZWFzaWx5IHZpZXdlZCBieSB0aGUgdXNlci4NCg0KMykgTm8gTW9kaWZpZWQgVmVyc2lvbiBvZiB0aGUgRm9udCBTb2Z0d2FyZSBtYXkgdXNlIHRoZSBSZXNlcnZlZCBGb250DQpOYW1lKHMpIHVubGVzcyBleHBsaWNpdCB3cml0dGVuIHBlcm1pc3Npb24gaXMgZ3JhbnRlZCBieSB0aGUgY29ycmVzcG9uZGluZw0KQ29weXJpZ2h0IEhvbGRlci4gVGhpcyByZXN0cmljdGlvbiBvbmx5IGFwcGxpZXMgdG8gdGhlIHByaW1hcnkgZm9udCBuYW1lIGFzDQpwcmVzZW50ZWQgdG8gdGhlIHVzZXJzLg0KDQo0KSBUaGUgbmFtZShzKSBvZiB0aGUgQ29weXJpZ2h0IEhvbGRlcihzKSBvciB0aGUgQXV0aG9yKHMpIG9mIHRoZSBGb250DQpTb2Z0d2FyZSBzaGFsbCBub3QgYmUgdXNlZCB0byBwcm9tb3RlLCBlbmRvcnNlIG9yIGFkdmVydGlzZSBhbnkNCk1vZGlmaWVkIFZlcnNpb24sIGV4Y2VwdCB0byBhY2tub3dsZWRnZSB0aGUgY29udHJpYnV0aW9uKHMpIG9mIHRoZQ0KQ29weXJpZ2h0IEhvbGRlcihzKSBhbmQgdGhlIEF1dGhvcihzKSBvciB3aXRoIHRoZWlyIGV4cGxpY2l0IHdyaXR0ZW4NCnBlcm1pc3Npb24uDQoNCjUpIFRoZSBGb250IFNvZnR3YXJlLCBtb2RpZmllZCBvciB1bm1vZGlmaWVkLCBpbiBwYXJ0IG9yIGluIHdob2xlLA0KbXVzdCBiZSBkaXN0cmlidXRlZCBlbnRpcmVseSB1bmRlciB0aGlzIGxpY2Vuc2UsIGFuZCBtdXN0IG5vdCBiZQ0KZGlzdHJpYnV0ZWQgdW5kZXIgYW55IG90aGVyIGxpY2Vuc2UuIFRoZSByZXF1aXJlbWVudCBmb3IgZm9udHMgdG8NCnJlbWFpbiB1bmRlciB0aGlzIGxpY2Vuc2UgZG9lcyBub3QgYXBwbHkgdG8gYW55IGRvY3VtZW50IGNyZWF0ZWQNCnVzaW5nIHRoZSBGb250IFNvZnR3YXJlLg0KDQpURVJNSU5BVElPTg0KVGhpcyBsaWNlbnNlIGJlY29tZXMgbnVsbCBhbmQgdm9pZCBpZiBhbnkgb2YgdGhlIGFib3ZlIGNvbmRpdGlvbnMgYXJlDQpub3QgbWV0Lg0KDQpESVNDTEFJTUVSDQpUSEUgRk9OVCBTT0ZUV0FSRSBJUyBQUk9WSURFRCAiQVMgSVMiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELA0KRVhQUkVTUyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIEFOWSBXQVJSQU5USUVTIE9GDQpNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQNCk9GIENPUFlSSUdIVCwgUEFURU5ULCBUUkFERU1BUkssIE9SIE9USEVSIFJJR0hULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUNCkNPUFlSSUdIVCBIT0xERVIgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLA0KSU5DTFVESU5HIEFOWSBHRU5FUkFMLCBTUEVDSUFMLCBJTkRJUkVDVCwgSU5DSURFTlRBTCwgT1IgQ09OU0VRVUVOVElBTA0KREFNQUdFUywgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HDQpGUk9NLCBPVVQgT0YgVEhFIFVTRSBPUiBJTkFCSUxJVFkgVE8gVVNFIFRIRSBGT05UIFNPRlRXQVJFIE9SIEZST00NCk9USEVSIERFQUxJTkdTIElOIFRIRSBGT05UIFNPRlRXQVJFLg0K'

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
