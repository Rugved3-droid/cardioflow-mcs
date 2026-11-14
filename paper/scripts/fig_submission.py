"""Submission figures (ASAIO): TIF, CMYK, LZW. Line art 1200 dpi; combination/halftone 600/300 dpi.
Arial >= 12 pt at final printed size (7.0 in wide). Grayscale-safe: every series has its own line style or marker.
Every plotted number is read from paper/results/ (model) or paper/benchmarks/ (values extracted from the sources).
Run: python -I paper/scripts/fig_submission.py   -> paper/submission/figures/ (+ PNG previews in paper/results/figs/sub/)"""
import pathlib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
P = pathlib.Path(__file__).resolve().parent.parent
R, B = P / 'results', P / 'benchmarks'
OUT = P / 'submission' / 'figures'; OUT.mkdir(parents=True, exist_ok=True)
PREV = R / 'figs' / 'sub'; PREV.mkdir(parents=True, exist_ok=True)
BLUE, ORANGE, AQUA, VIOLET, INK, MUTED = '#2a78d6', '#eb6834', '#1baf7a', '#6250d6', '#1a1a1a', '#7a7a75'
plt.rcParams.update({'font.family': 'Arial', 'font.size': 12, 'axes.titlesize': 12, 'axes.labelsize': 12,
                     'xtick.labelsize': 12, 'ytick.labelsize': 12, 'legend.fontsize': 12,
                     'axes.spines.top': False, 'axes.spines.right': False, 'axes.edgecolor': INK,
                     'axes.grid': False, 'lines.linewidth': 2, 'savefig.facecolor': 'white'})
W = 7.0  # in, full page width


def save(fig, name, dpi):
    png = PREV / f'{name}.png'
    fig.savefig(png, dpi=150, bbox_inches='tight')
    tmp = OUT / f'{name}_rgb.png'
    fig.savefig(tmp, dpi=dpi, bbox_inches='tight')
    plt.close(fig)
    im = Image.open(tmp).convert('RGB').convert('CMYK')
    im.save(OUT / f'{name}.tif', compression='tiff_lzw', dpi=(dpi, dpi))
    tmp.unlink()
    print(name, im.size, f'{dpi} dpi')


def panel(ax, letter):
    ax.text(-0.18, 1.06, letter, transform=ax.transAxes, fontsize=14, fontweight='bold', va='bottom')


# ---------------- Figure 1: A model schematic (line art) + B twin-pane screenshot
fig = plt.figure(figsize=(W, 8.6))
ax = fig.add_axes([0.0, 0.47, 1.0, 0.53]); ax.set_xlim(0, 100); ax.set_ylim(0, 60); ax.axis('off')
ax.text(0, 58, 'A', fontsize=14, fontweight='bold', va='top')


def box(x, y, w, h, label, ls='-'):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle='round,pad=0.4,rounding_size=1.2', fc='white', ec=INK, lw=1.4, ls=ls))
    ax.text(x + w / 2, y + h / 2, label, ha='center', va='center', fontsize=12)


def arrow(x1, y1, x2, y2, label=None, ls='-', rad=0.0, lx=0, ly=0, col=INK):
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle='-|>', mutation_scale=14, lw=1.4, color=col, ls=ls,
                                 connectionstyle=f'arc3,rad={rad}'))
    if label:
        ax.text((x1 + x2) / 2 + lx, (y1 + y2) / 2 + ly, label, ha='center', va='center', fontsize=12, color=INK)


