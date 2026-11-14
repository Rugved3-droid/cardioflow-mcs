"""Benchmark extraction record. Every number below was transcribed from a downloaded source
(paper/benchmarks/xml, pdfs, img, text) at the stated location. No other values enter V3.
Writes paper/benchmarks/<key>.csv, paper/benchmarks/device_benchmarks.csv and
paper/benchmarks/reference_ranges.csv.  Run: python -I paper/scripts/build_benchmarks.py

Columns
  comp_id, source_key, class (consistency|independent), species, mode (delta|rank_abs|rank_pct),
  benchmark_contrast (text), model_contrast (armA>armB, or armA>armB|armC>armD for rank modes),
  outcome, model_metric, bench_base, bench_int, units, bench_direction (up|down|flat),
  significant (Y|N|NA), bound_low, bound_high (optional magnitude bounds on the model change),
  location, note
Model arms (computed by v3_concordance.ts): none, E<flow> (VA-ECMO flow L/min), E4+IABP, E4+P<n>, P<n>.
Rank modes: bench_base = change in arm pair 2 (comparator), bench_int = change in arm pair 1;
direction 'down' means pair 1 lowers the outcome more than pair 2.
"""
import csv, math, pathlib

B = pathlib.Path(__file__).resolve().parent.parent / 'benchmarks'
COLS = ['comp_id', 'source_key', 'class', 'species', 'mode', 'benchmark_contrast', 'model_contrast', 'outcome', 'model_metric',
        'bench_base', 'bench_int', 'units', 'bench_direction', 'significant', 'bound_low', 'bound_high', 'location', 'note']
rows = []


def add(cid, key, cls, sp, contrast, mc, outcome, metric, base, inter, units, sig, loc, note='', mode='delta', direction=None, bl='', bh=''):
    if direction is None:
        d = inter - base
        direction = 'flat' if d == 0 else ('up' if d > 0 else 'down')
    rows.append({'comp_id': cid, 'source_key': key, 'class': cls, 'species': sp, 'mode': mode, 'benchmark_contrast': contrast,
                 'model_contrast': mc, 'outcome': outcome, 'model_metric': metric, 'bench_base': base, 'bench_int': inter,
                 'units': units, 'bench_direction': direction, 'significant': sig, 'bound_low': bl, 'bound_high': bh,
                 'location': loc, 'note': note})


# ---------- Donker 2019 simulation (consistency; human simulation). Table 1 is an image: XML T1 -> mat-65-11-g001.jpg
DK = 'donker2019simulation'
T1 = 'Table 1 (XML table-wrap T1, graphic mat-65-11-g001.jpg)'
NOTE_E4 = 'Donker model has no baroreflex (SDC Appendix); CardioFlow EDPVR and reflex were chosen to land this ECMO response (parameter_provenance.md)'
c = 'LV failure (row 2) -> +VA ECMO 4 L/min (row 3)'
for o, m, b, i, u in [('MAP', 'map', 61, 85, 'mmHg'), ('PCWP', 'lapMean', 30, 35, 'mmHg'), ('LVEDV', 'lvedv', 158, 173, 'mL'),
                      ('LVESV', 'lvesv', 127, 161, 'mL'), ('LV SV (EDV-ESV)', 'emptyingSv', 31, 12, 'mL'), ('LVEF', 'efEmptying', 20, 7, '%'),
                      ('PVA', 'pva', 5946, 8076, 'mmHg*mL'), ('RAP', 'rapMean', 11, 10, 'mmHg'), ('mPAP', 'paMean', 33, 36, 'mmHg')]:
    add(f'DK-E4-{o}', DK, 'consistency', 'human (simulation)', c, 'E4>none', o, m, b, i, u, 'NA', T1, NOTE_E4)
