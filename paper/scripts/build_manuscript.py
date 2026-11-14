"""Build the ASAIO manuscript package from paper/manuscript/manuscript.md + references_provided.bib.
- Citations [@key; @key2] -> superscript numbers in order of first appearance (ASAIO style).
- {{TAG}} / {{HASH}} filled from the git tag v1.0-asaio.
- Writes paper/submission/: Manuscript.docx (abstract, keywords, text, references, figure legends; no title page),
  TitlePage.docx, CoverLetter.docx, word_count.txt, references_used.txt.
Run: python -I paper/scripts/build_manuscript.py"""
import datetime, pathlib, re, subprocess, sys
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

P = pathlib.Path(__file__).resolve().parent.parent
REPO = P.parent
sys.path.insert(0, str(P / 'manuscript'))
import front_matter as FM  # noqa: E402

OUT = P / 'submission'; OUT.mkdir(exist_ok=True)
TAG = 'v1.0-asaio'
HASH = subprocess.run(['git', 'rev-list', '-n', '1', TAG], cwd=REPO, capture_output=True, text=True, check=True).stdout.strip()
URL = 'https://github.com/Rugved3-droid/cardioflow-mcs'

# ---------------- bibliography
bib = (P / 'references_provided.bib').read_text(encoding='utf8')
entries = {}
for m in re.finditer(r'@article\{(\w+),(.*?)\n\}', bib, re.S):
    key, body = m.group(1), m.group(2)
    f, i = {}, 0
    for fm in re.finditer(r'(\w+)\s*=\s*\{', body):
        if fm.start() < i: continue
        j, depth = fm.end(), 1
        while depth:
            depth += {'{': 1, '}': -1}.get(body[j], 0); j += 1
        f[fm.group(1).lower()] = body[fm.end():j - 1].strip(); i = j
    entries[key] = f

TEX = {r"{\'e}": 'é', r"{\'a}": 'á', r'{\o}': 'ø', r'{\v{c}}': 'č', r'{\v{s}}': 'š', r'{\v{t}}': 'ť', r'{\v{z}}': 'ž', r'{\ae}': 'æ', r'{\"a}': 'ä', r'{\"o}': 'ö'}


def detex(s):
    for k, v in TEX.items(): s = s.replace(k, v)
    return s.replace('{', '').replace('}', '')


JOURNAL = {'ASAIO Journal': 'ASAIO J', 'Perfusion': 'Perfusion', 'Journal of Translational Medicine': 'J Transl Med',
           'Frontiers in Cardiovascular Medicine': 'Front Cardiovasc Med', 'EuroIntervention': 'EuroIntervention',
           'Journal of the American College of Cardiology': 'J Am Coll Cardiol', 'New England Journal of Medicine': 'N Engl J Med',
           'Circulation Research': 'Circ Res', 'American Journal of Physiology': 'Am J Physiol',
           'Medical and Biological Engineering and Computing': 'Med Biol Eng Comput',
           'Catheterization and Cardiovascular Interventions': 'Catheter Cardiovasc Interv', 'Journal of Cardiac Failure': 'J Card Fail',
           'BioMedical Engineering OnLine': 'Biomed Eng Online', 'Bioengineering': 'Bioengineering (Basel)'}


def author_short(a):
    a = detex(a).strip()
    if a == 'others': return None
    last, first = [x.strip() for x in a.split(',', 1)]
    initials = ''.join(w[0] for w in re.split(r'[\s.\-]+', first) if w)
    return f'{last} {initials}'


def asaio_ref(e):
    names = [author_short(a) for a in e['author'].split(' and ')]
    more = None in names
    names = [n for n in names if n]
    if len(names) > 6 or more:
        auth = ', '.join(names[:3]) + ', et al'
    else:
        auth = ', '.join(names)
    title = detex(e['title']).rstrip('.')
    j = JOURNAL[detex(e['journal'])]
    pages = detex(e.get('pages', '')).replace('--', '–')
    return f"{auth}: {title}. {j} {e['volume']}: {pages}, {e['year']}."


# ---------------- manuscript text
md = (P / 'manuscript' / 'manuscript.md').read_text(encoding='utf8').replace('{{TAG}}', TAG).replace('{{HASH}}', HASH)
order = []


