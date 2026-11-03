"""CLANNAD-style PNG filter/DEFLATE search; never change decoded pixels or dimensions."""
from pathlib import Path
import argparse,concurrent.futures,hashlib,io,json,struct,time
from PIL import Image
import zopfli.png

p=argparse.ArgumentParser();p.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1]);p.add_argument('--work',type=Path,required=True);p.add_argument('--jobs',type=int,default=6);a=p.parse_args()
root=a.project;backup=a.work/'before';cache=a.work/'cache';backup.mkdir(parents=True,exist_ok=True);cache.mkdir(exist_ok=True)
hashb=lambda b:hashlib.sha256(b).hexdigest()
def profiles(b):
    found={};at=8
    while at<len(b):
        n=struct.unpack_from('>I',b,at)[0];kind=b[at+4:at+8]
        if kind in [b'iCCP',b'gAMA',b'cHRM',b'sRGB',b'sBIT']:found[kind]=b[at+8:at+8+n]
        at+=n+12
    return found
def optimize(path):
    old=path.read_bytes();rel=path.relative_to(root/'src/common');original=backup/rel;original.parent.mkdir(parents=True,exist_ok=True)
    if not original.exists():original.write_bytes(old)
    else:assert original.read_bytes()==old,'Baseline changed; use a new work directory'
    cached=cache/(hashb(old)+'.png')
    if cached.exists():new=cached.read_bytes()
    else:
        new=zopfli.png.optimize(old,lossy_transparent=False,lossy_8bit=False,num_iterations=1,num_iterations_large=1,filter_strategies='0mepb')
        if len(new)>=len(old) or new[24:26]!=old[24:26] or profiles(new)!=profiles(old):new=old
        cached.write_bytes(new)
    before=Image.open(io.BytesIO(old)).convert('RGBA');after=Image.open(io.BytesIO(new)).convert('RGBA')
    assert before.size==after.size and before.tobytes()==after.tobytes() and old[24:26]==new[24:26] and profiles(old)==profiles(new),str(rel)
    if new!=old:path.write_bytes(new)
    return {'file':rel.as_posix(),'before':len(old),'after':len(new),'beforeSha256':hashb(old),'sha256':hashb(new),'decodedRgbaSha256':hashb(after.tobytes()),'dimensions':list(after.size),'pixelsDimensionsAlphaAndColorMetadataIdentical':True}
rows=[];paths=list((root/'src/common').rglob('*.png'));start=time.time()
with concurrent.futures.ThreadPoolExecutor(max_workers=a.jobs) as pool:
    tasks=[pool.submit(optimize,p) for p in paths]
    for f in concurrent.futures.as_completed(tasks):
        rows.append(f.result())
        if len(rows)%20==0 or len(rows)==len(paths):print(json.dumps({'done':len(rows),'total':len(paths),'savedBytes':sum(r['before']-r['after'] for r in rows),'seconds':round(time.time()-start)}),flush=True)
report={'passed':True,'version':'0.3.1','method':'zopfli PNG lossless scanline/filter/DEFLATE search, 1 iteration, 0mepb strategies','references':['CLANNAD tools/lossless-png.py','STEINS;GATE 0 lossless PNG approach'],
        'files':len(rows),'beforeBytes':sum(r['before'] for r in rows),'afterBytes':sum(r['after'] for r in rows),'savedBytes':sum(r['before']-r['after'] for r in rows),'allPixelsDimensionsAlphaAndColorMetadataIdentical':True,'rows':sorted(rows,key=lambda r:r['file'])}
(root/'reports/lossless-png-v031.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
# Keep generated-asset provenance in sync with the final lossless encodings.
portrait_path=root/'reports/portrait-layout-v031.json';portrait=json.loads(portrait_path.read_text('utf-8'))
for r in portrait['rows']:
    f=root/'src/common/images'/(r['image']+'.png');r['beforeLosslessBytes']=r['bytes'];r['bytes']=f.stat().st_size;r['sha256']=hashb(f.read_bytes())
portrait['totalBytes']=sum(r['bytes'] for r in portrait['rows']);portrait['losslessEncodingOptimized']=True
portrait_path.write_text(json.dumps(portrait,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
ui_path=root/'reports/original-ui-v031.json';ui=json.loads(ui_path.read_text('utf-8'))
for r in ui['assets']:
    f=root/'src'/r['file'];r['beforeLosslessSha256']=r['sha256'];r['sha256']=hashb(f.read_bytes());r['bytes']=f.stat().st_size
ui['losslessEncodingOptimized']=True;ui_path.write_text(json.dumps(ui,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='rows'}),flush=True)
