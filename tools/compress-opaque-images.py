"""Encode opaque scenery from original textures; protect transparent portraits/UI."""
from pathlib import Path
import argparse,hashlib,io,json,re
import numpy as np
from PIL import Image
import UnityPy

p=argparse.ArgumentParser();p.add_argument('--game-data',type=Path,required=True);p.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1]);p.add_argument('--work',type=Path,required=True);a=p.parse_args()
root=a.project;folder=root/'src/common/images';a.work.mkdir(parents=True,exist_ok=True)
portrait_report=json.loads((root/'reports/portrait-layout-v031.json').read_text('utf-8'));protected={r['image'] for r in portrait_report['rows']}
mapping_path=root/'src/common/assets.js';source=mapping_path.read_text('utf-8');paths=json.loads(re.search(r'const paths=(.*);\r?\n',source)[1])
candidates={}
for file in folder.glob('*.png'):
    if file.stem in protected or file.stat().st_size<2000:continue
    im=Image.open(file).convert('RGBA')
    if im.getchannel('A').getextrema()==(255,255):candidates[file.stem]={'file':file,'image':im.convert('RGB'),'raw':file.read_bytes()}
# Resume an interrupted pass from exact workspace backups, never from a JPEG.
for backup in a.work.glob('*.png'):
    file=folder/backup.name
    if file.stem in protected or file.stem in candidates:continue
    raw=backup.read_bytes();im=Image.open(io.BytesIO(raw)).convert('RGBA')
    candidates[file.stem]={'file':file,'image':im.convert('RGB'),'raw':raw}
def mse(x,y):return float(np.mean((np.asarray(x,dtype=np.float32)-np.asarray(y,dtype=np.float32))**2))
rows=[];found=set();env=UnityPy.load(str(a.game_data/'resources.assets'))
with (a.game_data/'resources.assets.resS').open('rb') as stream:
    for obj in env.objects:
        if obj.type.name!='Texture2D':continue
        d=obj.read()
        if d.m_Name not in candidates:continue
        found.add(d.m_Name);c=candidates[d.m_Name]
        if d.m_StreamData and d.m_StreamData.size:stream.seek(d.m_StreamData.offset);d.image_data=stream.read(d.m_StreamData.size)
        original=d.image.convert('RGB');reference=original.resize(c['image'].size,Image.Resampling.LANCZOS);old_error=mse(reference,c['image']);selected=None
        for quality in [61,65,68,70,72,75,78,80,82,85,88,90,93,95,98]:
            output=io.BytesIO();reference.save(output,format='JPEG',quality=quality,optimize=True,progressive=False,subsampling=2);raw=output.getvalue()
            decoded=Image.open(io.BytesIO(raw)).convert('RGB');error=mse(reference,decoded)
            if error<=old_error+1e-7:
                if len(raw)<len(c['raw']):selected=(quality,raw,error)
                break
        if selected:
            quality,raw,error=selected;file=c['file'];backup=a.work/file.name
            if not backup.exists():backup.write_bytes(c['raw'])
            new=file.with_suffix('.jpg');new.write_bytes(raw);assert new.resolve().is_relative_to(folder.resolve()) and file.resolve().is_relative_to(folder.resolve())
            file.unlink(missing_ok=True);paths[d.m_Name]=new.name
            rows.append({'image':d.m_Name,'beforeFile':file.name,'file':new.name,'quality':quality,'sourceSize':list(original.size),'watchSize':list(reference.size),'beforeBytes':len(c['raw']),'bytes':len(raw),'beforeSourceMse':old_error,'newSourceMse':error,'sourceMseNoWorse':True,'sha256':hashlib.sha256(raw).hexdigest()})
        if len(found)%30==0:print(json.dumps({'processed':len(found),'candidates':len(candidates),'converted':len(rows),'savedBytes':sum(r['beforeBytes']-r['bytes'] for r in rows)}),flush=True)
missing=sorted(set(candidates)-found)
# Textures in a different original bundle remain PNG; no guessed substitute.
for name in missing:
    file=candidates[name]['file']
    if not file.exists():file.write_bytes(candidates[name]['raw'])
assert all((folder/name).exists() for name in paths.values()),'An image mapping has no payload'
mapping_path.write_text('const paths='+json.dumps(paths,ensure_ascii=False,separators=(',',':'))+';\nexport function imagePath(id){return "/common/images/"+(paths[id]||paths.bg_black);}\n',encoding='utf-8')
assert all((folder/(name+'.png')).exists() for name in protected)
report={'version':'0.3.1','passed':True,'method':'Original Texture2D -> same watch dimensions -> non-progressive JPEG, adaptive quality 61..98, 4:2:0; keep PNG unless smaller and source-relative RGB MSE no worse than existing palette PNG.',
        'references':['CLANNAD opaque JPEG / transparent PNG strategy','STEINS;GATE and STEINS;GATE 0 opaque JPEG strategy'],'candidateImages':len(candidates),'convertedImages':len(rows),'protectedPortraits':len(protected),'allWatchDimensionsUnchanged':True,'allConvertedSourceRelativeMseNoWorse':True,
        'lossless':False,'retainedPngInOtherOriginalBundle':missing,'note':'JPEG is lossy. Source-relative MSE is an objective comparison with the existing palette PNG; it is not a claim of identical pixels or universally identical perception.',
        'savedBytes':sum(r['beforeBytes']-r['bytes'] for r in rows),'rows':rows}
(root/'reports/opaque-compression-v031.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='rows'}),flush=True)
