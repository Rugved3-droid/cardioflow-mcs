"""V3 figures with benchmark overlays (draft PNGs, results/figs/). Run: python -I paper/scripts/fig_v3_benchmarks.py
Every plotted number is read from results/ (model) or benchmarks/ (extracted source values)."""
import pathlib
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

P = pathlib.Path(__file__).resolve().parent.parent
R, B, F = P / 'results', P / 'benchmarks', P / 'results' / 'figs'
F.mkdir(parents=True, exist_ok=True)
BLUE, ORANGE, AQUA, VIOLET, INK, MUTED = '#2a78d6', '#eb6834', '#1baf7a', '#6250d6', '#222222', '#8a8a85'
plt.rcParams.update({'font.size': 9, 'axes.spines.top': False, 'axes.spines.right': False, 'axes.edgecolor': MUTED,
                     'axes.grid': True, 'grid.color': '#e6e6e3', 'grid.linewidth': 0.6, 'lines.linewidth': 2})

# --- Fig V3a: ECMO flow sweep, % change from each series' lowest flow
m = pd.read_csv(R / 'v3_ecmo_sweep.csv'); s = pd.read_csv(B / 'ecmo_sweeps.csv')
panels = [('LVEDV', 'LVEDV'), ('LVESV', 'LVESV'), ('LVEDP', 'LVEDP'), ('SV', 'SV (EDV-ESV)')]
fig, axs = plt.subplots(1, 4, figsize=(10, 2.9), sharex=True)
for ax, (v, title) in zip(axs, panels):
    for reflex, col, ls, lab in [('on', BLUE, '-', 'CardioFlow, reflex on'), ('off', VIOLET, '--', 'CardioFlow, reflex off')]:
        d = m[(m.reflex == reflex) & (m.flow_Lpm >= 0.3)]
        ax.plot(d.flow_Lpm, 100 * (d[v] / d[v].iloc[0] - 1), ls, color=col, label=lab)
    for src, col, mk, lab in [('ostadal2015', ORANGE, 'o', 'Ostadal 2015 (consistency)'), ('hala2020', AQUA, 's', 'Hála 2020 (independent)')]:
        d = s[(s.source == src) & (s.variable == v)].sort_values('flow_Lpm')
        if len(d):
            ax.plot(d.flow_Lpm, 100 * (d.value / d.value.iloc[0] - 1), mk, color=col, ms=6, mec='white', mew=1, label=lab, linestyle='none')
    ax.axhline(0, color=MUTED, lw=0.8); ax.set_title(title, color=INK); ax.set_xlabel('VA-ECMO flow (L/min)')
axs[0].set_ylabel('% change from lowest flow')
axs[0].legend(frameon=False, fontsize=7, loc='upper left')
fig.tight_layout(); fig.savefig(F / 'v3a_ecmo_sweep_benchmarks.png', dpi=200); plt.close(fig)

# --- Fig V3b: LV unloading on ECMO 4: Impella flow vs PCWP change, IABP as reference lines, Donker points
d = pd.read_csv(R / 'm2_impella_vs_iabp.csv')
fig, ax = plt.subplots(figsize=(4.6, 3.3))
for reflex, col, ls in [('on', BLUE, '-'), ('off', VIOLET, '--')]:
    imp = d[(d.reflex == reflex) & d.arm.str.startswith('ECMO4+P')]
    ax.plot(imp.impella_Lpm, imp.d_lap, ls, marker='o', ms=4, color=col, label=f'Impella P1–P9, reflex {reflex}')
    for _, r in imp.iterrows():
        if r.arm in ('ECMO4+P5', 'ECMO4+P8') and reflex == 'on':
            ax.annotate(r.arm.split('+')[1], (r.impella_Lpm, r.d_lap), textcoords='offset points', xytext=(4, 4), fontsize=7, color=INK)
    iabp = d[(d.reflex == reflex) & (d.arm == 'ECMO4+IABP')].d_lap.iloc[0]
    ax.axhline(iabp, color=col, ls=':', lw=1.2)
    ax.text(0.1, iabp + 0.3, f'IABP 40 mL, reflex {reflex}', fontsize=7, color=INK)
ax.plot([2.5, 5.0], [-2, -9], 'D', color=ORANGE, ms=6, mec='white', label='Donker 2019 Impella (consistency)')
ax.plot([0.0], [-1], 'D', color=ORANGE, ms=6, mfc='white', label='Donker 2019 IABP (plotted at 0)')
ax.set_xlabel('Impella flow achieved (L/min)'); ax.set_ylabel('Δ mean LAP / PCWP vs ECMO 4 (mmHg)')
ax.legend(frameon=False, fontsize=6.5, loc='lower left'); fig.tight_layout(); fig.savefig(F / 'v3b_unloading_on_ecmo.png', dpi=200); plt.close(fig)

# --- Fig V3c: model % change vs benchmark % change (delta comparisons with a numeric benchmark), reflex on
c = pd.read_csv(R / 'v3_concordance.csv'); c = c[(c.reflex == 'on') & c.bench_pct.notna() & c.model_pct.notna()]
fig, ax = plt.subplots(figsize=(4.2, 4.0))
for cls, col, mk in [('consistency', ORANGE, 'o'), ('independent', AQUA, 's')]:
    e = c[c['class'] == cls]
    ax.scatter(e.bench_pct, e.model_pct, s=28, color=col, marker=mk, edgecolor='white', linewidth=0.8, label=f'{cls} (n={len(e)})', zorder=3)
    for j, (_, r) in enumerate(e[e.concordant == 'N'].iterrows()):
        ax.annotate(r.comp_id, (r.bench_pct, r.model_pct), fontsize=6, color=INK, textcoords='offset points', xytext=(4, -9 - 9 * (j % 2)),
                    arrowprops=dict(arrowstyle='-', color=MUTED, lw=0.5))
lim = [-110, 190]
ax.plot(lim, lim, color=MUTED, lw=0.8); ax.axhline(0, color=MUTED, lw=0.8); ax.axvline(0, color=MUTED, lw=0.8)
ax.set_xlim(lim); ax.set_ylim(-110, 110)
ax.set_xlabel('Benchmark % change'); ax.set_ylabel('CardioFlow % change (reflex on)')
ax.legend(frameon=False, fontsize=7, loc='upper left'); fig.tight_layout(); fig.savefig(F / 'v3c_concordance_scatter.png', dpi=200); plt.close(fig)
print('wrote', [p.name for p in sorted(F.glob('v3*.png'))])