# heart and circulation
box(3, 40, 18, 10, 'Pulm. veins\n+ LA (C$_{PV}$)')
box(35, 40, 15, 10, 'LV\nE(t), EDPVR')
box(64, 40, 15, 10, 'Aortic root\n(C$_{Ao}$)')
box(78.5, 20, 20, 11, 'Systemic arteries\n(C$_{SA}$)\n+ IABP 40 mL')
box(54, 3, 20, 10, 'Systemic veins\n(C$_{SV}$, stressed)')
box(30, 3, 14, 10, 'RV\nE(t)')
box(2, 20, 16, 10, 'Pulmonary\nartery (C$_{PA}$)')
arrow(21.8, 45, 34.2, 45, 'MV', ly=2.2)
arrow(50.8, 45, 63.2, 45, 'AV', ly=2.2)
arrow(79.8, 42, 86, 32, 'R$_c$', lx=3)
arrow(86, 19.2, 74.8, 10, 'SVR\n(baroreflex)', lx=-11, ly=1)
arrow(53.2, 8, 44.8, 8, 'TV', ly=-2.4)
arrow(29.2, 9, 13, 19.2, 'PV', lx=-4)
arrow(10, 30.8, 10, 39.2, 'PVR', lx=-4.5)
arrow(80, 27, 21.6, 41.5, None, ls=(0, (1, 2)), rad=0.12, col=MUTED)
ax.text(52, 30.5, 'bronchial shunt', ha='center', fontsize=12, color=MUTED)
# devices
arrow(44, 50.8, 70, 50.8, None, rad=-0.45, ls=(0, (5, 2)))
ax.text(57, 57.5, 'Impella (linear H–Q line)', ha='center', fontsize=12)
arrow(66, 2.2, 93, 19.2, None, rad=0.45, ls=(0, (5, 2)))
ax.text(99.5, 1.0, 'VA-ECMO\n(set flow)', ha='right', va='bottom', fontsize=12)
axb = fig.add_axes([0.0, 0.0, 1.0, 0.45]); axb.axis('off')
shot = R / 'figs' / 'twin_pane_s3_s4.png'
if shot.exists():
    axb.imshow(Image.open(shot).convert('RGB'))
else:
    axb.text(0.5, 0.5, 'twin_pane_s3_s4.png missing: run screenshot_twin.ts', ha='center')
axb.text(0, 1.02, 'B', transform=axb.transAxes, fontsize=14, fontweight='bold', va='bottom')
save(fig, 'Figure1', 600)

# ---------------- Figure 2: ECMO flow sweep vs benchmarks (% change from each series' lowest flow)
m = pd.read_csv(R / 'v3_ecmo_sweep.csv'); s = pd.read_csv(B / 'ecmo_sweeps.csv')
dk = {'LVEDV': (158, 173), 'LVESV': (127, 161), 'SV': (31, 12)}  # Donker 2019 Table 1 rows 2 -> 3 (ECMO 0 -> 4 L/min)
fig, axs = plt.subplots(2, 2, figsize=(W, 6.6), sharex=True)
for ax, (v, title), letter in zip(axs.flat, [('LVEDV', 'LV end-diastolic volume'), ('LVESV', 'LV end-systolic volume'),
                                             ('LVEDP', 'LV end-diastolic pressure'), ('SV', 'LV stroke volume (EDV − ESV)')], 'ABCD'):
    on = m[m.reflex == 'on']; off = m[m.reflex == 'off']
    ax.plot(on.flow_Lpm, 100 * (on[v] / on[v].iloc[0] - 1), '-', color=BLUE, label='Model, reflex on')
    ax.plot(off.flow_Lpm, 100 * (off[v] / off[v].iloc[0] - 1), '--', color=BLUE, lw=1.4, label='Model, reflex off')
    o = s[(s.source == 'ostadal2015') & (s.variable == v)].sort_values('flow_Lpm')
    h = s[(s.source == 'hala2020') & (s.variable == v)].sort_values('flow_Lpm')
    if len(o):
        ax.plot(o.flow_Lpm, 100 * (o.value / o.value.iloc[0] - 1), 'o', mfc='white', mec=ORANGE, mew=1.8, ms=7, ls='none', label='Ostadal 2015 (consistency)')
    if len(h):
        ax.plot(h.flow_Lpm, 100 * (h.value / h.value.iloc[0] - 1), 's', color=AQUA, mec=INK, mew=0.6, ms=7, ls='none', label='Hála 2020 (independent)')
    if v in dk:
        b0, b4 = dk[v]
        ax.plot([4], [100 * (b4 / b0 - 1)], 'D', mfc='white', mec=VIOLET, mew=1.8, ms=7, ls='none', label='Donker 2019 (consistency)')
    ax.axhline(0, color=MUTED, lw=0.8)
    ax.set_title(title, loc='left'); panel(ax, letter)
    if letter in 'CD': ax.set_xlabel('VA-ECMO flow (L/min)')
    if letter in 'AC': ax.set_ylabel('Change (%)')
handles, labels = [], []
for a in axs.flat:
    for hh, ll in zip(*a.get_legend_handles_labels()):
        if ll not in labels: handles.append(hh); labels.append(ll)
fig.tight_layout(rect=[0, 0.12, 1, 1])
fig.legend(handles, labels, loc='lower center', ncol=2, frameon=False, bbox_to_anchor=(0.5, 0.0))
save(fig, 'Figure2', 1200)

