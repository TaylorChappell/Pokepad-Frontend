#!/usr/bin/env python3
"""Bundle original PMD effect pixels in compact SVG frame atlases.

Source PNG bytes are embedded unchanged. Pillow only reads alpha bounds; no
raster pixels are generated, recolored, resized, mirrored or otherwise edited.
Particle sheets do not contain frame durations: playback timing is explicitly
application-authored. Beam XML supplies frame counts, not frame durations.
"""
from __future__ import annotations
import argparse, base64, concurrent.futures, hashlib, io, json, math, re
from pathlib import Path
import time, urllib.request, xml.etree.ElementTree as ET
from PIL import Image

COMMIT='03c80dad937911572f8fb19903771a47956fc696'
SOURCE='https://raw.githubusercontent.com/PMDCollab/RawAsset/'+COMMIT+'/'
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/battle/effects/pmd'
CACHE=Path('/tmp/pmd-native-vfx')
INPUT=ROOT/'scripts/pmd-native-effects-sources.json'
CATALOGUE=ROOT/'src/battle/native-effect-catalogue.json'
DIRECTIONS=['down','down-left','left','up-left','up','up-right','right','down-right']


def sha(data):return hashlib.sha256(data).hexdigest()

def download(path):
    cache=CACHE/path
    if cache.exists():return cache.read_bytes()
    for attempt in range(4):
        try:
            req=urllib.request.Request(SOURCE+path,headers={'User-Agent':'Pokepad-native-effect-import/1.0'})
            data=urllib.request.urlopen(req,timeout=60).read()
            cache.parent.mkdir(parents=True,exist_ok=True);cache.write_bytes(data)
            return data
        except Exception:
            if attempt==3:raise
            time.sleep(1+attempt*2)
    raise AssertionError('unreachable')


def identity(path):
    parts=Path(path).parts
    if parts[0]=='Beam':return 'beam_'+parts[1].lower()+'_'+Path(parts[2]).stem.lower()
    stem=Path(path).name.rsplit('.',2)[0]
    return re.sub(r'[^a-z0-9_]+','_',stem.lower()).strip('_')


def layout(path, im):
    if path.startswith('Beam/'):
        xmlpath=str(Path(path).parent/'BeamData.xml');xml=download(xmlpath)
        count=int(ET.fromstring(xml).findtext('TotalFrames'))
        if im.width%count:raise ValueError(f'{path} beam width not divisible by TotalFrames={count}')
        return im.width//count,im.height,count,1,'None',{'path':xmlpath,'sha256':sha(xml),'totalFrames':count}
    suffix=Path(path).name.rsplit('.',2)[-2]
    directions={'None':1,'Dir1':1,'Flip':1,'Dir2':2,'Dir5':5,'Dir8':8}.get(suffix)
    if directions:
        if im.height%directions:raise ValueError(f'{path} invalid direction height')
        w=h=im.height//directions
        if im.width%w:raise ValueError(f'{path} non-square frame sequence')
        return w,h,im.width//w,directions,suffix,None
    if suffix.isdigit():
        count=int(suffix)
        if im.width%count:raise ValueError(f'{path} width not divisible by numeric frame count')
        return im.width//count,im.height,count,1,'None',None
    raise ValueError(f'Unknown native sheet format: {path}')


def pack(frames):
    area=sum((f['width']+2)*(f['height']+2) for f in frames)
    target=max(max(f['width'] for f in frames),math.ceil(math.sqrt(area)/32)*32)
    x=y=rowheight=usedwidth=0
    for f in sorted(frames,key=lambda f:(-f['height'],-f['width'],f['direction'],f['frame'])):
        if x and x+f['width']>target:y+=rowheight+2;x=0;rowheight=0
        f['x']=x;f['y']=y;x+=f['width']+2;usedwidth=max(usedwidth,x-2);rowheight=max(rowheight,f['height'])
    return usedwidth,y+rowheight


