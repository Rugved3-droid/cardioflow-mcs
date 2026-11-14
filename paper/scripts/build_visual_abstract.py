"""Visual abstract in the ASAIO template (paper/Visual_Abstract_Templates.pptx, slide 1 layout).
Numbers read from results/. Run: python -I paper/scripts/build_visual_abstract.py -> paper/submission/VisualAbstract.pptx"""
import copy, json, pathlib
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from pptx import Presentation
from pptx.util import Pt, Inches

P = pathlib.Path(__file__).resolve().parent.parent
R = P / 'results'
s = json.load(open(R / 'v3_concordance_summary.json'))['reflex_on']
d = pd.read_csv(R / 'm2_impella_vs_iabp.csv'); on = d[d.reflex == 'on'].set_index('arm')
lv = [f'ECMO4+P{i}' for i in range(2, 9)]

# central image: Impella dose-response vs IABP on ECMO 4
plt.rcParams.update({'font.family': 'Arial', 'font.size': 15, 'axes.spines.top': False, 'axes.spines.right': False})
fig, ax = plt.subplots(figsize=(6.2, 3.8))
ax.plot(on.loc[lv, 'impella_Lpm'], on.loc[lv, 'd_lap'], '-o', color='#2a78d6', lw=2.5, ms=7, label='Impella P2–P8')
ax.axhline(on.loc['ECMO4+IABP', 'd_lap'], color='#eb6834', lw=2.5, ls='-.', label='IABP 40 mL')
ax.set_xlabel('Impella flow on VA-ECMO 4 L/min (L/min)'); ax.set_ylabel('Δ PCWP surrogate (mmHg)')
ax.legend(frameon=False, loc='lower left'); ax.set_title('LV unloading on VA-ECMO: dose matters', loc='left', fontsize=15)
fig.tight_layout(); img = P / 'results' / 'figs' / 'sub' / 'visual_abstract_center.png'; fig.savefig(img, dpi=300); plt.close(fig)

prs = Presentation(P / 'Visual_Abstract_Templates.pptx')
# keep slide 1 (central-image layout), drop slide 2
sldIdLst = prs.slides._sldIdLst; last = sldIdLst[1]; prs.part.drop_rel(last.rId); sldIdLst.remove(last)
sl = prs.slides[0]
by = {sh.name: sh for sh in sl.shapes}


def fill(shape, lines, size=14, bold_first=False):
    tf = shape.text_frame
    first = tf.paragraphs[0]; font_run = first.runs[0] if first.runs else None
    for p in list(tf.paragraphs)[1:]: p._p.getparent().remove(p._p)
    for i, line in enumerate(lines):
        p = first if i == 0 else tf.add_paragraph()
        if i == 0:
            for r in list(p.runs)[1:]: r._r.getparent().remove(r._r)
            r = p.runs[0] if p.runs else p.add_run()
        else:
            p.level = first.level
            if first._p.pPr is not None:  # carry the template bullet/indent to every detail line
                old = p._p.pPr
                if old is not None: p._p.remove(old)
                p._p.insert(0, copy.deepcopy(first._p.pPr))
            r = p.add_run()
        r.text = line; r.font.size = Pt(size)
        if bold_first and i == 0: r.font.bold = True


fill(by['TextBox 3'], ['Paired-State Simulation of Temporary Mechanical Circulatory Support'], size=22)
fill(by['TextBox 16'], ['Study design', 'Open-source browser simulator; two identical shock patients differing in one device setting',
                        'IABP, Impella-class pump, VA-ECMO', 'Verified solver; 67 benchmark comparisons (consistency vs independent)'], size=12, bold_first=True)
ind, con, sig = s['independent'], s['consistency'], s['independent_significant_only']
fill(by['TextBox 11'], ['Results', f"Independent porcine data: {ind['concordant']}/{ind['total']} directions ({sig['concordant']}/{sig['total']} significant)",
                        f"Source model / anchors: {con['concordant']}/{con['total']}",
                        'No direction reverses under ±20% or without the reflex', 'Impella > IABP only above 2.6 L/min'], size=12, bold_first=True)
fill(by['TextBox 5'], ['A verified paired-state simulator reproduces most device-effect directions; it supports directional reasoning, not patient-specific decisions.'], size=15)
ph = by['TextBox 14']; ph._element.getparent().remove(ph._element)
box = by['Rectangle 13']
sl.shapes.add_picture(str(img), box.left + Inches(0.1), box.top + Inches(0.1), width=box.width - Inches(0.2))
out = P / 'submission' / 'VisualAbstract.pptx'; prs.save(out); print('saved', out)
