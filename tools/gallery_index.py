"""Index every original event picture and additional CG texture variant."""
import re
from pathlib import Path

def build_catalog(settings, available=None):
    table=settings[4];header=table['rows'][0]['strings'];names=set()
    for row in table['rows'][1:]:
        if row['isEmpty'] or row['isCommentOut']:continue
        record=dict(zip(header,row['strings']))
        if record.get('Type')=='Event' and record.get('FileName'):
            names.add(Path(record['FileName']).stem)
    declared=set(names)
    if available is not None:
        # Digit-only names are the PC gallery's thumbnails, not full CGs.
        names.update(n for n in available if re.fullmatch(r'(?:large_)?evcg\d+[a-z]\d*',n))
    intros={'aban01':1,'aban03':2,'neriaban':3}
    def order(name):
        if name in intros:return (0,intros[name],'',0)
        m=re.fullmatch(r'(large_)?evcg(\d+)([a-z]\d*)',name)
        if m:return (1,int(m[2]),m[3],bool(m[1]))
        return (2,0,name,0)
    catalog=[]
    for name in sorted(names,key=order):
        if name in intros:label='开场插图 '+str(intros[name])
        else:
            m=re.fullmatch(r'(large_)?evcg(\d+)([a-z]\d*)',name)
            label=('CG '+m[2]+' · '+m[3]+(' · 近景' if m[1] else '')) if m else '特别插图'
        catalog.append({'image':name,'label':label,'source':'event-table' if name in declared else 'additional-texture'})
    return catalog
