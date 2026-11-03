"""Zopfli standard DEFLATE for text resources; contents and image bytes remain exact."""
from pathlib import Path
import argparse,base64,concurrent.futures,json,subprocess,zipfile,zlib
import zopfli.zlib
p=argparse.ArgumentParser();p.add_argument('package',type=Path);p.add_argument('--work',type=Path,required=True);a=p.parse_args();a.work.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(a.package) as z:items=[(i.filename,z.read(i),i.compress_size) for i in z.infolist() if i.filename.endswith(('.txt','.js','.json'))]
def encode(item):
 name,data,before=item;b=zopfli.zlib.compress(data,numiterations=15)[2:-4];assert zlib.decompress(b,-15)==data
 if len(b)>=before:return None
 return {'file':name,'expanded':len(data),'before':before,'compressed':len(b),'crc32':zlib.crc32(data)&0xffffffff,'deflateBase64':base64.b64encode(b).decode('ascii')}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:rows=[r for r in pool.map(encode,items) if r]
cache=a.work/'deflate-parts.json';cache.write_text(json.dumps({'rows':rows}),encoding='utf-8')
r=subprocess.run(['node',str(Path(__file__).with_name('compact-rpk.cjs')),str(a.package.resolve()),str(cache.resolve())],capture_output=True,text=True,check=True);report=json.loads(r.stdout)
root=Path(__file__).resolve().parents[1];version=json.loads((root/'src/manifest.json').read_text('utf-8'))['versionName']
report.update(version=version,method='Standard ZIP DEFLATE, Zopfli 15 iterations for text; compatible development certificate re-signing',resources=len(rows))
(root/('reports/package-compression-v'+version.replace('.','')+'.json')).write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))