c = 'VA ECMO 4 + volume/afterload reduction (row 5) -> +IABP (row 7)'
for o, m, b, i, u in [('PCWP', 'lapMean', 22, 21, 'mmHg'), ('LVEDV', 'lvedv', 153, 149, 'mL'), ('LV SV (EDV-ESV)', 'emptyingSv', 18, 24, 'mL')]:
    add(f'DK-IABP-{o}', DK, 'consistency', 'human (simulation)', c, 'E4+IABP>E4', o, m, b, i, u, 'NA', T1,
        'Donker background is row 5 (blood volume -800 mL, MAP 65); CardioFlow background is ECMO 4 without those adjustments. Donker IABP = 30 mL with partial occlusion (SDC)')
add('DK-IABP-MAP', DK, 'consistency', 'human (simulation)', c, 'E4+IABP>E4', 'MAP', 'map', 65, 65, 'mmHg', 'NA', T1,
    'Donker held MAP at 65 by SVR adjustment; flat counted concordant if |model change| < 1 mmHg')
c = 'row 5 -> +Impella 2.5 L/min (row 8); CardioFlow P6 delivers 2.6 L/min under ECMO 4'
for o, m, b, i, u in [('PCWP', 'lapMean', 22, 20, 'mmHg'), ('LVEDV', 'lvedv', 153, 143, 'mL'), ('LV SV (EDV-ESV)', 'emptyingSv', 18, 13, 'mL'), ('MAP', 'map', 65, 72, 'mmHg')]:
    add(f'DK-IMP25-{o}', DK, 'consistency', 'human (simulation)', c, 'E4+P6>E4', o, m, b, i, u, 'NA', T1, 'flow-matched to the nearest P-level (m2_impella_vs_iabp.csv)')
c = 'row 5 -> +Impella 5.0 L/min (row 9); CardioFlow maximum is P9 = 3.8 L/min under ECMO 4'
for o, m, b, i, u in [('PCWP', 'lapMean', 22, 13, 'mmHg'), ('LVEDV', 'lvedv', 153, 118, 'mL'), ('MAP', 'map', 65, 89, 'mmHg')]:
    add(f'DK-IMP50-{o}', DK, 'consistency', 'human (simulation)', c, 'E4+P9>E4', o, m, b, i, u, 'NA', T1,
        'CardioFlow cannot reach 5 L/min Impella flow under ECMO 4; direction counts, magnitude not comparable')
add('DK-RANK-PCWP', DK, 'consistency', 'human (simulation)', 'PCWP fall: Impella 2.5 L/min (row 8) larger than IABP (row 7)',
    'E4+P6>E4|E4+IABP>E4', 'PCWP change, Impella 2.5 minus IABP', 'lapMean', -1, -2, 'mmHg', 'NA', T1, '', mode='rank_abs', direction='down')
add('DK-RANK-EDV', DK, 'consistency', 'human (simulation)', 'LVEDV fall: Impella 2.5 L/min (row 8) larger than IABP (row 7)',
    'E4+P6>E4|E4+IABP>E4', 'LVEDV change %, Impella 2.5 minus IABP', 'lvedv', round(100 * (149 / 153 - 1), 2), round(100 * (143 / 153 - 1), 2), '%', 'NA', T1,
    'percent changes from row 5', mode='rank_pct', direction='down')
add('DK-RANK-PCWP-P5', DK, 'consistency', 'human (simulation)', 'Same ranking at the shipped ECPELLA level P5 (2.2 L/min under ECMO 4)',
    'E4+P5>E4|E4+IABP>E4', 'PCWP change, Impella P5 minus IABP', 'lapMean', -1, -2, 'mmHg', 'NA', T1,
    'P5 delivers 2.2 L/min, below Donker 2.5 L/min; reported because P5 is the shipped S4 level (mismatch 2)', mode='rank_abs', direction='down')

# ---------- Donker 2019 review (consistency; summarises the same simulation model and clinical reports)
DR = 'donker2019review'
add('DR-IABP-PCWP', DR, 'consistency', 'human (review)', 'IABP added to VA ECMO: PCWP decrease reported "maximally 5 mmHg"', 'E4+IABP>E4',
    'PCWP', 'lapMean', '', '', 'mmHg', 'NA', 'Section on IABP, XML body text (Perfusion 2019;34:98-105)', 'magnitude bound', direction='down', bl=-5, bh=0)
