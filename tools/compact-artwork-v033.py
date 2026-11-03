"""Apply source-checked palette candidates and high-quality opaque UI JPEGs."""
from pathlib import Path
import argparse,hashlib,io,json,shutil
from PIL import Image
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1]);p.add_argument('--candidates',type=Path,required=True);p.add_argument('--work',type=Path,required=True);a=p.parse_args();root=a.project;work=a.work;backup=work/'before-v033';backup.mkdir(parents=True,exist_ok=True)
data=json.loads(a.candidates.read_text('utf-8'));by={r['image']:r for r in data['rows']};chosen={}
for r in data['rows']:
 c=next((c for c in r['candidates'] if c['colors']==96),None)
 if c:chosen[r['image']]=c
saved=sum(c['savedBytes'] for c in chosen.values());options=[]
for r in data['rows']:
 c=next((c for c in r['candidates'] if c['colors']==80),None)
 if not c:continue
 ratio=max(c['metrics'][k]/max(r['beforeMetrics'][k],1e-9) for k in c['metrics']);gain=c['savedBytes']-(chosen[r['image']]['savedBytes'] if r['image'] in chosen else 0)
 if gain>0 and ratio<=.95:options.append((ratio,-gain,r['image'],c))
for ratio,neg,name,c in sorted(options):
 if saved>=250000:break
 saved-=neg;chosen[name]=c
assert saved>=250000 and all('noir_' not in n for n in chosen)
hashb=lambda b:hashlib.sha256(b).hexdigest();layout=json.loads((root/'reports/portrait-layout-v031.json').read_text('utf-8'));geo={r['image']:r for r in layout['rows']};images_path=root/'image-report.json';images=json.loads(images_path.read_text('utf-8'));rows=[]
assert not (root/'reports/compact-artwork-v033.json').exists(),'Already applied; restore the 0.3.2 resource baseline before repeating'
for name,c in sorted(chosen.items()):
 f=root/'src/common/images'/(name+'.png');raw=f.read_bytes();assert hashb(raw)==by[name]['beforeSha256'];encoded=Path(c['file']).read_bytes();assert hashb(encoded)==c['sha256'];im=Image.open(io.BytesIO(encoded)).convert('RGBA');assert list(im.size)==geo[name]['storedSize'];assert all(c['metrics'][k]<=by[name]['beforeMetrics'][k]+1e-7 for k in c['metrics'])
 shutil.copy2(f,backup/f.name);f.write_bytes(encoded);full=Image.new('RGBA',(432,286));full.paste(im,geo[name]['cropBox'][:2]);geo[name].update(bytes=len(encoded),sha256=c['sha256'],paletteColors=c['colors'],encodingRevision='0.3.3',reconstructedRgbaSha256=hashb(full.tobytes()))
 images['images'][name].update(bytes=len(encoded),paletteColors=c['colors'],encoding='indexed PNG / imagequant',encodingRevision='0.3.3')
 row={k:v for k,v in c.items() if k!='file'};row.update(image=name,file='images/'+f.name,beforeBytes=len(raw),beforeSha256=by[name]['beforeSha256'],beforeMetrics=by[name]['beforeMetrics']);rows.append(row)
layout.update(version='0.3.3',geometryRevision='0.3.1',totalBytes=sum(r['bytes'] for r in layout['rows']),rasterEncodingRevision='0.3.3',reconstructedFullViewportPixelsIdentical=False,currentRasterLosslessComparedToV032=False,allCoordinatesAndStoredSizesUnchanged=True,lossyPaletteChanges=len(rows),allSourceMetricsNoWorse=True)
(root/'reports/portrait-layout-v033.json').write_text(json.dumps(layout,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');images_path.write_text(json.dumps(images,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
ui=[];source=(root/'src/pages/index/index.ux').read_text('utf-8')
for name,q in [('title',98),('panel',95)]:
 f=root/'src/common/ui'/(name+'.png');im=Image.open(f).convert('RGBA');assert im.getchannel('A').getextrema()==(255,255);ref=im.convert('RGB');buf=io.BytesIO();ref.save(buf,format='JPEG',quality=q,subsampling=0,optimize=True,progressive=False);b=buf.getvalue();decoded=Image.open(io.BytesIO(b));assert decoded.size==ref.size and not decoded.info.get('progressive');error=float(np.mean((np.asarray(ref,dtype='float32')-np.asarray(decoded,dtype='float32'))**2));assert error<1.5 and len(b)<f.stat().st_size
 before=f.read_bytes();shutil.copy2(f,backup/('ui-'+f.name));new=f.with_suffix('.jpg');new.write_bytes(b);f.unlink();source=source.replace('/common/ui/'+name+'.png','/common/ui/'+name+'.jpg');ui.append({'file':'ui/'+new.name,'quality':q,'subsampling':'4:4:4','size':list(decoded.size),'beforeBytes':len(before),'bytes':len(b),'savedBytes':len(before)-len(b),'beforeSha256':hashb(before),'sha256':hashb(b),'mseAgainstV032Png':error})
(root/'src/pages/index/index.ux').write_text(source,encoding='utf-8')
report={'version':'0.3.3','baselineVersion':'0.3.2','lossless':False,'method':'Original unquantized watch-size RGBA -> no-dither imagequant 96/80 colors -> indexed PNG; unchanged portrait geometry. Opaque title/menu backgrounds -> non-progressive JPEG 98/95, 4:4:4.', 'portraitsChanged':len(rows),'portraitsUnchanged':368-len(rows),'noirPortraitsByteIdentical':data['protectedNoirPortraits'],'paletteCounts':{str(n):sum(r['colors']==n for r in rows) for n in [96,80]},'portraitSavedBytes':saved,'uiSavedBytes':sum(r['savedBytes'] for r in ui),'resourceSavedBytes':saved+sum(r['savedBytes'] for r in ui),'allConvertedPortraitDimensionsCoordinatesUnchanged':True,'allConvertedSourceMetricsNoWorse':True,'metrics':['composite0','composite48','composite255','opaqueRgb','alpha','upperCenterRgb'],'note':'Palette quantization and JPEG are lossy. The source-relative MSE checks are conservative objective checks, not a guarantee of identical perception or pixels. All unchanged CG/backgrounds and portrait files retain their original bytes.','portraits':rows,'ui':ui}
(root/'reports/compact-artwork-v033.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:v for k,v in report.items() if k not in ['portraits','ui']}))
