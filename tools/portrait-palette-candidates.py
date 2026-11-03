from pathlib import Path
import argparse,concurrent.futures,hashlib,io,json,time
import numpy as np
from PIL import Image
import imagequant,zopfli.png
p=argparse.ArgumentParser();p.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1]);p.add_argument('--rgba-reference',type=Path,required=True);p.add_argument('--work',type=Path,required=True);a=p.parse_args();root=a.project;work=a.work;work.mkdir(parents=True,exist_ok=True);original=a.rgba_reference;out=work/'portrait-candidates';out.mkdir(exist_ok=True);layout=json.loads((root/'reports/portrait-layout-v031.json').read_text('utf-8'))
def metrics(ref,im):
 a=np.asarray(ref,dtype='float32');b=np.asarray(im.convert('RGBA'),dtype='float32');result={}
 for bg in [0,48,255]:
  x=a[:,:,:3]*a[:,:,3:]/255+bg*(1-a[:,:,3:]/255);y=b[:,:,:3]*b[:,:,3:]/255+bg*(1-b[:,:,3:]/255);result['composite'+str(bg)]=float(np.mean((x-y)**2))
 mask=a[:,:,3]>250;result['opaqueRgb']=float(np.mean((a[:,:,:3][mask]-b[:,:,:3][mask])**2));result['alpha']=float(np.mean((a[:,:,3]-b[:,:,3])**2))
 h,w=a.shape[:2];face=(slice(0,max(1,round(h*.55))),slice(round(w*.15),round(w*.85)));m=mask[face];result['upperCenterRgb']=float(np.mean((a[:,:,:3][face][m]-b[:,:,:3][face][m])**2)) if m.any() else result['opaqueRgb'];return result
def candidate(row):
 name=row['image'];f=root/'src/common/images'/(name+'.png');raw=f.read_bytes();assert hashlib.sha256(raw).hexdigest()==row['sha256'],'Restore 0.3.2 source portraits before repeating candidate generation';im=Image.open(f).convert('RGBA');ref=Image.open(original/f.name).convert('RGBA').crop(row['cropBox']);assert ref.size==im.size;before=metrics(ref,im);candidates=[]
 if 'noir_' in name:return {'image':name,'protected':True,'beforeBytes':len(raw),'beforeSha256':hashlib.sha256(raw).hexdigest(),'candidates':[]}
 for colors in [96,80]:
  dest=out/(str(colors)+'-'+f.name)
  if dest.exists():b=dest.read_bytes()
  else:
   data,palette=imagequant.quantize_raw_rgba_bytes(ref.tobytes(),ref.width,ref.height,dithering_level=0,max_colors=colors);q=Image.frombytes('P',ref.size,data);q.putpalette(palette,rawmode='RGBA');buf=io.BytesIO();q.save(buf,format='PNG',optimize=True,bits=8);b=buf.getvalue()
   # Avoid expensive DEFLATE searches when the candidate is clearly larger.
   if len(b)>len(raw)*1.14:continue
   b=zopfli.png.optimize(b,lossy_transparent=False,lossy_8bit=False,num_iterations=1,num_iterations_large=1,filter_strategies='0mepb');dest.write_bytes(b)
  if len(b)>=len(raw):continue
  decoded=Image.open(io.BytesIO(b));m=metrics(ref,decoded)
  if all(m[k]<=before[k]+1e-7 for k in m):
   assert decoded.size==im.size and b[24:26]==bytes([8,3])
   candidates.append({'colors':colors,'bytes':len(b),'savedBytes':len(raw)-len(b),'metrics':m,'allSourceMetricsNoWorse':True,'sha256':hashlib.sha256(b).hexdigest(),'file':str(dest)})
 return {'image':name,'beforeBytes':len(raw),'beforeSha256':hashlib.sha256(raw).hexdigest(),'beforeMetrics':before,'candidates':candidates}
rows=[];start=time.time()
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 for row in pool.map(candidate,layout['rows']):
  rows.append(row)
  if len(rows)%40==0 or len(rows)==len(layout['rows']):print(json.dumps({'done':len(rows),'total':len(layout['rows']),'eligible':sum(bool(r['candidates']) for r in rows),'maximumSaving':sum(max([c['savedBytes'] for c in r['candidates']] or [0]) for r in rows),'seconds':round(time.time()-start)}),flush=True)
report={'baselineVersion':'0.3.2','protectedNoirPortraits':sum(r.get('protected',False) for r in rows),'rows':rows};(work/'portrait-candidates.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps({'done':True,'maxSaving':sum(max([c['savedBytes'] for c in r['candidates']] or [0]) for r in rows)}),flush=True)
