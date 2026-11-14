"""Co-author review PDF: title page + manuscript + tables + figures + SDC, in that order.
Word COM / docx2pdf hang on this machine, so the .docx files are rendered to HTML here (paragraph text, bold,
superscript, yellow highlight, headings, tables) and printed with headless Chrome (scripts/html_to_pdf.ts);
SDC1.pdf is appended with pypdf. Review copy only; upload the .docx/.tif/.pdf originals to Editorial Manager.
Run: python -I paper/scripts/build_review_pdf.py  (then it calls Chrome and merges)"""
import html, io, pathlib, subprocess, sys
from docx import Document
from docx.enum.text import WD_COLOR_INDEX
from PIL import Image
from pypdf import PdfReader, PdfWriter

Image.MAX_IMAGE_PIXELS = None
P = pathlib.Path(__file__).resolve().parent.parent
S = P / 'submission'; TMP = S / '_review_tmp'; TMP.mkdir(exist_ok=True)


def runs_html(par):
    out = []
    for r in par.runs:
        t = html.escape(r.text)
        if not t: continue
        if r.font.superscript: t = f'<sup>{t}</sup>'
        if r.bold: t = f'<b>{t}</b>'
        if r.font.highlight_color == WD_COLOR_INDEX.YELLOW: t = f'<mark>{t}</mark>'
        out.append(t)
    return ''.join(out)


def docx_html(path, double=False):
    d = Document(path); body = d.element.body; parts = []
    from docx.table import Table
    from docx.text.paragraph import Paragraph
    for child in body.iterchildren():
        tag = child.tag.split('}')[1]
        if tag == 'p':
            p = Paragraph(child, d); st = p.style.name if p.style is not None else ''
            h = runs_html(p)
            if not h.strip(): continue
            if st.startswith('Heading'): parts.append(f'<h3>{h}</h3>')
            else: parts.append(f'<p>{h}</p>')
        elif tag == 'tbl':
            t = Table(child, d); rows = []
            for i, row in enumerate(t.rows):
                cells = ''.join(f"<{'th' if i == 0 else 'td'}>{'<br>'.join(runs_html(p) for p in c.paragraphs)}</{'th' if i == 0 else 'td'}>" for c in row.cells)
                rows.append(f'<tr>{cells}</tr>')
            parts.append(f"<table>{''.join(rows)}</table>")
    cls = 'dbl' if double else ''
    return f'<section class="{cls}">' + '\n'.join(parts) + '</section>'


sections = [docx_html(S / 'TitlePage.docx'), docx_html(S / 'Manuscript.docx', double=True)]
for i in (1, 2, 3):
    sections.append(docx_html(S / 'tables' / f'Table{i}.docx'))
for i in (1, 2, 3, 4):
    im = Image.open(S / 'figures' / f'Figure{i}.tif').convert('RGB'); im.thumbnail((2100, 2700))
    png = TMP / f'Figure{i}.png'; im.save(png)
    sections.append(f'<section><p><b>Figure {i}</b></p><img src="{png.name}"></section>')
doc = f"""<!doctype html><html><head><meta charset="utf-8"><title>CardioFlow co-author review</title>
<style>body{{font-family:Arial,sans-serif;font-size:11pt;line-height:1.4}} section{{page-break-after:always}} section.dbl p{{line-height:1.9}}
h3{{font-size:12pt;margin:14pt 0 4pt}} table{{border-collapse:collapse;font-size:8.5pt;width:100%}} td,th{{border:0.5pt solid #888;padding:2pt 4pt;vertical-align:top}}
th{{background:#eee}} mark{{background:#ffff00}} img{{max-width:100%;max-height:8.6in}}</style></head><body>
<p style="color:#a00"><b>Co-author review copy</b> (rendered from the submission .docx files; layout differs from Word; upload the originals to Editorial Manager).</p>
{''.join(sections)}<script>window.__katexDone=true</script></body></html>"""
(TMP / 'review.html').write_text(doc, encoding='utf8')
subprocess.run(['npx', 'tsx', 'paper/scripts/html_to_pdf.ts', str(TMP / 'review.html'), str(TMP / 'review_main.pdf')], check=True, shell=True, cwd=P.parent)
w = PdfWriter()
for f in (TMP / 'review_main.pdf', S / 'SDC1.pdf'):
    for pg in PdfReader(f).pages: w.add_page(pg)
out = S / 'CardioFlow_coauthor_review.pdf'
with open(out, 'wb') as fh: w.write(fh)
print(out, len(PdfReader(out).pages), 'pages')
