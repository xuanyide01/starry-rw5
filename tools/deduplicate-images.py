"""Share byte-identical images without removing logical story/CG identifiers."""
from pathlib import Path
import argparse,hashlib,json,re,shutil
p=argparse.ArgumentParser();p.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1]);p.add_argument('--work',type=Path,required=True);a=p.parse_args();root=a.project;common=root/'src/common';a.work.mkdir(parents=True,exist_ok=True)
f=common/'assets.js';paths=json.loads(re.search(r'const paths=(.*);\r?\n',f.read_text('utf-8'))[1]);groups={};rows=[]
for name in sorted(set(paths.values())):
 file=common/'images'/name;h=hashlib.sha256(file.read_bytes()).hexdigest()
 if h in groups:
  canonical=groups[h];keys=[k for k,v in paths.items() if v==name]
  for k in keys:paths[k]=canonical
  shutil.copy2(file,a.work/name);size=file.stat().st_size;file.unlink();rows.append({'file':name,'canonical':canonical,'keys':keys,'savedBytes':size,'sameSha256':h})
 else:groups[h]=name
legacy=common/'title_bg.png'
if legacy.exists():
 assert legacy.read_bytes()==(common/'images/title_bg.png').read_bytes()
 assert '/common/title_bg.png' not in (root/'src/pages/index/index.ux').read_text('utf-8'),'Update title fallback URI before removing old copy'
 size=legacy.stat().st_size;shutil.copy2(legacy,a.work/'title_bg-root.png');legacy.unlink();rows.append({'file':'common/title_bg.png','canonical':'common/images/title_bg.png','savedBytes':size})
f.write_text('const paths='+json.dumps(paths,ensure_ascii=False,separators=(',',':'))+';\nexport function imagePath(id){return "/common/images/"+(paths[id]||paths.bg_black);}\n',encoding='utf-8')
report={'version':'0.3.1','allAliasedImageBytesIdentical':True,'logicalImageIds':len(paths),'savedBytes':sum(r['savedBytes'] for r in rows),'rows':rows}
if rows:(root/'reports/resource-dedup-v031.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='rows'}))
