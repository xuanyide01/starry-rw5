"""Display whitespace rules shared by conversion and corpus cleanup."""
import re
CJK=r'\u2e80-\u9fff\uf900-\ufaff\uff01-\uff65…—“”‘’'
def normalize_text(value):
    text=str(value or '').replace('\r\n','\n').replace('\r','\n').replace('\u200b','').replace('\ufeff','')
    lines=[]
    for line in text.split('\n'):
        line=re.sub(r'[\t\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]',' ',line).strip()
        line=re.sub(r' {2,}',' ',line)
        line=re.sub('(['+CJK+']) +(?=['+CJK+'])',r'\1',line)
        lines.append(line)
    return re.sub(r'\n{3,}','\n\n','\n'.join(lines)).strip()
