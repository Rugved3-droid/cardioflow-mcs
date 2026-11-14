"""Render Europe PMC JATS XML (and the EuroIntervention HTML page) to plain text with
table IDs, so benchmark values can be cited by XML table ID. Usage: python -I xml_to_text.py"""
import re, sys, pathlib, xml.etree.ElementTree as ET
B = pathlib.Path(__file__).resolve().parent.parent / 'benchmarks'
def txt(e): return re.sub(r'\s+', ' ', ''.join(e.itertext())).strip()
for f in sorted((B/'xml').glob('*.xml')):
    root = ET.parse(f).getroot(); out = []
    for el in root.iter():
        tag = el.tag
        if tag == 'article-title' and not out: out.append('TITLE: ' + txt(el))
        elif tag == 'contrib-group': out.append('AUTHORS: ' + '; '.join(txt(n) for n in el.iter('name')))
        elif tag in ('title',) : out.append('\n## ' + txt(el))
        elif tag == 'p': out.append(txt(el))
        elif tag == 'table-wrap':
            out.append(f"\n[TABLE id={el.get('id')}] " + txt(el.find('label')) if el.find('label') is not None else f"\n[TABLE id={el.get('id')}]")
            cap = el.find('caption');  out.append('CAPTION: ' + (txt(cap) if cap is not None else ''))
            for tr in el.iter('tr'): out.append(' | '.join(txt(c) for c in tr if c.tag in ('td','th')))
            foot = el.find('table-wrap-foot')
            if foot is not None: out.append('FOOT: ' + txt(foot))
        elif tag == 'fig':
            out.append(f"\n[FIG id={el.get('id')}] " + (txt(el.find('label')) if el.find('label') is not None else '') + ' ' + (txt(el.find('caption')) if el.find('caption') is not None else ''))
    meta = root.find('.//article-meta')
    for k in ['volume','issue','fpage','lpage','elocation-id']:
        n = meta.find(k) if meta is not None else None
        if n is not None: out.insert(1, f'{k.upper()}: {txt(n)}')
    for aid in root.iter('article-id'): out.insert(1, f"ID {aid.get('pub-id-type')}: {aid.text}")
    (B/'text'/(f.stem + '.txt')).write_text('\n'.join(out), encoding='utf8'); print(f.stem, len(out))
h = B/'mollerhelgestad2019_landing.html'
if h.exists():
    s = h.read_text(encoding='utf8', errors='ignore')
    s = re.sub(r'(?is)<(script|style).*?</\1>', ' ', s)
    s = re.sub(r'(?i)</(tr|p|h\d|li|table|caption)>', '\n', s); s = re.sub(r'(?i)</t[dh]>', ' | ', s)
    s = re.sub(r'<[^>]+>', ' ', s); s = re.sub(r'[ \t]+', ' ', s); s = re.sub(r'\n\s*\n+', '\n', s)
    (B/'text'/'mollerhelgestad2019.txt').write_text(s, encoding='utf8'); print('mh', len(s))