add('DR-IMP-PCWP', DR, 'consistency', 'human (review)', 'Impella added to VA ECMO: PCWP reduction up to 10 mmHg as a function of flow', 'E4+P8>E4',
    'PCWP', 'lapMean', '', '', 'mmHg', 'NA', 'Section on Impella, XML body text', 'magnitude bound', direction='down', bl=-10, bh=0)
add('DR-IMP-LVV', DR, 'consistency', 'human (review)', 'Impella added to VA ECMO: LV volume reduction up to 20%', 'E4+P8>E4',
    'LVEDV', 'lvedv', '', '', '%', 'NA', 'Section on Impella, XML body text', 'magnitude bound on percent change', direction='down', bl=-20, bh=0)

# ---------- Broome 2016 (consistency; same model family, simulated clinical case)
BR = 'broome2016'
for o, m, b, i, u in [('MAP', 'map', 85, 106, 'mmHg'), ('LVEDV', 'lvedv', 84.7, 93.3, 'mL'), ('LVEDP', 'lvedp', 19, 23, 'mmHg'), ('LVEF', 'efEmptying', 27.8, 19.5, '%')]:
    add(f'BR-E2-{o}', BR, 'consistency', 'human (simulation)', 'simulated patient, ECMO 0 -> 2.1 L/min', 'E2>none', o, m, b, i, u, 'NA',
        'Table 1 (XML Tab1), "+ECMO only" simulation column', 'patient-specific simulation (HR 137); compared with CardioFlow ECMO 2 L/min')

# ---------- Ostadal 2015 (consistency; porcine acute CS; EBF 1 -> 5 L/min; mean +- SEM, n=5)
OS = 'ostadal2015'
LOC = 'Results, "Directly measured parameters" and "Calculated parameters" (XML body text), Fig. 3; Table 1 (XML Tab1)'
for o, m, b, i, u, s in [('SBP', 'sbp', 60, 97, 'mmHg', 'Y'), ('pulmonary CO', 'nativeCoLpm', 2.81, 1.86, 'L/min', 'Y'), ('LVESV', 'lvesv', 64, 83, 'mL', 'Y'),
                         ('LVEDV', 'lvedv', 112, 123, 'mL', 'N'), ('LVEDP', 'lvedp', 17.2, 19.0, 'mmHg', 'N'), ('LV SV (EDV-ESV)', 'emptyingSv', 48, 40, 'mL', 'Y'),
                         ('LVEF', 'efEmptying', 43, 32, '%', 'Y'), ('stroke work', 'strokeWork', 2096, 2884, 'mmHg*mL', 'Y')]:
    add(f'OS-{o}', OS, 'consistency', 'porcine', 'EBF 1 -> 5 L/min', 'E5>E1', o, m, b, i, u, s, LOC,
        'direction and % only (cross-species). Pulmonary CO (thermodilution) compared with model native CO. Stroke-work direction was a CardioFlow calibration anchor')

# ---------- Hala 2020 (INDEPENDENT; porcine chronic HF; EBF 0 (0.3 L/min) -> 5; mean +- SEM, n=5)
HA = 'hala2020'
for o, m, b, i, u, s in [('LV peak pressure', 'lvPeak', 49, 73, 'mmHg', 'Y'), ('LVEDP', 'lvedp', 7, 15, 'mmHg', 'Y'), ('LVESV', 'lvesv', 139, 167, 'mL', 'Y'),
                         ('LVEDV', 'lvedv', 189, 218, 'mL', 'Y'), ('LV SV (EDV-ESV)', 'emptyingSv', 51, 52, 'mL', 'N'), ('LVEF', 'efEmptying', 25, 21, '%', 'N'),
                         ('stroke work', 'strokeWork', 1434, 1892, 'mmHg*mL', 'Y'), ('CVP', 'rapMean', 14, 8, 'mmHg', 'Y')]:
    note = 'direction and % only (cross-species)'
    if o == 'LV SV (EDV-ESV)':
        note += '; overall P=0.03 but non-monotone (peak at EBF 3), net +2%'
    if o == 'LVEF':
        note += '; P=0.18'
    add(f'HA-{o}', HA, 'independent', 'porcine', 'EBF 0 (0.3 L/min) -> 5 L/min', 'E5>E0.3', o, m, b, i, u, s, 'Table 1 (XML Tab1)', note)

