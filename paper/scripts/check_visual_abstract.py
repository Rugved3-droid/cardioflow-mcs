"""Text-fit check for submission/VisualAbstract.pptx without a renderer: wraps each paragraph with the theme
font's real glyph metrics (Calibri, from C:/Windows/Fonts), computes the auto-grown box height
(spAutoFit; insets 0.1 in L/R, 0.05 in T/B; line pitch 1.2 x size) and checks that no box collides
with the next element or leaves the slide. Run: python -I paper/scripts/check_visual_abstract.py"""
import pathlib, sys
from PIL import ImageFont
from pptx import Presentation
sys.stdout.reconfigure(encoding='utf-8')
P = pathlib.Path(__file__).resolve().parent.parent
EMU = 914400
prs = Presentation(P / 'submission' / 'VisualAbstract.pptx'); sl = prs.slides[0]; SH = prs.slide_height / EMU


def wrap_lines(text, font, width_pt):
    words, lines, cur = text.split(), 0, ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if font.getlength(t) <= width_pt or not cur: cur = t
        else: lines += 1; cur = w
    return lines + (1 if cur else 0)


boxes, ok = [], True
for sh in sl.shapes:
    if not sh.has_text_frame or not sh.text_frame.text.strip(): continue
    w_in = sh.width / EMU - 0.2; h = 0.1
    for p in sh.text_frame.paragraphs:
        txt = ''.join(r.text for r in p.runs)
        size = max((r.font.size.pt for r in p.runs if r.font.size), default=18)
        bold = any(r.font.bold for r in p.runs)
        f = ImageFont.truetype('C:/Windows/Fonts/' + ('calibrib.ttf' if bold else 'calibri.ttf'), int(size * 100))
        indent = 0.25 if p.level or sh.name in ('TextBox 16', 'TextBox 11') else 0  # template bullet indent allowance
        n = wrap_lines(txt, f, (w_in - indent) * 72 * 100) if txt else 1
        h += n * size * 1.2 / 72
    top = sh.top / EMU
    boxes.append((sh.name, top, top + h, sh.left / EMU, sh.left / EMU + sh.width / EMU, h))
    print(f'{sh.name:10s} top {top:.2f} needs {h:.2f} in -> bottom {top + h:.2f} in')
# collisions with the central picture and the conclusion box
pic = [s for s in sl.shapes if s.shape_type == 13 and s.width / EMU < 7]
conc = [b for b in boxes if b[0] == 'TextBox 5'][0]
for b in boxes:
    if b[0] in ('TextBox 16', 'TextBox 11', 'TextBox 3') and b[2] > conc[1] - 0.05 and b[0] != 'TextBox 3':
        print('COLLISION', b[0], 'with conclusion'); ok = False
    if b[0] == 'TextBox 3' and b[2] > 1.30: print('COLLISION title with central image'); ok = False
    if b[0] == 'TextBox 5' and b[2] > 7.0: print('COLLISION conclusion with footer'); ok = False
    if b[2] > SH: print('OFF SLIDE', b[0]); ok = False
print('FIT OK' if ok else 'FIT FAILED')
sys.exit(0 if ok else 1)
