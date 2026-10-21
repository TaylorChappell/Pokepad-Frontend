#!/usr/bin/env python3
"""Import original PMDCollab PNGs as two-view SVG atlases plus measured metadata.

Requires Pillow for read-only alpha/marker inspection. Raster source bytes are
embedded unchanged, never resampled/repainted. Only SVG viewports select the
original front/down-left and rear/up-right direction rows.
"""
from __future__ import annotations
import argparse, base64, concurrent.futures, gzip, hashlib, io, json, math
from pathlib import Path
import time, urllib.request, xml.etree.ElementTree as ET, zipfile
from PIL import Image

COMMIT = '0250bd6e62029bb896276a7f6bcb2385ed1a02f0'
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/battle/pmd'
CACHE = Path('/tmp/pmd-battle-cache')
ACTIONS = ('Idle','Walk','Attack','Strike','Shoot','Swing','Kick','Dance','Shake',
           'Sleep','Hurt','Faint','Charge','Hop','Pose','Rotate','DeepBreath',
           )
# The PMD direction order is clockwise from down, NOT counterclockwise.
ROWS = {'front': 7, 'back': 3}


def get(url: str, attempts: int = 4) -> bytes:
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'Pokepad-PMD-asset-import/1.0'}), timeout=75) as r:
                return r.read()
        except Exception:
            if attempt + 1 == attempts: raise
            time.sleep(1 + attempt * 2)
    raise AssertionError('unreachable')


def sprite_zip(i: int, variant: str) -> tuple[zipfile.ZipFile, bytes]:
    CACHE.mkdir(parents=True, exist_ok=True)
    p = CACHE / f'{i:04d}-{variant}.zip'
    if not p.exists():
        form = '/0000/0001' if variant == 'shiny' else ''
        data = get(f'https://spriteserver.pmdcollab.org/assets/{i:04d}{form}/sprites.zip')
        zipfile.ZipFile(io.BytesIO(data)).testzip()
        p.write_bytes(data)
    data = p.read_bytes()
    return zipfile.ZipFile(io.BytesIO(data)), data


def alpha_bounds(im: Image.Image) -> list[int]:
    b = im.getchannel('A').getbbox()
    return [b[0], b[1], b[2]-b[0], b[3]-b[1]] if b else [0,0,0,0]


