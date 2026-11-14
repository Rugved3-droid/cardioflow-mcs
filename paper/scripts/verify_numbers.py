"""Audit: recompute every quantitative claim in paper/manuscript/manuscript.md from paper/results/ and check that the
formatted value appears in the text. Writes paper/results/number_audit.csv; exits non-zero on any mismatch.
Run: python -I paper/scripts/verify_numbers.py"""
import json, pathlib, sys
sys.stdout.reconfigure(encoding="utf-8")
import pandas as pd

P = pathlib.Path(__file__).resolve().parent.parent
R = P / 'results'
ms = (P / 'manuscript' / 'manuscript.md').read_text(encoding='utf8')
rd = lambda f: pd.read_csv(R / f)
p0 = rd('p0_equivalence.csv'); cv = rd('v1_convergence_summary.csv'); lc = rd('v1_limitcycle.csv'); co = rd('v1_conservation.csv')
v5 = rd('v5_twin.csv'); fl = rd('v4_direction_flips.csv'); to = rd('v4_tornado.csv'); runs = rd('v3_runs.csv').set_index('id')
m2 = rd('m2_impella_vs_iabp.csv'); on = m2[m2.reflex == 'on'].set_index('arm'); off = m2[m2.reflex == 'off'].set_index('arm')
bv = rd('m2_iabp_balloon_volume.csv').set_index(['arm', 'reflex'])
m3 = rd('m3_reflex_on_off.csv').set_index(['contrast', 'metric'])
c = rd('v3_concordance.csv'); con = c[c.reflex == 'on'].set_index('comp_id')
sm = json.load(open(R / 'v3_concordance_summary.json'))
arms = rd('v3_arms.csv').set_index(['reflex', 'arm'])
v2 = rd('v2_baseline.csv')
base = on.loc['none']; e4 = on.loc['ECMO4']
sup = lc[lc.scenario != 'S0_shock']
dk = v2[v2.ref_source.astype(str).str.startswith('donker2019simulation')].set_index('variable')

