import sys,json,argparse,hashlib
from pathlib import Path
import UnityPy
from PIL import Image,ImageOps
from gallery_index import build_catalog

p=argparse.ArgumentParser();p.add_argument('--game-data',type=Path,required=True);p.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1]);a=p.parse_args()
report=json.loads((a.project/'conversion-report.json').read_text(encoding='utf-8'));needed=set(report['assets'])|{'title_bg'}
env=UnityPy.load(str(a.game_data/'resources.assets'))
textures=[(obj,obj.read()) for obj in env.objects if obj.type.name=='Texture2D']
settings=a.project/'.extracted/scenarios.asset_1416801050685970231.json'
if settings.exists():
 gallery=build_catalog(json.loads(settings.read_text(encoding='utf-8'))['settingList'],{d.m_Name for obj,d in textures})
else:
 gallery=json.loads((a.project/'src/common/gallery.txt').read_text(encoding='utf-8'))
(a.project/'src/common/gallery.txt').write_text(json.dumps(gallery,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
report['galleryCount']=len(gallery);report['galleryImages']=[x['image'] for x in gallery]
(a.project/'conversion-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
needed.update(report['galleryImages'])
out=a.project/'src/common/images';out.mkdir(parents=True,exist_ok=True)
old_report=a.project/'image-report.json'
done=json.loads(old_report.read_text(encoding='utf-8')).get('images',{}) if old_report.exists() else {};errors=[]
with (a.game_data/'resources.assets.resS').open('rb') as stream:
 for obj,d in textures:
  if d.m_Name not in needed:continue
  if d.m_Name in done and (out/(d.m_Name+'.png')).exists():continue
  try:
   if d.m_StreamData and d.m_StreamData.size:
    stream.seek(d.m_StreamData.offset);d.image_data=stream.read(d.m_StreamData.size)
    assert len(d.image_data)==d.m_StreamData.size
   im=d.image.convert('RGBA');source=im.size
   # Fit the full original picture. Preserve the original aspect ratio.
   im.thumbnail((432,286),Image.Resampling.LANCZOS)
   dest=out/(d.m_Name+'.png');im.quantize(colors=192,method=Image.Quantize.FASTOCTREE).save(dest,optimize=True)
   done[d.m_Name]={'sourceSize':source,'watchSize':im.size,'bytes':dest.stat().st_size,'pathId':obj.path_id}
   if len(done)%40==0:print('exported',len(done),flush=True)
  except Exception as e:errors.append({'name':d.m_Name,'error':str(e)})
# The original title image is stored in the Unity scene's shared assets.
if 'title_bg' not in done:
 scene=UnityPy.load(str(a.game_data/'sharedassets0.assets'))
 for obj in scene.objects:
  if obj.type.name!='Texture2D':continue
  d=obj.read()
  if d.m_Name!='title_bg':continue
  im=d.image.convert('RGBA');source=im.size;im.thumbnail((432,286),Image.Resampling.LANCZOS)
  dest=out/'title_bg.png';im.quantize(colors=192,method=Image.Quantize.FASTOCTREE).save(dest,optimize=True)
  done['title_bg']={'sourceSize':source,'watchSize':im.size,'bytes':dest.stat().st_size,'pathId':obj.path_id,'source':'sharedassets0.assets'}
# Generate tiny solid backgrounds only when absent from the original index.
for name,color in [('bg_black','#000000'),('bg_white','#ffffff'),('bg_red','#b60000')]:
 if name in needed and name not in done:
  Image.new('RGB',(4,4),color).save(out/(name+'.png'));done[name]={'generatedSolidColor':color}
missing=sorted(needed-set(done))
(a.project/'image-report.json').write_text(json.dumps({'images':done,'missing':missing,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print('EXPORTED',len(done),'SIZE',sum(x.stat().st_size for x in out.glob('*.png')),'MISSING',missing,'ERRORS',errors)
if missing or errors:sys.exit(1)
