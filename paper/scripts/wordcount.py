"""Word counts for a manuscript markdown file: abstract and main text (Introduction through Conclusions,
excluding headings, citation markers and the title). Usage: python -I wordcount.py <file.md>"""
import re, sys
t = open(sys.argv[1], encoding='utf8').read()
secs = re.split(r'^# ', t, flags=re.M)
d = {s.split('\n', 1)[0].strip(): s.split('\n', 1)[1] if '\n' in s else '' for s in secs if s.strip()}
def words(s):
    s = re.sub(r'\[@[^\]]+\]', '', s)
    s = '\n'.join(l for l in s.splitlines() if not l.startswith('#'))
    return len(re.findall(r"[A-Za-z0-9ÄÖÜäöüáéíóúøåšžčť×⁻⁰¹²³⁴⁵⁶⁷⁸⁹.,%±+\-–−/()\[\]'’≈<>=:;]+", s))
main = sum(words(d[k]) for k in ['INTRODUCTION', 'MATERIALS AND METHODS', 'RESULTS', 'DISCUSSION'] if k in d)
print(f"abstract={words(d.get('ABSTRACT',''))} main={main}")