checks = [
    ('P0 Node vs Chrome max rel err', 'p0_equivalence.csv', p0[p0.test.str.startswith('A')].max_rel_err.max(), lambda x: f'{x / 1e-14:.1f} × 10⁻¹⁴'),
    ('V1 max rel change on halving h (shipped)', 'v1_convergence_summary.csv', cv.shipped_max_relchg_on_halving.max(), lambda x: f'{x / 1e-6:.1f} × 10⁻⁶'),
    ('V1 beats to steady after command (min)', 'v1_limitcycle.csv', sup.beats_after_command_to_steady.min(), lambda x: f'{x:.0f}–'),
    ('V1 beats to steady after command (max)', 'v1_limitcycle.csv', sup.beats_after_command_to_steady.max(), lambda x: f'–{x:.0f} beats'),
    ('V1 max volume drift (mL)', 'v1_conservation.csv', co.max_abs_deviation_mL.max(), lambda x: f'{x / 1e-9:.1f} × 10⁻⁹ mL'),
    ('V1 ticks', 'v1_conservation.csv', co.ticks.max(), lambda x: f'{x:,.0f} ticks'),
    ('V5 tests passing', 'v5_twin.csv', int(v5.bit_identical.astype(str).str.lower().eq('true').sum()), lambda x: f'all {x} paired tests'),
    ('V5 beats', 'v5_twin.csv', v5.beats.max(), lambda x: f'{x:,.0f} beats'),
    ('Baseline MAP', 'v2_baseline.csv', base['map'], lambda x: f'{x:.1f} mmHg'),
    ('Baseline native CO', 'v3_runs.csv', runs.loc['ECMO_0.0', 'nativeCoLpm'], lambda x: f'{x:.2f} L/min'),
    ('Baseline SV', 'v3_runs.csv', runs.loc['ECMO_0.0', 'nativeSv'], lambda x: f'stroke volume {x:.1f} mL'),
    ('Baseline LVEDP', 'v3_runs.csv', runs.loc['ECMO_0.0', 'lvedp'], lambda x: f'LVEDP {x:.1f} mmHg'),
    ('Baseline EDV', 'v3_runs.csv', runs.loc['ECMO_0.0', 'lvedv'], lambda x: f'EDV {x:.0f} mL'),
    ('Baseline EF_native', 'v3_runs.csv', runs.loc['ECMO_0.0', 'efNative'], lambda x: f'ejection fraction {x:.1f}%'),
    ('Baseline mean LAP', 'v3_runs.csv', runs.loc['ECMO_0.0', 'lapMean'], lambda x: f'mean LAP {x:.1f} mmHg'),
    ('Baseline EDV vs Donker (%)', 'v2_baseline.csv', 100 * (dk.loc['LVEDV', 'model_value'] / dk.loc['LVEDV', 'ref_low'] - 1), lambda x: f'{x:.0f}% larger'),
    ('Baseline within 5% of Donker (max |%| of MAP, CO, SV, HR)', 'v2_baseline.csv',
     max(abs(100 * (dk.loc[k, 'model_value'] / dk.loc[k, 'ref_low'] - 1)) for k in ['MAP', 'CO', 'SV', 'HR']), lambda x: 'within 5%' if x < 5 else 'FAIL'),
    ('ECMO 4 ΔMAP', 'm2_impella_vs_iabp.csv', e4['map'] - base['map'], lambda x: f'MAP by {x:.1f} mmHg'),
    ('ECMO 4 ΔLVEDP', 'm2_impella_vs_iabp.csv', e4.lvedp - base.lvedp, lambda x: f'LVEDP by {x:.1f} mmHg'),
    ('ECMO 4 ΔEDV %', 'm2_impella_vs_iabp.csv', 100 * (e4.lvedv / base.lvedv - 1), lambda x: f'EDV by {x:.0f}%'),
    ('ECMO 4 Δnative SV %', 'm2_impella_vs_iabp.csv', -100 * (e4.nativeSv / base.nativeSv - 1), lambda x: f'native stroke volume by {x:.0f}%'),
    ('AV open at ECMO 4', 'v3_runs.csv', 100 * runs.loc['ECMO_4.0', 'avOpenFractionRaw'], lambda x: f'{x:.0f}% of the cycle at 4 L/min'),
    ('AV open at ECMO 7', 'v3_runs.csv', 100 * runs.loc['ECMO_7.0', 'avOpenFractionRaw'], lambda x: f'{x:.0f}% at 7 L/min'),
    ('Impella P8 alone ΔLVEDP', 'm2_impella_vs_iabp.csv', base.lvedp - on.loc['P8'].lvedp, lambda x: f'lowered LVEDP by {x:.1f} mmHg and abolished'),
    ('IABP alone ΔLVEDP', 'm2_impella_vs_iabp.csv', base.lvedp - on.loc['IABP'].lvedp, lambda x: f'IABP lowered LVEDP by {x:.1f} mmHg'),
    ('Impella flow P2 on ECMO 4', 'm2_impella_vs_iabp.csv', on.loc['ECMO4+P2'].impella_Lpm, lambda x: f'{x:.2f} L/min at P2'),
    ('Impella flow P8 on ECMO 4', 'm2_impella_vs_iabp.csv', on.loc['ECMO4+P8'].impella_Lpm, lambda x: f'{x:.2f} L/min at P8'),
    ('Impella flow P5', 'm2_impella_vs_iabp.csv', on.loc['ECMO4+P5'].impella_Lpm, lambda x: f'P5 ({x:.1f} L/min)'),
    ('ΔLAP P5', 'm2_impella_vs_iabp.csv', -on.loc['ECMO4+P5'].d_lap, lambda x: f'mean LAP by {x:.1f} mmHg and the IABP'),
    ('ΔLAP IABP', 'm2_impella_vs_iabp.csv', -on.loc['ECMO4+IABP'].d_lap, lambda x: f'IABP by {x:.1f} mmHg'),
    ('Impella flow P6', 'm2_impella_vs_iabp.csv', on.loc['ECMO4+P6'].impella_Lpm, lambda x: f'P6 ({x:.1f} L/min)'),
    ('ΔLAP P8', 'm2_impella_vs_iabp.csv', on.loc['ECMO4+P8'].d_lap, lambda x: f'{x:.1f} mmHg at P8'.replace('-', '−')),
    ('IABP Δnative SV %', 'm2_impella_vs_iabp.csv', on.loc['ECMO4+IABP'].d_nativeSv_pct, lambda x: f'native stroke volume by {x:.0f}%'),
    ('Native SV zero from P7', 'm2_impella_vs_iabp.csv', on.loc['ECMO4+P7'].nativeSv + on.loc['ECMO4+P6'].nativeSv * 0, lambda x: 'to zero from P7' if x == 0 and on.loc['ECMO4+P6'].nativeSv > 0 else 'FAIL'),
    ('30 mL balloon, reflex off, ΔLAP', 'm2_iabp_balloon_volume.csv', -bv.loc[('ECMO4+IABP_30mL', 'off'), 'd_lap'], lambda x: f'lowered mean LAP by {x:.1f} mmHg (source'),
    ('EF_native ECMO4+P8', 'v3_runs.csv', runs.loc['ECMO_4.0+P8', 'efNative'], lambda x: f'native ejection fraction was {x:.0f}%'),
    ('LV emptying ECMO4+P8', 'v3_runs.csv', runs.loc['ECMO_4.0+P8', 'efEmptying'], lambda x: f'fractional LV emptying was {x:.1f}%'),
    ('Consistency concordance', 'v3_concordance_summary.json', f"{sm['reflex_on']['consistency']['concordant']} of {sm['reflex_on']['consistency']['total']}", lambda x: x),
    ('Independent concordance', 'v3_concordance_summary.json', f"{sm['reflex_on']['independent']['concordant']} of {sm['reflex_on']['independent']['total']}", lambda x: x),
    ('Independent significant-only', 'v3_concordance_summary.json', f"{sm['reflex_on']['independent_significant_only']['concordant']} of {sm['reflex_on']['independent_significant_only']['total']}", lambda x: x),
    ('Reflex off counts identical', 'v3_concordance_summary.json',
     all(sm['reflex_on'][k] == sm['reflex_off'][k] for k in ['consistency', 'independent', 'independent_significant_only']), lambda x: 'counts were identical with the reflex off' if x else 'FAIL'),
    ('MH ECMO LVEDP model vs bench', 'v3_concordance.csv', con.loc['MH-ECMO-LVEDP', 'model_delta'], lambda x: f'LVEDP (+{x:.1f} vs +5 mmHg)'),
    ('MH ECMO EDV model %', 'v3_concordance.csv', con.loc['MH-ECMO-LVEDV', 'model_pct'], lambda x: f'EDV (+{x:.0f}% vs +10%)'),
    ('Hála ESV model %', 'v3_concordance.csv', con.loc['HA-LVESV', 'model_pct'], lambda x: f'end-systolic volume (+{x:.0f}% vs +20%)'),
    ('Hála LVEDP model vs bench %', 'v3_concordance.csv', con.loc['HA-LVEDP', 'model_pct'], lambda x: f'(+{x:.0f}% vs +114%'),
    ('Discordant count', 'v3_concordance.csv', int((con.concordant == 'N').sum()), lambda x: {8: 'Eight comparisons were discordant'}.get(x, 'FAIL')),
    ('Hála SV model %', 'v3_concordance.csv', -con.loc['HA-LV SV (EDV-ESV)', 'model_pct'], lambda x: f'stroke volume fell by {x:.0f}%'),
    ('V4 directions', 'v4_direction_flips.csv', len(fl), lambda x: f'None of {x} device-effect directions'),
    ('V4 sign flips', 'v4_direction_flips.csv', int(fl.n_sign_flips.sum()), lambda x: 'None of' if x == 0 else 'FAIL'),
    ('V4 perturbed cases', 'v4_direction_flips.csv', int(fl.n_cases.max()), lambda x: f'{x} perturbed configurations'),
    ('Reflex sign flips', 'm3_reflex_on_off.csv', int((m3.same_sign == 'N').sum()), lambda x: f'({x} of {len(m3)})'),
    ('Reflex off ECMO4 ΔMAP', 'm3_reflex_on_off.csv', m3.loc[('VA-ECMO 4 vs none', 'map'), 'delta_reflex_off'], lambda x: f'MAP +{x:.1f} vs'),
    ('Reflex on ECMO4 ΔMAP', 'm3_reflex_on_off.csv', m3.loc[('VA-ECMO 4 vs none', 'map'), 'delta_reflex_on'], lambda x: f'vs +{x:.1f} mmHg'),
    ('Reflex off ECMO4 ΔLVEDP', 'm3_reflex_on_off.csv', m3.loc[('VA-ECMO 4 vs none', 'lvedp'), 'delta_reflex_off'], lambda x: f'+{x:.1f} vs +6.5'),
    ('Max Impella flow on ECMO (P9)', 'm2_impella_vs_iabp.csv', on.loc['ECMO4+P9'].impella_Lpm, lambda x: f'cannot exceed {x:.1f} L/min'),
]
tor = to[(to.outcome == 'dLVEDP_ECMO4') & (to.pert == 'lvEes')]
if len(tor):
    r = tor.iloc[0]
    lo, hi = sorted([r.at_0p8, r.at_1p2])
    checks.append(('V4 ECMO ΔLVEDP range under Ees ±20%', 'v4_tornado.csv', (lo, hi), lambda x: f'+{x[0]:.1f} to +{x[1]:.1f} mmHg'))

rows, bad = [], 0
for label, src, val, fmt in checks:
    s = fmt(val); ok = s in ms and 'FAIL' not in s
    bad += not ok
    rows.append({'claim': label, 'source_file': f'results/{src}', 'value': val if not isinstance(val, float) else f'{val:.6g}', 'text_expected': s, 'found_in_manuscript': ok})
pd.DataFrame(rows).to_csv(R / 'number_audit.csv', index=False)
for r in rows:
    if not r['found_in_manuscript']: print('MISMATCH', r)
print(f'{len(rows) - bad}/{len(rows)} claims verified')
sys.exit(1 if bad else 0)