def build(entry):
    path=entry['sourcePath'];assetid=entry.get('id') or identity(path)
    raw=download(path)
    blobsha=hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest()
    if entry.get('gitBlobSha') and entry['gitBlobSha'] != blobsha:raise ValueError(f'{path}: source PNG differs from pinned Git blob')
    im=Image.open(io.BytesIO(raw)).convert('RGBA')
    w,h,count,dirs,mode,xml=layout(path,im)
    frames=[]
    for direction in range(dirs):
        row=[]
        for frame in range(count):
            box=(frame*w,direction*h,(frame+1)*w,(direction+1)*h)
            alpha=im.crop(box).getchannel('A').getbbox()
            x,y,r,b=alpha if alpha else (0,0,1,1)
            f={'x':0,'y':0,'width':r-x,'height':b-y,'offsetX':x,'offsetY':y,
               'sourceX':frame*w+x,'sourceY':direction*h+y,'direction':direction,'frame':frame}
            if alpha is None:f['empty']=True
            row.append(f)
        frames.append(row)
    aw,ah=pack([f for row in frames for f in row])
    if max(aw,ah)>4096:raise ValueError(f'{path} atlas too large: {aw}x{ah}')
    data64=base64.b64encode(raw).decode();body=[]
    for row in frames:
        for f in row:
            body.append(f'<svg x="{f["x"]}" y="{f["y"]}" width="{f["width"]}" height="{f["height"]}" viewBox="{f["sourceX"]} {f["sourceY"]} {f["width"]} {f["height"]}" overflow="hidden"><use href="#source"/></svg>')
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{aw}" height="{ah}" viewBox="0 0 {aw} {ah}" style="image-rendering:pixelated"><defs><image id="source" width="{im.width}" height="{im.height}" href="data:image/png;base64,{data64}"/></defs>{"".join(body)}</svg>'
    OUT.mkdir(parents=True,exist_ok=True);(OUT/f'{assetid}.svg').write_text(svg)
    pivot=entry.get('pivot') or {'x':w/2,'y':h if path.startswith('Beam/') and Path(path).name=='Body.png' else h/2}
    result={'id':assetid,'path':f'battle/effects/pmd/{assetid}.svg','width':aw,'height':ah,
            'frameWidth':w,'frameHeight':h,'frameCount':count,'pivot':pivot,'directionMode':mode,'directions':dirs,
            'directionOrder':DIRECTIONS if dirs==8 else (['down','down-left','left','up-left','up'] if dirs==5 else ['down','down-left'] if dirs==2 else ['down']),
            'frameMs':entry.get('frameMs',50),'timingSource':'Pokepad playback timing; original sheet contains no frame durations',
            'frames':frames,'sourcePath':path,'sourceCommit':COMMIT,'sourceWidth':im.width,'sourceHeight':im.height,'sourceSha256':sha(raw),'sourceGitBlobSha':blobsha}
    if xml:
        xmlraw=download(xml['path']);xmlblob=hashlib.sha1(f'blob {len(xmlraw)}\0'.encode()+xmlraw).hexdigest()
        if entry.get('metadataGitBlobSha') and entry['metadataGitBlobSha'] != xmlblob:raise ValueError(f'{xml["path"]}: source XML differs from pinned Git blob')
        xml['gitBlobSha']=xmlblob;result['sourceXml']=xml
    if path.startswith('Beam/'):result['beamPart']=Path(path).stem.lower();result['baseDirection']='down'
    return assetid,result


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,default=INPUT);parser.add_argument('--workers',type=int,default=6);parser.add_argument('--only',default='')
    args=parser.parse_args();spec=json.loads(args.input.read_text());entries=spec['assets'] if isinstance(spec,dict) else spec
    if args.only:
        wanted=set(args.only.split(','));entries=[e for e in entries if (e.get('id') or identity(e['sourcePath'])) in wanted]
    catalogue={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
        for assetid,result in ex.map(build,entries):catalogue[assetid]=result;print(f'{assetid}: {result["frameCount"]} frames x {result["directions"]} directions, {result["width"]}x{result["height"]} atlas',flush=True)
    if args.only and CATALOGUE.exists():catalogue=json.loads(CATALOGUE.read_text())|catalogue
    catalogue=dict(sorted(catalogue.items()));CATALOGUE.write_text(json.dumps(catalogue,separators=(',',':')))
    report={'source':'PMDCollab/RawAsset','commit':COMMIT,'assets':len(catalogue),
            'frameCells':sum(c['frameCount']*c['directions'] for c in catalogue.values()),
            'svgBytes':sum((ROOT/'public/assets'/c['path']).stat().st_size for c in catalogue.values()),
            'metadataBytes':CATALOGUE.stat().st_size,
            'largestAtlas':max(({'id':c['id'],'size':[c['width'],c['height']],'rgbaBytes':c['width']*c['height']*4} for c in catalogue.values()),key=lambda c:c['rgbaBytes'])}
    (OUT/'import-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)

if __name__=='__main__':main()