def cite(m):
    keys = [k.strip().lstrip('@') for k in m.group(1).split(';')]
    nums = []
    for k in keys:
        if k not in entries: raise SystemExit(f'citation {k} not in references_provided.bib')
        if k not in order: order.append(k)
        nums.append(order.index(k) + 1)
    nums = sorted(nums)
    # compress ranges
    out, i = [], 0
    while i < len(nums):
        j = i
        while j + 1 < len(nums) and nums[j + 1] == nums[j] + 1: j += 1
        out.append(f'{nums[i]}–{nums[j]}' if j - i >= 2 else ','.join(str(n) for n in nums[i:j + 1]))
        i = j + 1
    return '^{' + ','.join(out) + '}'


md = re.sub(r'\[(@[^\]]+)\]', cite, md)
secs = {}
for s in re.split(r'^# ', md, flags=re.M):
    if s.strip():
        h, body = s.split('\n', 1)
        secs[h.strip()] = body.strip()


# ---------------- docx helpers
def base_doc():
    d = Document()
    st = d.styles['Normal']; st.font.name = 'Arial'; st.font.size = Pt(12)
    st.element.rPr.rFonts.set(qn('w:eastAsia'), 'Arial')
    pf = st.paragraph_format; pf.line_spacing = 2.0; pf.space_after = Pt(0)
    for h in ('Heading 1', 'Heading 2'):
        hs = d.styles[h]; hs.font.name = 'Arial'; hs.font.size = Pt(12); hs.font.bold = True; hs.font.color.rgb = None
        hs.element.rPr.rFonts.set(qn('w:eastAsia'), 'Arial'); hs.paragraph_format.line_spacing = 2.0
        hs.paragraph_format.space_before = Pt(12); hs.paragraph_format.space_after = Pt(0)
    sec = d.sections[0]
    for side in ('left_margin', 'right_margin', 'top_margin', 'bottom_margin'): setattr(sec, side, Inches(1))
    # page numbers in footer
    fp = sec.footer.paragraphs[0]; fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = fp.add_run()
    for t, txt in (('begin', None), (None, 'PAGE'), ('end', None)):
        if t:
            el = OxmlElement('w:fldChar'); el.set(qn('w:fldCharType'), t); r._r.append(el)
        else:
            el = OxmlElement('w:instrText'); el.set(qn('xml:space'), 'preserve'); el.text = txt; r._r.append(el)
    return d


def line_numbers(d):
    sp = d.sections[0]._sectPr
    ln = OxmlElement('w:lnNumType'); ln.set(qn('w:countBy'), '1'); ln.set(qn('w:restart'), 'continuous'); sp.append(ln)


def add_rich(p, text):
    # ^{..} superscript, *italic* not used; keep plain otherwise
    for part in re.split(r'(\^\{[^}]*\})', text):
        if part.startswith('^{'):
            r = p.add_run(part[2:-1]); r.font.superscript = True
        elif part:
            p.add_run(part)


def hl_runs(p, text):
    from docx.enum.text import WD_COLOR_INDEX
    for part in re.split(r'(\[(?:ORCID|DEGREE)\])', text):
        if not part: continue
        r = p.add_run(part)
        if part in ('[ORCID]', '[DEGREE]'): r.font.highlight_color = WD_COLOR_INDEX.YELLOW


def para(d, text, bold=False, align=None):
    p = d.add_paragraph()
    if bold:
        p.add_run(text).bold = True
    else:
        add_rich(p, text)
    if align: p.alignment = align
    return p


def body(d, text):
    for block in text.split('\n\n'):
        block = block.strip()
        if not block: continue
        if block.startswith('## '):
            d.add_heading(block[3:].strip(), level=2)
        else:
            para(d, block.replace('\n', ' '))


