"""Trim transparent canvas borders; reconstruct identical full-viewport RGBA pixels."""
from pathlib import Path
import argparse,concurrent.futures,hashlib,io,json,shutil
from PIL import Image
import zopfli.png
p=argparse.ArgumentParser();p.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1]);p.add_argument('--work',type=Path,required=True);p.add_argument('--jobs',type=int,default=6);p.add_argument('--apply',action='store_true');a=p.parse_args()
root=a.project;cache=a.work/'cropped-portraits';cache.mkdir(parents=True,exist_ok=True);backup=a.work/'crop-before';backup.mkdir(exist_ok=True)
report_path=root/'reports/portrait-layout-v031.json';report=json.loads(report_path.read_text('utf-8'));hashb=lambda b:hashlib.sha256(b).hexdigest()
assert not report.get('transparentBordersTrimmed'),'Already cropped; restore full-canvas portraits before repeating'
def crop(r):
 f=root/'src/common/images'/(r['image']+'.png');raw=f.read_bytes();im=Image.open(f);assert im.size==(432,286);box=im.convert('RGBA').getbbox();dest=cache/f.name
 if dest.exists():b=dest.read_bytes()
 else:
  buf=io.BytesIO();im.crop(box).save(buf,format='PNG',optimize=True,compress_level=9)
  b=zopfli.png.optimize(buf.getvalue(),lossy_transparent=False,lossy_8bit=False,num_iterations=3,num_iterations_large=3,filter_strategies='0mepb');dest.write_bytes(b)
 decoded=Image.open(io.BytesIO(b)).convert('RGBA');assert decoded.size==(box[2]-box[0],box[3]-box[1]);reconstructed=Image.new('RGBA',im.size);reconstructed.paste(decoded,box[:2]);assert reconstructed.tobytes()==im.convert('RGBA').tobytes()
 return {'image':r['image'],'box':list(box),'before':len(raw),'after':len(b),'beforeSha256':hashb(raw),'sha256':hashb(b),'reconstructedRgbaSha256':hashb(reconstructed.tobytes())}
with concurrent.futures.ThreadPoolExecutor(max_workers=a.jobs) as pool:rows=list(pool.map(crop,report['rows']))
result={'version':'0.3.1','applied':a.apply,'portraits':len(rows),'beforeBytes':sum(r['before'] for r in rows),'afterBytes':sum(r['after'] for r in rows),'savedBytes':sum(r['before']-r['after'] for r in rows),'allReconstructedPixelsIdentical':True,'originalViewport':[432,286],'rows':rows}
if a.apply:
 rects={};by_name={r['image']:r for r in report['rows']};image_report_path=root/'image-report.json';images=json.loads(image_report_path.read_text('utf-8'))
 for r in rows:
  f=root/'src/common/images'/(r['image']+'.png');shutil.copy2(f,backup/f.name);shutil.copy2(cache/f.name,f);x,y,right,bottom=r['box'];rects[r['image']]=[x,y,right-x,bottom-y]
  by_name[r['image']].update(bytes=r['after'],sha256=r['sha256'],cropBox=r['box'],storedSize=[right-x,bottom-y],reconstructedRgbaSha256=r['reconstructedRgbaSha256'])
  images['images'][r['image']].update(bytes=r['after'],storedSize=[right-x,bottom-y],cropBox=r['box'])
 (root/'src/common/portrait-layout.js').write_text('const portraitRects='+json.dumps(rects,separators=(',',':'))+';\nexport function portraitRect(id){return portraitRects[id]||[0,0,432,286];}\n',encoding='utf-8')
 report.update(totalBytes=result['afterBytes'],transparentBordersTrimmed=True,reconstructedFullViewportPixelsIdentical=True)
 report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');image_report_path.write_text(json.dumps(images,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(root/'reports/portrait-crop-v031.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k!='rows'}))
