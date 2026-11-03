"""Rasterize original character-table geometry into the watch scene viewport."""
from pathlib import Path
import argparse,hashlib,json
import UnityPy
from PIL import Image

p=argparse.ArgumentParser()
p.add_argument('--game-data',type=Path,required=True)
p.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1])
p.add_argument('--settings',type=Path,help='Optional previously extracted original-settings.json')
p.add_argument('--rgba-reference',type=Path,help='Write unquantized watch-size RGBA references for compression comparisons')
p.add_argument('--reference-only',action='store_true',help='Only export references, without changing runtime resources or reports')
a=p.parse_args();root=a.project
if a.reference_only and not a.rgba_reference:p.error('--reference-only requires --rgba-reference')
if a.rgba_reference:a.rgba_reference.mkdir(parents=True,exist_ok=True)
if a.settings:settings=json.loads(a.settings.read_text('utf-8'))
else:
    bundle=a.game_data/'StreamingAssets/hoshishiro/Windows-patch/星空鉄道とシロの旅.scenarios.asset'
    settings=None
    for obj in UnityPy.load(str(bundle)).objects:
        if obj.type.name=='MonoBehaviour':
            t=obj.read_typetree()
            if 'settingList' in t:settings=t;break
    if settings is None:raise RuntimeError('Original character table not found')
table=settings['settingList'][2];header=table['rows'][0]['strings'];actor='';mapping={}
for row in table['rows'][1:]:
    if row['isEmpty'] or row['isCommentOut']:continue
    r=dict(zip(header,row['strings']));actor=r.get('CharacterName') or actor
    if not r.get('FileName'):continue
    assert not r.get('Pivot') or r['Pivot']=='Center','Unexpected original pivot'
    mapping[Path(r['FileName']).stem]={'actor':actor,'x':float(r.get('X') or 0),'y':float(r.get('Y') or 0),'scale':float(r.get('Scale') or 1),'pivot':[.5,.5]}
report_path=root/'image-report.json';images=json.loads(report_path.read_text('utf-8'));needed=set(images['images'])&set(mapping);rows=[]
scene_w,scene_h=1280,720;watch_w,watch_h=432,286;common_scale=watch_w/scene_w;offset_y=(watch_h-scene_h*common_scale)/2
env=UnityPy.load(str(a.game_data/'resources.assets'))
with (a.game_data/'resources.assets.resS').open('rb') as stream:
    for obj in env.objects:
        if obj.type.name!='Texture2D':continue
        d=obj.read()
        if d.m_Name not in needed:continue
        if d.m_StreamData and d.m_StreamData.size:
            stream.seek(d.m_StreamData.offset);d.image_data=stream.read(d.m_StreamData.size)
        im=d.image.convert('RGBA');r=mapping[d.m_Name];source_size=im.size;s=common_scale*r['scale']
        left=(scene_w/2+r['x']-im.width*r['scale']/2)*common_scale
        top=(scene_h/2-r['y']-im.height*r['scale']/2)*common_scale+offset_y
        scaled=im.resize((round(im.width*s),round(im.height*s)),Image.Resampling.LANCZOS)
        canvas=Image.new('RGBA',(watch_w,watch_h));canvas.alpha_composite(scaled,(round(left),round(top)))
        if a.rgba_reference:canvas.save(a.rgba_reference/(d.m_Name+'.png'),optimize=True)
        if a.reference_only:
            rows.append({'image':d.m_Name});continue
        # A bounded watch canvas avoids allocating full original-size sprites on device.
        final=canvas.quantize(colors=256,method=Image.Quantize.FASTOCTREE)
        dest=root/'src/common/images'/(d.m_Name+'.png');final.save(dest,optimize=True)
        row={'image':d.m_Name,'sourceSize':source_size,'original':r,'uniformScale':common_scale,'sourceDrawScale':s,'drawLeft':round(left),'drawTop':round(top),'canvas':[watch_w,watch_h],'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
        rows.append(row);images['images'][d.m_Name].update(watchSize=[watch_w,watch_h],bytes=dest.stat().st_size,layoutRevision='0.3.1',originalGeometry=r)
assert {r['image'] for r in rows}==needed, 'A used portrait was not regenerated'
if a.reference_only:
    print(json.dumps({'referencePortraits':len(rows),'runtimeResourcesChanged':False}));raise SystemExit(0)
report_path.write_text(json.dumps(images,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
out={'version':'0.3.1','sourceUnmodified':True,'source':'Original Character settings / Texture2D','originalCanvas':[scene_w,scene_h],'watchViewport':[watch_w,watch_h],'commonScale':common_scale,'letterboxOffsetY':offset_y,'defaultPivot':[.5,.5],
     'method':'Uniform original pixel scale, per-pattern X/Y and Scale, transparent viewport clipping. Normal and closeup variants retain different source geometry; characters are not individually fitted to height.',
     'scope':'Original default character geometry; existing single-character static reader presentation retained. Scripted multi-character staging and full Tween animations remain outside this reader.',
     'officialReferences':['https://madnesslabo.net/utage/?page_id=1678','https://madnesslabo.net/utage/?page_id=1762'],
     'portraits':len(rows),'totalBytes':sum(r['bytes'] for r in rows),'rows':rows}
(root/'reports/portrait-layout-v031.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:out[k] for k in ['version','portraits','totalBytes','commonScale','letterboxOffsetY']}))
