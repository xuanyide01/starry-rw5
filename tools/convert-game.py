"""Convert extracted Utage tables into a small, deterministic watch script."""
import argparse, json, re, collections
from pathlib import Path
from gallery_index import build_catalog

def clean(s):
    s=s.replace('\\n','\n').replace('\\u3000','　')
    s=re.sub(r'<dash=(\d+)>',lambda m:'—'*int(m.group(1)),s)
    s=re.sub(r'<ruby=[^>]*>|</ruby>|<[^>]+>','',s)
    return s.strip()

def convert(probe, project):
    book=json.loads((probe/'scenarios.asset_-2507898223139034885.json').read_text(encoding='utf-8'))
    settings=json.loads((probe/'scenarios.asset_1416801050685970231.json').read_text(encoding='utf-8'))['settingList']
    def records(table):
        header=table['rows'][0]['strings']
        return [dict(zip(header,r['strings'])) for r in table['rows'][1:] if not r['isEmpty'] and not r['isCommentOut']]
    names={r['Key']:r.get('Chinese') or r['Key'] for r in records(settings[0])}
    bgmap={r['Label']:Path(r.get('FileName','')).stem for r in records(settings[4]) if r.get('FileName')}
    actors={}
    inherited_actor=''
    for r in records(settings[2]):
        inherited_actor=r.get('CharacterName') or inherited_actor
        if r.get('FileName'):
            actors[(inherited_actor,r.get('Pattern',''))]=Path(r['FileName']).stem
    chapters=[]; labels={}; ignored=collections.Counter(); used=set(); missing=set(); dialogue_count=0
    def asset(name):
        if name:used.add(name)
        return name
    for ch,table in enumerate(book['importGridList']):
        out=[]; group=[]
        def flush():
            if group:out.append({'op':'choice','items':list(group)});group.clear()
        for row in table['rows'][1:]:
            if row['isEmpty'] or row['isCommentOut']:continue
            a=(row['strings']+['']*14)[:14];cmd=a[0];text=clean(a[12]);loc=row['rowIndex']
            if cmd=='Selection':
                group.append({'text':text or clean(a[8]),'target':a[1]});continue
            flush()
            if cmd.startswith('*'):
                labels[f'{ch+1}:{cmd}']=[ch+1,len(out)];continue
            if cmd=='Jump':out.append({'op':'jump','target':a[1]});continue
            if cmd=='EndScenario':out.append({'op':'end'});continue
            if cmd in ['Bg','BgEvent']:
                image=bgmap.get(a[1]);
                if image:out.append({'op':'background','image':asset(image),'clearBody':True,'event':cmd=='BgEvent'})
                else:missing.add('background:'+a[1])
                continue
            if cmd=='BgEventOff':out.append({'op':'restoreBackground'});continue
            if cmd=='BgOff':
                out.append({'op':'background','image':'bg_black','clearBody':True});asset('bg_black');continue
            if cmd=='CharacterOff':out.append({'op':'body','image':''});continue
            if cmd=='':
                actor=a[1];pattern=a[2]
                if actor=='Bgm' and not text:
                    ignored['Bgm']+=1;continue
                target=actor
                match=re.match(r'<Character=([^>]+)>',pattern)
                if match:target=match.group(1);pattern='通常'
                image=actors.get((target,pattern))
                if pattern=='<Off>':out.append({'op':'body','image':''})
                elif image:out.append({'op':'body','image':asset(image)})
                elif pattern and actor and not match:missing.add('actor:'+actor+':'+pattern)
                if text:
                    speaker=names.get(actor,names.get(actor.rstrip('大'),actor))
                    out.append({'op':'text','speaker':speaker,'text':text,'sourceRow':loc});dialogue_count+=1
                continue
            ignored[cmd]+=1
        flush();chapters.append(out)
    # Resolve targets locally first, then across sheets. Ambiguity is an error.
    def resolve(ch,target):
        if f'{ch}:{target}' in labels:return labels[f'{ch}:{target}']
        matches=[v for k,v in labels.items() if k.split(':',1)[1]==target]
        if len(matches)!=1:raise ValueError(f'unresolved/ambiguous label {ch} {target} {matches}')
        return matches[0]
    for ch,ops in enumerate(chapters,1):
        for op in ops:
            if op['op']=='jump':op['to']=resolve(ch,op.pop('target'))
            elif op['op']=='choice':
                for choice in op['items']:choice['to']=resolve(ch,choice.pop('target'))
    dest=project/'src/common/story';dest.mkdir(parents=True,exist_ok=True)
    for i,ops in enumerate(chapters,1):(dest/f'{i}.txt').write_text(json.dumps(ops,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    gallery=build_catalog(settings)
    (project/'src/common/gallery.txt').write_text(json.dumps(gallery,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    manifest={'title':'星空列车与白的旅行','chapters':len(chapters),'dialogues':dialogue_count,
      'choiceGroups':sum(o['op']=='choice' for c in chapters for o in c),'labels':len(labels),'assets':sorted(used),
      'ignoredPresentationCommands':dict(ignored),'unresolvedAppearancePatterns':sorted(missing),
      'galleryCount':len(gallery),'galleryImages':[x['image'] for x in gallery]}
    (project/'conversion-report.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in manifest.items() if k not in ['assets','unresolvedAppearancePatterns','galleryImages']},ensure_ascii=False))
    print('required images',len(used),'unresolved appearance',len(missing))
    return manifest

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--probe',type=Path,default=Path(__file__).resolve().parents[1]/'.extracted');p.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1]);a=p.parse_args();convert(a.probe,a.project)