# ---------- Nix 2020, Frontiers (INDEPENDENT; porcine AMI; onset of support t-20 -> t5)
NX = 'frontiers2020impella'
add('NX-IMP-nCO', NX, 'independent', 'porcine', 'Impella CP onset (t-20 -> t5)', 'P8>none', 'native CO', 'nativeCoLpm', 3.9, 1.05, 'L/min', 'Y',
    'Results, "Hemodynamics" (XML body text); Fig. 3A', 'native flow = SV x HR from the PV catheter; Impella CP at "maximum achievable unloading" -> CardioFlow P8')
add('NX-IMP-EDV', NX, 'independent', 'porcine', 'Impella CP onset (t-20 -> t5)', 'P8>none', 'LVEDV', 'lvedv', 94, 31, 'mL', 'Y',
    'Results, "Hemodynamics" (XML body text); Fig. 4C', 'medians')
add('NX-IMP-MAP', NX, 'independent', 'porcine', 'Impella CP onset (t-20 -> t5)', 'P8>none', 'MAP', 'map', 68.6, 73.6, 'mmHg', 'NA', 'Table 2 (XML T2), mAOP')
add('NX-ECMO-nCO', NX, 'independent', 'porcine', 'VA-ECMO 3.5 L/min onset (t-20 -> t5)', 'E3.5>none', 'native CO', 'nativeCoLpm', 4.3, 3.2, 'L/min', 'N',
    'Results, "Hemodynamics" (XML body text)', 'mean reduction 23.5%, p > 0.999')
add('NX-ECMO-MAP', NX, 'independent', 'porcine', 'VA-ECMO 3.5 L/min onset (t-20 -> t5)', 'E3.5>none', 'MAP', 'map', 51.2, 64.4, 'mmHg', 'NA', 'Table 2 (XML T2), mAOP')
add('NX-ECMO-mPAP', NX, 'independent', 'porcine', 'VA-ECMO 3.5 L/min onset (t-20 -> t5)', 'E3.5>none', 'mPAP', 'paMean', 15.8, 11.2, 'mmHg', 'NA', 'Table 2 (XML T2)')
add('NX-ECMO-SV', NX, 'independent', 'porcine', 'VA-ECMO 3.5 L/min onset (t-20 -> t5)', 'E3.5>none', 'LV SV', 'emptyingSv', 66, 41, 'mL', 'NA', 'Table 2 (XML T2), medians')
add('NX-ECMO-EDV', NX, 'independent', 'porcine', 'VA-ECMO 3.5 L/min onset', 'E3.5>none', 'LVEDV', 'lvedv', '', '', 'mL', 'NA',
    'Results, "Hemodynamics" (XML body text): "end-diastolic volumes were slightly reduced after onset of MCS"', 'qualitative; numbers only in Fig. 4C', direction='down')
add('NX-RANK-nCO', NX, 'independent', 'porcine', 'native CO falls more with Impella than with ECMO', 'P8>none|E3.5>none', 'native CO change %, Impella minus ECMO',
    'nativeCoLpm', -23.5, -66.2, '%', 'Y', 'Results, "Hemodynamics" (XML body text); Abstract', 'mean % reductions, p = 0.021', mode='rank_pct', direction='down')

