"""Draft Phase 1 figures for the verification report (not submission-formatted).

Reads only paper/results/*.csv written by the TS scripts. Writes paper/results/figs/*.png.
Run: python paper/scripts/fig_phase1.py
"""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

R = Path(__file__).resolve().parent.parent / "results"
F = R / "figs"
F.mkdir(exist_ok=True)
plt.rcParams.update({"font.family": "sans-serif", "font.size": 10, "axes.spines.top": False, "axes.spines.right": False})
MARK = ["o", "s", "^", "D", "v", "P", "X", "*", "h"]


def convergence():
    p = R / "v1_convergence.csv"
    if not p.exists():
        return
    d = pd.read_csv(p)
    outs = ["map", "totalFlowLpm", "lvedp", "lvedv", "lvesv", "nativeSv"]
    fig, axs = plt.subplots(2, 3, figsize=(11, 6), sharex=True)
    for ax, o in zip(axs.flat, outs):
        for i, (s, g) in enumerate(d.groupby("scenario", sort=False)):
            g = g.dropna(subset=[f"{o}_relchg_on_halving"])
            y = g[f"{o}_relchg_on_halving"].clip(lower=1e-12) * 100
            ax.loglog(g["h_ms"], y, marker=MARK[i % len(MARK)], color="k", lw=0.8, ms=4, mfc="white", label=s)
        ax.axhline(0.5, color="k", ls="--", lw=0.8)
        ax.axvline(0.25, color="0.5", ls=":", lw=0.8)
        ax.set_title(o)
        ax.set_xlabel("h (ms)")
        ax.set_ylabel("% change on halving h")
    axs.flat[0].legend(fontsize=7, frameon=False)
    fig.tight_layout()
    fig.savefig(F / "v1_convergence.png", dpi=150)


def sweep():
    p = R / "v3_runs.csv"
    if not p.exists():
        return
    d = pd.read_csv(p)
    s = d[d.family == "ecmo_sweep"].sort_values("ecmo_cmd_lpm")
    outs = [("map", "MAP (mmHg)"), ("totalFlowLpm", "Total flow (L/min)"), ("nativeSv", "Native SV (mL)"),
            ("lvedp", "LVEDP (mmHg)"), ("lvedv", "LVEDV (mL)"), ("lvesv", "LVESV (mL)"),
            ("avOpenFractionRaw", "AV open fraction"), ("lapMean", "Mean LAP (mmHg)"), ("pva", "PVA (mmHg·mL)")]
    fig, axs = plt.subplots(3, 3, figsize=(11, 9), sharex=True)
    for ax, (o, lab) in zip(axs.flat, outs):
        ax.plot(s.ecmo_cmd_lpm, s[o], "k-o", ms=4, mfc="white")
        lim = s[s.ecmoDrainageLimited == 1]
        if len(lim):
            ax.plot(lim.ecmo_cmd_lpm, lim[o], "kx", ms=8, label="drainage-limited")
            ax.legend(fontsize=7, frameon=False)
        ax.set_ylabel(lab)
        ax.set_xlabel("VA-ECMO command (L/min)")
    fig.suptitle("V3 VA-ECMO flow sweep (benchmark points: pending PDFs)")
    fig.tight_layout()
    fig.savefig(F / "v3_ecmo_sweep.png", dpi=150)


def pvloops():
    p = R / "v3_pv_loops.csv"
    if not p.exists():
        return
    d = pd.read_csv(p)
    groups = [
        ("VA-ECMO flow", ["ECMO_0.0", "ECMO_2.0", "ECMO_4.0", "ECMO_6.0"]),
        ("Unloading on VA-ECMO 4", ["ECMO_0.0", "ECMO_4.0", "ECMO_4.0+IABP", "ECMO_4.0+P5", "ECMO_4.0+P8"]),
        ("Stand-alone devices", ["ECMO_0.0", "IABP_1to1", "Impella_P8"]),
    ]
    styles = ["-", "--", "-.", ":", (0, (5, 1, 1, 1))]
    fig, axs = plt.subplots(1, 3, figsize=(13, 4.2), sharey=True)
    for ax, (title, ids) in zip(axs, groups):
        for i, sid in enumerate(ids):
            g = d[d.id == sid]
            lab = "No support" if sid == "ECMO_0.0" else sid.replace("_", " ")
            ax.plot(g.vLv, g.pLv, color="k", ls=styles[i % len(styles)], lw=1.2 if i else 2, label=lab)
        ax.set_title(title)
        ax.set_xlabel("LV volume (mL)")
        ax.legend(fontsize=7, frameon=False)
    axs[0].set_ylabel("LV pressure (mmHg)")
    fig.tight_layout()
    fig.savefig(F / "v3_pv_loops.png", dpi=150)


def tornado():
    p = R / "v4_tornado.csv"
    if not p.exists():
        return
    d = pd.read_csv(p)
    outs = list(dict.fromkeys(d.outcome))
    fig, axs = plt.subplots(2, 4, figsize=(16, 8))
    for ax, o in zip(axs.flat, outs):
        g = d[(d.outcome == o) & (d.pert != "openLoop")].sort_values("swing")
        base = g.baseline.iloc[0]
        y = range(len(g))
        ax.barh(y, g.delta_0p8, color="white", edgecolor="k", label="−20%")
        ax.barh(y, g.delta_1p2, color="0.4", edgecolor="k", label="+20%")
        ax.set_yticks(list(y))
        ax.set_yticklabels(g.label, fontsize=7)
        ax.axvline(0, color="k", lw=0.8)
        ax.set_title(f"{o} (baseline {base:.2f})", fontsize=9)
    axs.flat[0].legend(fontsize=7, frameon=False)
    fig.tight_layout()
    fig.savefig(F / "v4_tornado.png", dpi=150)


for fn in (convergence, sweep, pvloops, tornado):
    fn()
print("figures in", F)
