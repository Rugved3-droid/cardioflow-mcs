"""Submission tables (ASAIO: one .docx per table, Arial 12, double-spaced).
Every number is read from paper/results/ or paper/benchmarks/; parameter values are those in src/model (cited by file:line).
Run: python -I paper/scripts/build_tables.py -> paper/submission/tables/Table{1,2,3}.docx"""
import json, pathlib
import pandas as pd
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

P = pathlib.Path(__file__).resolve().parent.parent
R, B = P / 'results', P / 'benchmarks'
OUT = P / 'submission' / 'tables'; OUT.mkdir(parents=True, exist_ok=True)


def new_doc(landscape=False):
    d = Document()
    st = d.styles['Normal']; st.font.name = 'Arial'; st.font.size = Pt(12)
    st.element.rPr.rFonts.set(qn('w:eastAsia'), 'Arial')
    st.paragraph_format.line_spacing = 2.0
    sec = d.sections[0]
    if landscape:
        sec.orientation = WD_ORIENT.LANDSCAPE
        sec.page_width, sec.page_height = sec.page_height, sec.page_width
    for side in ('left_margin', 'right_margin', 'top_margin', 'bottom_margin'):
        setattr(sec, side, Inches(1))
    return d


def table(d, header, rows, widths=None):
    t = d.add_table(rows=1, cols=len(header)); t.style = 'Table Grid'
    for i, h in enumerate(header):
        c = t.rows[0].cells[i]; c.text = ''; r = c.paragraphs[0].add_run(h); r.bold = True
    for row in rows:
        cells = t.add_row().cells
        for i, v in enumerate(row):
            cells[i].text = str(v)
    for row in t.rows:
        for i, c in enumerate(row.cells):
            for p in c.paragraphs:
                p.paragraph_format.line_spacing = 1.0
                for r in p.runs: r.font.size = Pt(10); r.font.name = 'Arial'
            if widths: c.width = Inches(widths[i])
    # repeat header row
    trPr = t.rows[0]._tr.get_or_add_trPr(); h = OxmlElement('w:tblHeader'); h.set(qn('w:val'), 'true'); trPr.append(h)
    return t


def caption(d, text):
    p = d.add_paragraph(); r = p.add_run(text); r.bold = True


def foot(d, text):
    p = d.add_paragraph(text); p.paragraph_format.line_spacing = 2.0
    for r in p.runs: r.font.size = Pt(12)


f1 = lambda x: f'{x:.1f}'
f2 = lambda x: f'{x:.2f}'

# ---------------- Table 1: key parameters and provenance
d = new_doc()
caption(d, 'Table 1. Key model parameters of the simulated patient and devices, with provenance')
rows = [
    ['LV end-systolic elastance, Ees', '0.62 mmHg/mL', 'patient.ts:49', 'Set for Ea/Ees ≈ 4 after the stroke-work direction of Ostadal 2015 (calibration anchor)'],
    ['LV EDPVR A, B, V0,ed', '8.0 mmHg, 0.0093 mL⁻¹, 53 mL', 'patient.ts:57–60', 'Set so diastolic stiffness ≈ 0.26 mmHg/mL, the value implied by Donker 2019 (calibration anchor)'],
    ['LV ESPVR intercept, V0', '40 mL', 'patient.ts:51', 'Internal'],
    ['Heart rate (fixed)', '100 bpm', 'patient.ts:45', 'Internal'],
    ['Systemic arterial compliance, C_SA', '1.3 mL/mmHg', 'patient.ts:88', 'Internal'],
    ['Proximal aortic compliance, C_Ao; impedance, Rc', '0.2 mL/mmHg; 0.05 mmHg·s/mL', 'patient.ts:86–87', 'Internal'],
    ['Systemic venous compliance, C_SV', '120 mL/mmHg', 'patient.ts:91', 'Internal'],
    ['Baroreflex on SVR: setpoint, width, SVR range', '68 mmHg, 12 mmHg, 0.45–1.25 mmHg·s/mL', 'patient.ts:78–82', 'Setpoint chosen to reproduce the open-loop SVR (≈16 WU); reflex added to bring the ECMO ΔLVEDP into a window taken from Donker 2019. Gain is a modeling assumption'],
    ['Baroreflex lags (sensing, effector)', '2 s, 8 s', 'patient.ts:83–84', 'Internal'],
    ['Impella shut-off head at P9; H–Q slope', '200 mmHg; 2.2 mmHg per mL/s', 'impella.ts:21–22', 'Illustrative; not a manufacturer curve'],
    ['IABP balloon volume; inflation, deflation', '40 mL; 60 ms, 50 ms', 'iabp.ts:20–23', 'Internal (standard adult balloon size)'],
    ['VA-ECMO', 'Set flow; drainage roll-off 0.5–3.5 mmHg', 'ecmo.ts:14–15', 'Ideal flow source; roll-off never engaged in this study'],
    ['Integration', 'Fixed-step RK4, h = 0.25 ms', 'sim.ts', 'Verified (V1)'],
]
table(d, ['Parameter', 'Value', 'Source file', 'Provenance'], rows, widths=[1.8, 1.5, 1.1, 2.1])
foot(d, 'Source files are under src/model/ in the code release cited in Methods. The full parameter set is in Supplemental Digital Content (SDC) Table S1. '
        'EDPVR, end-diastolic pressure–volume relation; ESPVR, end-systolic pressure–volume relation; H–Q, pressure head–flow; '
        'IABP, intra-aortic balloon pump; RK4, fourth-order Runge–Kutta; SVR, systemic vascular resistance; VA-ECMO, venoarterial extracorporeal membrane oxygenation; WU, Wood units.')