# ---------------- Manuscript.docx
d = base_doc(); line_numbers(d)
para(d, FM.TITLE, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
d.add_heading('Abstract', level=1); body(d, secs['ABSTRACT'])
para(d, 'Key Words: ' + secs['KEYWORDS'].replace(';', ','))
for h in ['INTRODUCTION', 'MATERIALS AND METHODS', 'RESULTS', 'DISCUSSION']:
    d.add_heading(h.title().replace('And', 'and'), level=1); body(d, secs[h])
d.add_heading('References', level=1)
for i, k in enumerate(order, 1):
    para(d, f'{i}. {asaio_ref(entries[k])}')
d.add_heading('Figure Legends', level=1)
for lab, txt in FM.LEGENDS:
    p = d.add_paragraph(); p.add_run(lab + ' ').bold = True; p.add_run(txt)
d.add_heading('Supplemental Digital Content', level=1)
para(d, 'Supplemental Digital Content Video 1 (MP4; legend in Supplemental Digital Content 1). '
        'Supplemental Digital Content 1 (PDF): model equations (Section S1), full parameter table (Table S1), numerical verification (Table S2), '
        'Impella P1–P9 sweep (Table S3), baseline comparison (Table S4), full benchmark concordance with source locations (Table S5), '
        'baroreflex on vs off (Table S6), IABP balloon volume (Table S7), sensitivity tornado plot (Figure S1), full paired-state screen (Figure S2), parameter provenance (Section S2) and benchmark extraction (Section S3).')
d.save(OUT / 'Manuscript.docx')

# ---------------- TitlePage.docx
t = base_doc()
para(t, FM.TITLE, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
para(t, '')
p = t.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
for i, (n, a, _) in enumerate(FM.AUTHORS):
    hl_runs(p, n); r = p.add_run(a + ('*' if i == 0 else '')); r.font.superscript = True
    if i < len(FM.AUTHORS) - 1: p.add_run(', ')
for a, txt in FM.AFFILIATIONS:
    p = t.add_paragraph(); r = p.add_run(a); r.font.superscript = True; p.add_run(' ' + txt)
para(t, '')
para(t, f'*Corresponding author: {FM.CORRESPONDING[0]}, {FM.CORRESPONDING[1]}. Email: {FM.CORRESPONDING[2]}')
for n, _, o in FM.AUTHORS:
    hl_runs(t.add_paragraph(), f'{n}: {o}')
para(t, f'Running head: {FM.RUNNING_HEAD}')
para(t, f'Sources of Funding: {FM.FUNDING}')
para(t, f'Conflicts of Interest: {FM.COI}')
para(t, f'Author contributions: {FM.AUTHOR_CONTRIBUTIONS}')
para(t, f'Code availability: {URL} (tag {TAG}, commit {HASH}).')
para(t, 'Ethics: This in silico study involved no human or animal participants.')
t.save(OUT / 'TitlePage.docx')

# ---------------- CoverLetter.docx
c = base_doc()
for block in FM.COVER_LETTER.format(date=datetime.date.today().strftime('%B %d, %Y'), title=FM.TITLE, tag=TAG, hash=HASH).split('\n'):
    p = c.add_paragraph(block); p.paragraph_format.line_spacing = 1.15
c.save(OUT / 'CoverLetter.docx')

# ---------------- counts
sys.argv = ['wc', str(P / 'manuscript' / 'manuscript.md')]
wc = subprocess.run([sys.executable, '-I', str(P / 'scripts' / 'wordcount.py'), str(P / 'manuscript' / 'manuscript.md')], capture_output=True, text=True).stdout.strip()
wc0 = subprocess.run([sys.executable, '-I', str(P / 'scripts' / 'wordcount.py'), str(P / 'manuscript' / 'manuscript_draft1.md')], capture_output=True, text=True).stdout.strip()
cite_needed = len(re.findall(r'\[CITE NEEDED\]', md))
(OUT / 'word_count.txt').write_text(
    f'Final:   {wc}\nDraft 1: {wc0}\n'
    'Main text = Introduction + Materials and Methods + Results + Discussion (incl. Limitations, Conclusions); excludes title, abstract, headings, citations, references, legends, tables.\n'
    f'References: {len(order)}\nFigures: 4; Tables: 3 (total display items 7)\n[CITE NEEDED] markers: {cite_needed}\n', encoding='utf8')
(OUT / 'references_used.txt').write_text('\n'.join(f'{i}. {k}' for i, k in enumerate(order, 1)), encoding='utf8')
print((OUT / 'word_count.txt').read_text(encoding='utf8'))
print('commit', HASH)
