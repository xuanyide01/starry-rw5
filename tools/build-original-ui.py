"""Extract/adapt the original Chinese title controls and star/cloud UI for 432x514."""
from pathlib import Path
import argparse,hashlib,json
from PIL import Image,ImageOps,ImageDraw

p=argparse.ArgumentParser()
p.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1])
p.add_argument('--game-data',type=Path,help='Original Unity *_Data directory, read only')
p.add_argument('--ui-reference',type=Path,help='Already decoded original UI PNG directory')
a=p.parse_args();project=a.project
if not a.ui_reference and not a.game_data:p.error('Set --game-data or --ui-reference')
original=a.ui_reference or project/'.ui-reference'
if not a.ui_reference:
    import UnityPy
    original.mkdir(parents=True,exist_ok=True)
    names={'title_bg','config_BG','window_message','saveload_frame','title_01start_on','title_02load_on','title_03config_on','title_04gallery_on','window_name','window_click','window_config_ov'}
    env=UnityPy.load(str(a.game_data/'sharedassets0.assets'))
    for obj in env.objects:
        if obj.type.name!='Texture2D':continue
        d=obj.read()
        if d.m_Name not in names:continue
        if d.m_StreamData and d.m_StreamData.size:
            with (a.game_data/'sharedassets0.assets.resS').open('rb') as stream:
                stream.seek(d.m_StreamData.offset);d.image_data=stream.read(d.m_StreamData.size)
        d.image.convert('RGBA').save(original/(d.m_Name+'.png'))
    if any(not(original/(name+'.png')).exists() for name in names):raise RuntimeError('Missing original UI asset; check game version')
out=project/'src/common/ui';out.mkdir(exist_ok=True,parents=True)
rows=[]
def load(name):return Image.open(original/(name+'.png')).convert('RGBA')
def save(name,im,source,detail):
    p=out/(name+'.png');im.save(p,optimize=True)
    rows.append({'file':'common/ui/'+p.name,'source':source,'detail':detail,'size':im.size,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
def nine(im,size,border):
    w,h=im.size;W,H=size;b=border;dest=Image.new('RGBA',size)
    sx=[0,b,w-b,w];sy=[0,b,h-b,h];dx=[0,b,W-b,W];dy=[0,b,H-b,H]
    for y in range(3):
        for x in range(3):
            part=im.crop((sx[x],sy[y],sx[x+1],sy[y+1])).resize((dx[x+1]-dx[x],dy[y+1]-dy[y]),Image.Resampling.LANCZOS)
            dest.paste(part,(dx[x],dy[y]))
    return dest
title=load('title_bg');sky=title.crop((0,0,240,720)).resize((432,514),Image.Resampling.LANCZOS)
sky=Image.alpha_composite(sky,Image.new('RGBA',sky.size,(8,18,42,170)))
hero=title.crop((160,0,1120,720)).resize((432,324),Image.Resampling.LANCZOS)
mask=Image.new('L',hero.size,255);d=ImageDraw.Draw(mask)
for y in range(248,324):d.line((0,y,431,y),fill=round(255*(323-y)/75))
hero.putalpha(mask);canvas=sky.copy();canvas.alpha_composite(hero,(0,0))
save('title',canvas,'title_bg','Preserve character, moon/train and baked logo in [160,0,1120,720]; adapt night sky below to portrait, dim only the button area.')
panel=load('config_BG').crop((55,165,1225,615)).resize((432,514),Image.Resampling.LANCZOS)
save('panel',panel,'config_BG','Original cloud colors and texture; remove desktop-only CONFIG heading, adapt backdrop to portrait; keep all crop rows above the desktop footer stripe.')
save('dialogue',nine(load('window_message'),(432,228),10),'window_message','Nine-slice original lavender stripe/star panel; native watch-sized text remains separate.')
save('slot',nine(load('saveload_frame'),(396,84),10),'saveload_frame','Nine-slice original save-card frame, native labels overlaid.')
for name,size in [('title_01start_on',(182,39)),('title_02load_on',(182,39)),('title_03config_on',(182,39)),('title_04gallery_on',(182,39)),('window_name',(190,30)),('window_click',(20,20)),('window_config_ov',(22,26))]:
    save(name,load(name).resize(size,Image.Resampling.LANCZOS),name,'Original Chinese button artwork/icon; proportional resampling only.')
(project/'reports').mkdir(exist_ok=True)
(project/'reports/original-ui-v031.json').write_text(json.dumps({'source':'User-provided original Unity sharedassets0.assets','sourceUnmodified':True,'date':'2026-11-03','assets':rows},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'assets':len(rows),'bytes':sum(r['bytes'] for r in rows)}))