d.save(OUT / 'Table1.docx')

# ---------------- Table 2: V3 concordance by source
s = json.load(open(R / 'v3_concordance_summary.json'))
names = {'donker2019simulation': ('Donker 2019 (simulation)', 'Human simulation', 'Consistency'),
         'donker2019review': ('Donker 2019 (review)', 'Review of simulation and clinical reports', 'Consistency'),
         'broome2016': ('Broomé 2016', 'Human simulation', 'Consistency'),
         'ostadal2015': ('Ostadal 2015', 'Porcine, acute shock, ECMO 1–5 L/min', 'Consistency'),
         'hala2020': ('Hála 2020', 'Porcine, chronic HF, ECMO 0–5 L/min', 'Independent'),
         'frontiers2020impella': ('Nix 2020 (industry-funded)', 'Porcine AMI, Impella CP vs ECMO 3.5', 'Independent'),
         'mollerhelgestad2019': ('Møller-Helgestad 2019', 'Porcine shock, Impella CP P8 vs ECMO 3.2', 'Independent')}
on, off = s['reflex_on'], s['reflex_off']
c = pd.read_csv(R / 'v3_concordance.csv')
rows = []
for k, (n, sp, cls) in names.items():
    a, b = on['by_source'][k], off['by_source'][k]
    rows.append([cls, n, sp, f"{a['concordant']}/{a['total']}", f"{b['concordant']}/{b['total']}"])
rows.append(['Consistency', 'Subtotal', '', f"{on['consistency']['concordant']}/{on['consistency']['total']}", f"{off['consistency']['concordant']}/{off['consistency']['total']}"])
rows.append(['Independent', 'Subtotal', '', f"{on['independent']['concordant']}/{on['independent']['total']}", f"{off['independent']['concordant']}/{off['independent']['total']}"])
rows.append(['Independent', 'Statistically significant benchmark changes only', '', f"{on['independent_significant_only']['concordant']}/{on['independent_significant_only']['total']}",
             f"{off['independent_significant_only']['concordant']}/{off['independent_significant_only']['total']}"])
d = new_doc(landscape=True)
caption(d, 'Table 2. Directional concordance of simulated device effects with published benchmarks')
table(d, ['Class', 'Source', 'Setting', 'Concordant directions, reflex on (primary)', 'Reflex off (sensitivity)'], rows, widths=[1.2, 2.3, 2.8, 1.6, 1.4])
foot(d, 'Each comparison scores the direction of change of one outcome for one device contrast (e.g., ECMO 4 L/min vs no support), or the ranking of two devices. '
        'Consistency sources are the source model of CardioFlow\'s calibration targets or a calibration anchor and are not independent validation; independent sources were not used in model development. '
        'Animal data were compared by direction and percent change only. Rules were fixed before comparison (Methods). Row-level values, locations in each source and relative magnitudes are in SDC Table S5. '
        'AMI, acute myocardial infarction; HF, heart failure.')
