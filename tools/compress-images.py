from pathlib import Path
from PIL import Image
import json,hashlib
ROOT=Path(__file__).resolve().parents[1];common=ROOT/'src/common';dest=common/'images';backup=ROOT/'image-original';backup.mkdir(exist_ok=True)
assert len(list(dest.glob('*.png')))==548, '请先完整导出548张原始PNG；不要重复压缩成品图片'
paths={};originalBytes=0
for p in list(dest.glob('*.png')):
    if not (backup/p.name).exists():(backup/p.name).write_bytes(p.read_bytes())
for p in backup.glob('*.png'):
    originalBytes+=p.stat().st_size;img=Image.open(p).convert('RGBA');alpha=img.getchannel('A');opaque=alpha.getextrema()==(255,255)
    if opaque:
        img.thumbnail((384,288),Image.Resampling.LANCZOS);filename=p.stem+'.jpg';img.convert('RGB').save(dest/filename,quality=48,optimize=True,progressive=False,subsampling=2)
    else:
        box=alpha.getbbox()
        if box:img=img.crop(box)
        img.thumbnail((180,260),Image.Resampling.LANCZOS);filename=p.name;img.quantize(colors=64,method=Image.Quantize.FASTOCTREE).save(dest/filename,optimize=True)
    paths[p.stem]=filename
for p in dest.iterdir():
    if p.name not in paths.values():p.unlink()
(common/'assets.js').write_text('const paths='+json.dumps(paths,separators=(',',':'))+';\nexport function imagePath(id){return "/common/images/"+(paths[id]||paths.bg_black);}\n',encoding='utf8')
ux=ROOT/'src/pages/index/index.ux';s=ux.read_text(encoding='utf8')
if "import {imagePath}" not in s:s=s.replace("import {groupGallery,stepVariant}","import {imagePath} from '../../common/assets.js';\nimport {groupGallery,stepVariant}")
s=s.replace("'/common/images/title_bg.png'","'/common/images/title_bg.jpg'")
s=s.replace("this.backgroundSrc='/common/images/'+this.session.background+'.png';","this.backgroundSrc=imagePath(this.session.background);")
s=s.replace("this.bodySrc=this.session.body?'/common/images/'+this.session.body+'.png':'';","this.bodySrc=this.session.body?imagePath(this.session.body):'';")
s=s.replace("src:'/common/images/'+item.image+'.png'","src:imagePath(item.image)").replace("this.cgSrc='/common/images/'+item.image+'.png';","this.cgSrc=imagePath(item.image);")
ux.write_text(s,encoding='utf8')
manifest=ROOT/'src/manifest.json';m=json.loads(manifest.read_text(encoding='utf8'));m.update(versionName='0.2.2',versionCode=5);manifest.write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf8')
package=ROOT/'package.json';m=json.loads(package.read_text());m['version']='0.2.2';package.write_text(json.dumps(m,indent=2),encoding='utf8')
report={'originalAssetBytes':originalBytes,'compressedAssetBytes':sum(p.stat().st_size for p in dest.iterdir()),'images':len(paths),'maximumBackgroundDecodedBytes':384*288*4,'transparentPortraitSize':[180,260],'originalAssetsBackedUp':str(backup)}
(ROOT/'compression-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8');print(report)
