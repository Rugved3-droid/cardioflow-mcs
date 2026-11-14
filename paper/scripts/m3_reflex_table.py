"""Mismatch 3: device effects with the baroreflex ON (shipped) vs OFF (open loop, SVR fixed at rSvr).
Reads results/v3_arms.csv and results/m2_impella_vs_iabp.csv; writes results/m3_reflex_on_off.csv.
The reflex gain is a modelling assumption (src/model/baroreflex.ts), not a measurement."""
import pathlib, pandas as pd
R = pathlib.Path(__file__).resolve().parent.parent / 'results'
a = pd.read_csv(R / 'v3_arms.csv').set_index(['reflex', 'arm'])
rows = []
for arm, ref, label in [('E4', 'none', 'VA-ECMO 4 vs none'), ('E2', 'none', 'VA-ECMO 2 vs none'), ('E5', 'E1', 'VA-ECMO 5 vs 1'),
                        ('P8', 'none', 'Impella P8 vs none'), ('E4+IABP', 'E4', 'IABP on ECMO 4'), ('E4+P5', 'E4', 'Impella P5 on ECMO 4'),
                        ('E4+P8', 'E4', 'Impella P8 on ECMO 4')]:
    for k in ['map', 'lvedp', 'lapMean', 'lvedv', 'nativeSv', 'efNative', 'avOpen', 'strokeWork', 'pva']:
        on = a.loc[('on', arm), k] - a.loc[('on', ref), k]
        off = a.loc[('off', arm), k] - a.loc[('off', ref), k]
        rows.append({'contrast': label, 'metric': k, 'delta_reflex_on': on, 'delta_reflex_off': off,
                     'ratio_on_over_off': on / off if off else float('nan'),
                     'same_sign': 'Y' if (on > 0) == (off > 0) or (abs(on) < 1e-9 and abs(off) < 1e-9) else 'N'})
d = pd.DataFrame(rows); d.to_csv(R / 'm3_reflex_on_off.csv', index=False)
print(d[d.metric.isin(['map', 'lvedp', 'lvedv', 'nativeSv'])].round(2).to_string(index=False))
print('sign flips:', (d.same_sign == 'N').sum(), 'of', len(d))