# ---------- Moller-Helgestad 2019 (INDEPENDENT; porcine microsphere CS; CS -> immediate response)
MH = 'mollerhelgestad2019'
T2 = 'Table 2 (publisher HTML, image 02tabMollerHelgestad148_fmt.png)'
for o, m, b, i, u in [('LVEDV', 'lvedv', 182, 119, 'mL'), ('LVEDP', 'lvedp', 20, 14, 'mmHg'), ('PVA', 'pva', 2792, 2456, 'mmHg*mL'), ('LV peak pressure', 'lvPeak', 37, 46, 'mmHg')]:
    add(f'MH-IMP-{o}', MH, 'independent', 'porcine', 'CS -> Impella CP P8, immediate', 'P8>none', o, m, b, i, u, 'NA', T2, 'means; within-group p not reported')
for o, m, b, i, u in [('LVEDV', 'lvedv', 157, 173, 'mL'), ('LVEDP', 'lvedp', 18, 23, 'mmHg'), ('PVA', 'pva', 2548, 7101, 'mmHg*mL'), ('LV peak pressure', 'lvPeak', 37, 102, 'mmHg')]:
    add(f'MH-ECMO-{o}', MH, 'independent', 'porcine', 'CS -> VA-ECMO 3.2 L/min, immediate', 'E3.2>none', o, m, b, i, u, 'NA', T2, 'means; within-group p not reported')
T1M = 'Table 1 (publisher HTML, image 01tabMollerHelgestad148_fmt.png)'
add('MH-IMP-MAP', MH, 'independent', 'porcine', 'CS -> Impella CP P8, 60 min', 'P8>none', 'MAP', 'map', 31, 54, 'mmHg', 'NA', T1M, 'all Impella animals on norepinephrine')
add('MH-ECMO-MAP', MH, 'independent', 'porcine', 'CS -> VA-ECMO 3.2 L/min, 60 min', 'E3.2>none', 'MAP', 'map', 34, 68, 'mmHg', 'NA', T1M)
add('MH-RANK-LVEDP', MH, 'independent', 'porcine', 'LVEDP: Impella P8 lower than VA-ECMO 3.2 (between-device p=0.004)', 'P8>none|E3.2>none',
    'LVEDP change, Impella minus ECMO', 'lvedp', 5, -6, 'mmHg', 'Y', T2, 'immediate response', mode='rank_abs', direction='down')
add('MH-RANK-PVA', MH, 'independent', 'porcine', 'PVA: Impella lower than VA-ECMO (between-device p=0.004)', 'P8>none|E3.2>none',
    'PVA change %, Impella minus ECMO', 'pva', round(100 * (7101 / 2548 - 1), 2), round(100 * (2456 / 2792 - 1), 2), '%', 'Y', T2, 'immediate response',
    mode='rank_pct', direction='down')

for r in rows:
    try:
        b, i = float(r['bench_base']), float(r['bench_int'])
        r['bench_delta'] = round(i - b, 4)
        r['bench_pct'] = round(100 * (i / b - 1), 3) if r['mode'] == 'delta' and b != 0 else ''
    except ValueError:
        r['bench_delta'] = r['bench_pct'] = ''
cols = COLS + ['bench_delta', 'bench_pct']


def write(path, rs, fields):
    with open(path, 'w', newline='', encoding='utf8') as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rs)


for key in sorted({r['source_key'] for r in rows}):
    write(B / f'{key}.csv', [r for r in rows if r['source_key'] == key], cols)
write(B / 'device_benchmarks.csv', rows, cols)

# ---------- V2 reference values (shock baseline). Human simulation = point value; porcine = mean +- SD (SD = SEM*sqrt(n)), context only.
ref = []


def R(var, lo, hi, units, src, loc, species, note=''):
    ref.append({'variable': var, 'condition': 'cardiogenic_shock', 'low': lo, 'high': hi, 'units': units, 'source': src,
                'page_or_table': loc, 'species': species, 'note': note})