d.save(OUT / 'Table2.docx')

# ---------------- Table 3: disagreements
on_c = c[c.reflex == 'on'].set_index('comp_id')
v2 = pd.read_csv(R / 'v2_baseline.csv')
dk = v2[v2.ref_source.astype(str).str.startswith('donker2019simulation')].set_index('variable')
g = lambda i, k: on_c.loc[i, k]
rows = [
    ['Stroke work with rising ECMO flow', 'Ostadal (C); Hála (I)', f"+{g('OS-stroke work','bench_pct'):.0f}%; +{g('HA-stroke work','bench_pct'):.0f}%",
     f"{g('OS-stroke work','model_pct'):.0f}%; {g('HA-stroke work','model_pct'):.0f}%", 'Simulated ventricle is very weak (Ees 0.62, Ea/Ees ≈ 4, EF 16%); in this model stroke work rises only at higher contractility'],
    ['LV stroke volume, ECMO 0.3→5 L/min', 'Hála (I)', f"+{g('HA-LV SV (EDV-ESV)','bench_pct'):.0f}% (non-monotone)", f"{g('HA-LV SV (EDV-ESV)','model_pct'):.0f}%", 'Same phenotype; the model LV cannot hold SV against added afterload'],
    ['Mean PA pressure at ECMO onset', 'Nix (I)', f"{g('NX-ECMO-mPAP','bench_pct'):.0f}%", f"+{g('NX-ECMO-mPAP','model_pct'):.0f}%", 'Model mPAP follows the rise in LA pressure; Donker\'s model also shows a rise'],
    ['LV peak pressure on Impella', 'Møller-Helgestad (I)', f"+{g('MH-IMP-LV peak pressure','bench_pct'):.0f}%", f"{g('MH-IMP-LV peak pressure','model_pct'):.0f}%", 'All animals received norepinephrine; the model has no vasopressor'],
    ['LV EDV at ECMO onset', 'Nix (I)', 'Slightly reduced (qualitative)', f"+{g('NX-ECMO-EDV','model_pct'):.0f}%", 'Independent sources disagree: Hála and Møller-Helgestad report EDV increases (concordant with model)'],
    ['MAP with IABP on ECMO', 'Donker (C)', '0 (MAP held at 65 mmHg)', f"+{g('DK-IABP-MAP','model_delta'):.1f} mmHg", 'Protocol difference: Donker adjusted SVR to hold MAP; CardioFlow does not'],
    ['Shock baseline vs source model', 'Donker (C)', f"EDV {dk.loc['LVEDV','ref_low']:.0f} mL; PCWP {dk.loc['PCWP_equiv_meanLAP','ref_low']:.0f} mmHg",
     f"EDV {dk.loc['LVEDV','model_value']:.0f} mL (+{100*(dk.loc['LVEDV','model_value']/dk.loc['LVEDV','ref_low']-1):.0f}%); mean LAP {dk.loc['PCWP_equiv_meanLAP','model_value']:.0f} mmHg",
     'Different parameterization of the same phenotype; mean LAP is CardioFlow\'s PCWP surrogate'],
    ['Impella vs IABP ranking at P5 on ECMO 4', 'Donker (C)', 'Impella 2.5 L/min unloads more (ΔPCWP −2 vs −1 mmHg)',
     f"P5 (2.2 L/min) {g('DK-RANK-PCWP-P5','model_to'):.2f} vs IABP {g('DK-RANK-PCWP-P5','model_from'):.2f} mmHg", 'Dose-dependent crossover (Figure 4): concordant from P6 (2.6 L/min) upward'],
]
d = new_doc(landscape=True)
caption(d, 'Table 3. Disagreements between the model and benchmarks')
table(d, ['Outcome', 'Source (class)', 'Benchmark', 'Model (reflex on)', 'Likely explanation'], rows, widths=[1.8, 1.4, 1.9, 1.9, 2.4])
foot(d, 'All discordant directional comparisons (Table 2) are listed, plus the baseline difference from the source model. C, consistency source; I, independent source. '
        'EDV, end-diastolic volume; LA, left atrial; LAP, left atrial pressure; MAP, mean arterial pressure; PA, pulmonary artery; PCWP, pulmonary capillary wedge pressure; SV, stroke volume.')
d.save(OUT / 'Table3.docx')
print('tables written')