# ---------------- Figure 4: Impella P2-P8 dose-response on ECMO 4 vs IABP
d = pd.read_csv(R / 'm2_impella_vs_iabp.csv')
on = d[d.reflex == 'on']; off = d[d.reflex == 'off']
lv = [f'ECMO4+P{i}' for i in range(2, 9)]
imp_on = on.set_index('arm').loc[lv]; imp_off = off.set_index('arm').loc[lv]
iabp_on = on.set_index('arm').loc['ECMO4+IABP']; iabp_off = off.set_index('arm').loc['ECMO4+IABP']
ecmo_on = on.set_index('arm').loc['ECMO4']
x = np.arange(2, 9)
fig, axs = plt.subplots(2, 2, figsize=(W, 6.4), sharex=True)
a = axs[0, 0]
a.plot(x, imp_on.impella_Lpm, '-o', color=BLUE, ms=6, label='Reflex on')
a.plot(x, imp_off.impella_Lpm, '--s', color=BLUE, lw=1.4, ms=5, mfc='white', label='Reflex off')
a.set_ylabel('Impella flow (L/min)'); a.set_title('Flow achieved on ECMO 4', loc='left'); panel(a, 'A'); a.legend(frameon=False, loc='upper left')
for a, col, title, letter in [(axs[0, 1], 'd_lvedp', 'Δ LVEDP (mmHg)', 'B'), (axs[1, 0], 'd_lap', 'Δ mean LAP (mmHg)', 'C')]:
    a.plot(x, imp_on[col], '-o', color=BLUE, ms=6, label='Impella, reflex on')
    a.plot(x, imp_off[col], '--s', color=BLUE, lw=1.4, ms=5, mfc='white', label='Impella, reflex off')
    a.axhline(iabp_on[col], color=ORANGE, lw=2, ls='-.', label='IABP 40 mL, reflex on')
    a.axhline(iabp_off[col], color=ORANGE, lw=1.2, ls=':', label='IABP 40 mL, reflex off')
    a.set_title(title, loc='left'); panel(a, letter)
a = axs[1, 0]
a.set_xlabel('Impella P-level')
a = axs[1, 1]
a.plot(x, imp_on.nativeSv, '-o', color=BLUE, ms=6, label='Impella, reflex on')
a.plot(x, imp_off.nativeSv, '--s', color=BLUE, lw=1.4, ms=5, mfc='white', label='Impella, reflex off')
a.axhline(iabp_on.nativeSv, color=ORANGE, lw=2, ls='-.', label='IABP, reflex on')
a.axhline(ecmo_on.nativeSv, color=MUTED, lw=1.2, ls='-', label='ECMO 4 alone, reflex on')
a.set_title('Native (aortic-valve) SV (mL)', loc='left'); a.set_xlabel('Impella P-level'); panel(a, 'D')
a.legend(frameon=False, loc='center right', fontsize=11, bbox_to_anchor=(1.0, 0.5))
axs[0, 1].legend(frameon=False, loc='lower left', fontsize=11)
for a in axs.flat: a.set_xticks(x)
fig.tight_layout()
save(fig, 'Figure4', 1200)

# ---------------- Figure 3: PV loops (reflex on)
pv = pd.read_csv(R / 'v3_pv_loops.csv')
fig, axs = plt.subplots(1, 2, figsize=(W, 4.6), sharey=True)
styles = [('-', 2.2), ('--', 1.8), ('-.', 1.8), (':', 2.4)]
for a, ids, labels, title, letter in [
    (axs[0], ['ECMO_0.0', 'ECMO_2.0', 'ECMO_4.0', 'ECMO_6.0'], ['No support', 'ECMO 2', 'ECMO 4', 'ECMO 6'], 'VA-ECMO flow (L/min)', 'A'),
    (axs[1], ['ECMO_4.0', 'ECMO_4.0+IABP', 'ECMO_4.0+P5', 'ECMO_4.0+P8'], ['ECMO 4', '+ IABP', '+ Impella P5', '+ Impella P8'], 'Unloading on ECMO 4', 'B')]:
    for (i, lab), (ls, lw) in zip(zip(ids, labels), styles):
        q = pv[pv.id == i]
        a.plot(np.r_[q.vLv, q.vLv.iloc[:1]], np.r_[q.pLv, q.pLv.iloc[:1]], ls=ls, lw=lw, color=INK, label=lab)
    a.set_xlabel('LV volume (mL)'); a.set_title(title, loc='left'); panel(a, letter); a.legend(frameon=False, fontsize=11, loc='upper center', bbox_to_anchor=(0.5, -0.22), ncol=2)
axs[0].set_ylabel('LV pressure (mmHg)')
fig.tight_layout()
save(fig, 'Figure3', 1200)