for var, v, u in [('MAP', 61, 'mmHg'), ('SV', 31, 'mL'), ('LVEDV', 158, 'mL'), ('LVESV', 127, 'mL'), ('EF_native', 20, '%'), ('PCWP_equiv_meanLAP', 30, 'mmHg'),
                  ('RAP_equiv_meanSVpressure', 11, 'mmHg'), ('mPAP', 33, 'mmHg'), ('HR', 100, 'bpm')]:
    R(var, v, v, u, 'donker2019simulation', 'Table 1 row 2 (LV heart failure)', 'human (simulation)', 'point value from the source model (consistency, not validation)')
R('CO', 3.1, 3.1, 'L/min', 'donker2019simulation', 'SDC Appendix: cardiac output "decreased from 7.0 L/min to 3.1 L/min"', 'human (simulation)', 'point value')
sd = lambda sem, n=5: sem * math.sqrt(n)
for var, m, sem, u in [('SBP', 60, 7, 'mmHg'), ('CO', 2.81, 0.34, 'L/min'), ('EF_native', 43, 3, '%'), ('HR', 94, 4, 'bpm'), ('LVEDP', 17.2, 1.4, 'mmHg'),
                       ('LVEDV', 112, 19, 'mL'), ('LVESV', 64, 11, 'mL'), ('SV', 48, 9, 'mL')]:
    R(var, round(m - sd(sem), 2), round(m + sd(sem), 2), u, 'ostadal2015', 'Results (XML body text) and Fig. 3, EBF 1 L/min', 'porcine',
      'mean +- SD (SEM x sqrt 5); measured on ECMO 1 L/min; context only, no cross-species verdict')
for var, m, sem, u in [('LVEDP', 7, 2, 'mmHg'), ('LVEDV', 189, 26, 'mL'), ('LVESV', 139, 17, 'mL'), ('SV', 51, 20, 'mL'), ('EF_native', 25, 7, '%'), ('HR', 101, 22, 'bpm'),
                       ('RAP_equiv_meanSVpressure', 14, 2, 'mmHg'), ('CO', 2.9, 0.4, 'L/min')]:
    R(var, round(m - sd(sem), 2), round(m + sd(sem), 2), u, 'hala2020', 'Table 1 EBF 0 (XML Tab1); CO from Results text', 'porcine',
      'mean +- SD (SEM x sqrt 5); chronic pacing-induced HF at EBF 0.3 L/min; context only')
write(B / 'reference_ranges.csv', ref, list(ref[0]))
print(len(rows), 'benchmark rows;', len(ref), 'reference rows')

# ---------- full ECMO flow sweeps (for figure overlays only; endpoints above are what V3 scores)
sweep = []
for var, vals in [('LVESV', [64, 70, 74, 78, 83]), ('LVEDV', [112, 115, 116, 119, 123]), ('LVEDP', [17.2, 18.2, 18.6, 18.9, 19.0]),
                  ('SV', [48, 45, 42, 41, 40]), ('SBP', [60, 72, 81, 89, 97]), ('EF', [43, 39, 36, 34, 32])]:
    for f, v in zip([1, 2, 3, 4, 5], vals):
        sweep.append({'source': 'ostadal2015', 'class': 'consistency', 'flow_Lpm': f, 'variable': var, 'value': v,
                      'location': 'Results text, Fig. 3 (XML body text)'})
for var, vals in [('LVEDP', [7, 8, 10, 11, 13, 15]), ('LVESV', [139, 143, 148, 152, 164, 167]), ('LVEDV', [189, 194, 203, 209, 217, 218]),
                  ('SV', [51, 51, 56, 59, 55, 52]), ('EF', [25, 24, 26, 27, 23, 21]), ('LVPP', [49, 55, 61, 66, 74, 73])]:
    for f, v in zip([0.3, 1, 2, 3, 4, 5], vals):
        sweep.append({'source': 'hala2020', 'class': 'independent', 'flow_Lpm': f, 'variable': var, 'value': v, 'location': 'Table 1 (XML Tab1)'})
write(B / 'ecmo_sweeps.csv', sweep, list(sweep[0]))