def markers(im: Image.Image, shadow: Image.Image) -> dict[str, list[int]]:
    pts = {}; ground = None
    pixels=im.load();box=im.getchannel('A').getbbox() or (0,0,0,0)
    for y in range(box[1],box[3]):
        for x in range(box[0],box[2]):
            r,g,b,a = pixels[x,y]
            if not a: continue
            if not (r or g or b): pts['head'] = [x,y]
            if r: pts['leftHand'] = [x,y]
            if g: pts['body'] = [x,y]
            if b: pts['rightHand'] = [x,y]
    pixels=shadow.load();box=shadow.getchannel('A').getbbox() or (0,0,0,0)
    for y in range(box[1],box[3]):
        for x in range(box[0],box[2]):
            if pixels[x,y] == (255,255,255,255): ground = [x,y]
    pts['feet'] = ground if ground is not None else [im.width//2, im.height//2]
    pts.setdefault('body', [im.width//2, im.height//2])
    for name in ('head','leftHand','rightHand'): pts.setdefault(name, pts['body'].copy())
    return pts


def union(rects: list[list[int]]) -> list[int]:
    rects = [r for r in rects if r[2] and r[3]]
    if not rects: return [0,0,1,1]
    x=min(r[0] for r in rects); y=min(r[1] for r in rects)
    return [x,y,max(r[0]+r[2] for r in rects)-x,max(r[1]+r[3] for r in rects)-y]


def parse_variant(i: int, variant: str):
    z, rawzip = sprite_zip(i,variant)
    rawxml=z.read('AnimData.xml')
    doc=ET.fromstring(rawxml); anims={a.findtext('Name'):a for a in doc.find('Anims')}
    def resolve(name):
        visited=set()
        while anims[name].findtext('CopyOf'):
            if name in visited: raise ValueError(f'{i} alias cycle {name}')
            visited.add(name); name=anims[name].findtext('CopyOf')
        return name
    selected={a:resolve(a) for a in ACTIONS if a in anims}
    sources={}; excluded={}; clips={}
    for action in sorted(set(selected.values())):
        a=anims[action]; w=int(a.findtext('FrameWidth')); h=int(a.findtext('FrameHeight'))
        dur=[int(d.text) for d in a.find('Durations')]
        b=z.read(f'{action}-Anim.png'); im=Image.open(io.BytesIO(b)).convert('RGBA')
        directions=im.height//h
        if directions != 8:
            excluded[action]={'directions':directions,'reason':'No authored rear/front battle direction pair'}
            continue
        if im.width != w*len(dur): raise ValueError(f'{i} {variant} {action} width != duration count')
        offsetbytes=z.read(f'{action}-Offsets.png');shadowbytes=z.read(f'{action}-Shadow.png')
        off=Image.open(io.BytesIO(offsetbytes)).convert('RGBA')
        shadow=Image.open(io.BytesIO(shadowbytes)).convert('RGBA')
        if off.size != im.size or shadow.size != im.size: raise ValueError('mismatched sheets')
        source={'name':action,'w':w,'h':h,'imageWidth':im.width,'imageHeight':im.height,
                'bytes':b,'frames':{},'durations':dur,'sha256':hashlib.sha256(b).hexdigest(),
                'offsetsSha256':hashlib.sha256(offsetbytes).hexdigest(),'shadowSha256':hashlib.sha256(shadowbytes).hexdigest()}
        for k,tag in [('rushFrame','RushFrame'),('hitFrame','HitFrame'),('returnFrame','ReturnFrame')]:
            if a.findtext(tag) is not None: source[k]=int(a.findtext(tag))
        for view,row in ROWS.items():
            frames=[]
            for n in range(len(dur)):
                box=(n*w,row*h,(n+1)*w,(row+1)*h)
                bounds=alpha_bounds(im.crop(box)); anchors=markers(off.crop(box),shadow.crop(box))
                frames.append({'bounds':bounds,'anchors':anchors})
            source['frames'][view]=frames
        sources[action]=source
    for action,resolved in selected.items():
        if resolved in sources: clips[action]=resolved
    for required in ('Idle','Walk','Attack','Hurt'):
        if required not in clips: raise ValueError(f'Missing {i} {variant} {required}')
    return {'clips':clips,'sources':sources,'excluded':excluded,'shadowSize':int(doc.findtext('ShadowSize','1')),
            'zipSha256':hashlib.sha256(rawzip).hexdigest(),'xmlSha256':hashlib.sha256(rawxml).hexdigest()}


def pack(blocks):
    area=sum((b['w']+2)*(b['h']+2) for b in blocks)
    target=max(max(b['w'] for b in blocks),math.ceil(math.sqrt(area)/64)*64)
    target=min(4096,max(256,target))
    x=y=shelf=usedw=0
    for b in sorted(blocks,key=lambda b:(-b['h'],-b['w'],b['key'])):
        bw=b['w']; bh=b['h']
        if x and x+bw>target: y+=shelf+2;x=0;shelf=0
        b['frame']['atlas']=[x,y]; x+=bw+2;shelf=max(shelf,bh);usedw=max(usedw,x-2)
    return usedw,y+shelf


def build(i: int, names: dict):
    variants={v:parse_variant(i,v) for v in ('normal','shiny')}
    blocks=[]
    for v,data in variants.items():
        for name,s in data['sources'].items(): s['key']=f'{v}-{name}';blocks.append(s)
    cells=[]
    for s in blocks:
        for view,frames in s['frames'].items():
            for n,f in enumerate(frames):
                b=f['bounds'];cells.append({'w':max(1,b[2]),'h':max(1,b[3]),'frame':f,'key':f'{s["key"]}-{view}-{n:03d}'})
    aw,ah=pack(cells)
    if max(aw,ah)>8192: raise ValueError(f'Atlas exceeds 8192 for {i}: {aw}x{ah}')
    # Image cell centers share the source engine origin. Preserve every frame's
    # authored displacement, including the moving shadow marker during lunges.
    # Idle's first shadow supplies the stationary ground origin, not each frame.
    base=variants['normal'];idle=base['sources'][base['clips']['Idle']]
    idlefeet=idle['frames']['front'][0]['anchors']['feet']
    sourceground=[idlefeet[0]-idle['w']//2,idlefeet[1]-idle['h']//2]
    allbounds=[]
    for data in variants.values():
        for s in data['sources'].values():
            for frames in s['frames'].values():
                for f in frames:
                    b=f['bounds'];allbounds.append([b[0]-s['w']//2,b[1]-s['h']//2,b[2],b[3]])
    extent=union(allbounds)
    # A modest source-pixel gutter protects nearest-neighbor edges; logical
    # canvas is shared by all actions, both directions and both palettes.
    translate=[2-extent[0],2-extent[1]]
    canvas=[extent[2]+4,extent[3]+4]
    ground=[sourceground[0]+translate[0],sourceground[1]+translate[1]]
    image={'src':f'battle/pmd/{i:03d}.svg','width':aw,'height':ah}
    manifest={'id':i,'name':names[str(i)],'image':image,'canvas':canvas,'ground':ground,
              'source':{'repository':'PMDCollab/SpriteCollab','commit':COMMIT,'directionRows':ROWS},'variants':{}}
    cat={'id':i,'name':names[str(i)],'image':image,'manifest':f'battle/pmd/{i:03d}.json','canvas':canvas,'ground':ground,'variants':{}}
    defs=[]; body=[]
    for s in blocks:
        key=s['key'];w=s['imageWidth'];h=s['h'];ih=s['imageHeight']
        data64=base64.b64encode(s['bytes']).decode()
        defs.append(f'<image id="{key}" width="{w}" height="{ih}" href="data:image/png;base64,{data64}"/>')
        for view,row in ROWS.items():
            for n,f in enumerate(s['frames'][view]):
                x,y=f['atlas'];bx,by,bw,bh=f['bounds'];bw=max(1,bw);bh=max(1,bh)
                sx=n*s['w']+bx;sy=row*h+by
                body.append(f'<svg x="{x}" y="{y}" width="{bw}" height="{bh}" viewBox="{sx} {sy} {bw} {bh}" overflow="hidden"><use href="#{key}"/></svg>')
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{aw}" height="{ah}" viewBox="0 0 {aw} {ah}" style="image-rendering:pixelated"><defs>{"".join(defs)}</defs>{"".join(body)}</svg>'
    for v,data in variants.items():
        resolvedclips={}
        for name,s in data['sources'].items():
            w=s['w'];h=s['h'];offset=[translate[0]-w//2,translate[1]-h//2]
            c={k:s[k] for k in ('durations','rushFrame','hitFrame','returnFrame') if k in s}
            c['sourceAction']=name;c['sourceCell']=[w,h];c['frames']={}
            for vi,view in enumerate(ROWS):
                c['frames'][view]=[]
                for n,f in enumerate(s['frames'][view]):
                    b=f['bounds'];anchors={k:[p[0]+offset[0],p[1]+offset[1]] for k,p in f['anchors'].items()}
                    c['frames'][view].append({'rect':[*f['atlas'],max(1,b[2]),max(1,b[3])],
                                             'sourceRect':[n*w+b[0],ROWS[view]*h+b[1],max(1,b[2]),max(1,b[3])],
                                             'offset':[b[0]+offset[0],b[1]+offset[1]],
                                             'bounds':[b[0]+offset[0],b[1]+offset[1],b[2],b[3]],'anchors':anchors})
            resolvedclips[name]=c
        clips={name:resolvedclips[resolved] for name,resolved in data['clips'].items()}
        chosenidle='Walk' if len(clips['Idle']['durations'])==1 else 'Idle'
        manifest['variants'][v]={'clips':clips,'idleAction':chosenidle,'shadowSize':data['shadowSize'],'excluded':data['excluded']}
        cat['variants'][v]={'actions':list(clips),'idleAction':chosenidle,
          'bounds':{view:union([f['bounds'] for c in clips.values() for f in c['frames'][view]]) for view in ROWS},
          'idleFrame':{view:clips[chosenidle]['frames'][view][0] for view in ROWS}}
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/f'{i:03d}.svg').write_text(svg)
    (OUT/f'{i:03d}.json').write_text(json.dumps(manifest,separators=(',',':')))
    # Deterministic source checksums provide a traceable import without keeping
    # thousands of duplicate raster files in the frontend repository.
    provenance={v:{k:d[k] for k in ('zipSha256','xmlSha256')}|{
        'images':{name:s['sha256'] for name,s in d['sources'].items()},
        'markerSheets':{name:{'offsets':s['offsetsSha256'],'shadow':s['shadowSha256']} for name,s in d['sources'].items()},
        'excluded':d['excluded']}
        for v,d in variants.items()}
    return i,cat,provenance


def verify_revision():
    query=urllib.request.Request('https://spriteserver.pmdcollab.org/graphql',json.dumps({'query':'{meta{assetsCommit}}'}).encode(),{'Content-Type':'application/json'})
    actual=json.loads(urllib.request.urlopen(query,timeout=45).read())['data']['meta']['assetsCommit']
    if actual!=COMMIT:raise RuntimeError(f'Server revision {actual} differs from pinned {COMMIT}; update deliberately.')


def main():
    p=argparse.ArgumentParser();p.add_argument('--ids',default='1-151');p.add_argument('--workers',type=int,default=4)
    p.add_argument('--skip-revision-check',action='store_true',help='Only for rebuilding previously verified cached ZIPs offline')
    args=p.parse_args()
    ids=[]
    for chunk in args.ids.split(','):
        if '-' in chunk:a,b=map(int,chunk.split('-'));ids.extend(range(a,b+1))
        else:ids.append(int(chunk))
    CACHE.mkdir(parents=True,exist_ok=True)
    if not args.skip_revision_check: verify_revision()
    trackerpath=CACHE/'tracker.json'
    if not trackerpath.exists():trackerpath.write_bytes(get(f'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/{COMMIT}/tracker.json'))
    tracker=json.loads(trackerpath.read_text()); names={str(i):tracker[f'{i:04d}']['name'] for i in ids}
    cataloguepath=ROOT/'src/battle/pmd-catalogue.json'
    catalogue=json.loads(cataloguepath.read_text()) if cataloguepath.exists() else {}
    provpath=OUT/'source-manifest.json';provenance=json.loads(provpath.read_text()) if provpath.exists() else {'commit':COMMIT,'species':{}}
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures={ex.submit(build,i,names):i for i in ids}
        for future in concurrent.futures.as_completed(futures):
            i,cat,source=future.result();catalogue[str(i)]=cat;provenance['species'][str(i)]=source
            cataloguepath.write_text(json.dumps(dict(sorted(catalogue.items(),key=lambda p:int(p[0]))),separators=(',',':')))
            provenance['species']=dict(sorted(provenance['species'].items(),key=lambda p:int(p[0])))
            provpath.write_text(json.dumps(provenance,separators=(',',':')))
            print(f'{i:03d} {cat["name"]}: atlas {cat["image"]["width"]}x{cat["image"]["height"]}, canvas {cat["canvas"]}, {len(cat["variants"]["normal"]["actions"])} normal actions',flush=True)
    if not args.skip_revision_check: verify_revision()
    allmanifests=[json.loads(p.read_text()) for p in OUT.glob('[0-9]*.json')]
    uniqueclips=[c for m in allmanifests for v in m['variants'].values() for c in {c['sourceAction']:c for c in v['clips'].values()}.values()]
    report={'species':len(catalogue),'variants':len(allmanifests)*2,
       'uniqueActionStrips':len(uniqueclips),'authoredBattleFrameCells':sum(len(c['durations'])*2 for c in uniqueclips),
       'sourcePngFiles':len(uniqueclips)*3,'sourceXmlFiles':len(allmanifests)*2,'svgBytes':sum(p.stat().st_size for p in OUT.glob('*.svg')),
       'jsonBytes':sum(p.stat().st_size for p in OUT.glob('[0-9]*.json')),
       'jsonGzipBytes':sum(len(gzip.compress(p.read_bytes())) for p in OUT.glob('[0-9]*.json')),
       'catalogueBytes':cataloguepath.stat().st_size,
       'largestAtlas':max(({'id':c['id'],'dimensions':[c['image']['width'],c['image']['height']],'rgbaBytes':c['image']['width']*c['image']['height']*4} for c in catalogue.values()),key=lambda c:c['rgbaBytes'])}
    (OUT/'import-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)

if __name__=='__main__': main()
