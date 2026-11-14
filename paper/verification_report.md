# CardioFlow Twin: Phase 0–1 verification report

Branch `paper/asaio-verification` · 2026-11-14 · model source unchanged (`src/model/` last changed in `6d74829`).
Every number below comes from a CSV in `paper/results/`, and the script that wrote it is named. No parameters were changed.

## Status at a glance

| Item | Result | Status |
|---|---|---|
| P0 Headless runner = browser engine | Node vs Chrome max rel. error **3.7×10⁻¹⁴** (criterion 1×10⁻⁶) | PASS |
| V1a Time-step convergence | shipped h = 0.25 ms; worst change on halving **1.1×10⁻⁶ relative (0.0001%)**, criterion 0.5% | PASS |
| V1b Limit cycle | steady 33–63 beats after the command; recipe residual ≤ 7×10⁻⁸ | PASS |
| V1c Volume conservation | max drift **2.0×10⁻⁹ mL** (≤ 9×10⁻¹³ relative) over 510,000 ticks | PASS |
| V2 Baseline vs reference shock values | Donker 2019 LV-failure row (human simulation, point values) + Ostadal 2015 / Hála 2020 baselines (porcine, context only) | REPORTED (see V2) |
| V3 Device benchmark | 67 comparisons from 7 downloaded sources. Reflex on: **consistency 35/38**, **independent 24/29** (significant-only 10/11). Reflex off: identical counts | 8 discordances listed |
| Mismatch 2 (IABP ≥ Impella P5 on ECMO) | Root cause found, not a code error: Impella P5 delivers only 2.2 L/min under ECMO 4; the 40 mL IABP acts on one lumped arterial compliance and the reflex amplifies it | NO FIX (faithful behavior; limitation) |
| V4 Sensitivity ±20% | **0 of 50** device-effect directions flip across 31 perturbed cases | PASS (directions) |
| V5 Twin integrity | 9 of 9 tests bit-identical over 1,000 beats | PASS |

---

## Phase 0. Inventory and headless runner

- **Model spec:** `paper/model_spec.md` covers the 7 volume states, Eqs. 1–16, the integration scheme, every parameter with file:line, the device models, and 15 missing or simplified physiology items for the Limitations section.
- **Two corrections to the prompt's description, taken from the code:**
  - The model **does** include an RV, a pulmonary circulation and a baroreflex on SVR.
  - **VA-ECMO has no pump curve.** It is an ideal flow source with a venous-drainage roll-off (`ecmo.ts:22-28`).
- **Runner (`paper/runner/`).** There is no port. It imports the same `src/model/*.ts` modules that Vite bundles into the release.
  - Where a hard-coded constant must vary (`SUBSTEPS`, the Impella/ECMO/IABP constants), `gen_variant.mjs` writes a mechanical copy that changes only `const`→`let` plus a setter.
  - `src/` was not touched.
- **Equivalence** (`p0_equivalence.ts` → `p0_equivalence.csv/.json`), on a battery of 9 scenarios (S0–S5, IABP 1:2, early inflation, ECMO+IABP) × 210 s, comparing every beat's 16 metrics plus the final volumes:
  - **A. Node 24.12 vs Chrome 157:** max relative error 3.7×10⁻¹⁴. The results are *not* bit-identical (V8 builds differ in `Math.exp`/`pow`, as the README already warns). This passes the 1×10⁻⁶ criterion by eight orders of magnitude.
  - **B. Knob variant at default knobs vs shipped model:** 0 of 50,463 values differ, so the two are bit-identical.
  - **C. Release HTML:**
    - A fresh recomputation of all 7 steady-state snapshots matches the shipped JSON bit-for-bit (484 values).
    - All 330 non-integer snapshot values are present in `release/CardioFlow-MCS.html`.
    - The release file was built (2026-09-29) after the last model commit (2026-09-24).

## V1. Numerical verification

**V1a. Convergence** (`v1_convergence.ts` → `v1_convergence.csv`, `_summary.csv`; figure `results/figs/v1_convergence.png`)
- SUBSTEPS was swept over 1, 2, 4 (shipped), 8, 16, 32, 64 for 7 scenarios. The outputs were MAP, total CO, native CO, LVEDP, LVEDV, LVESV and SV.
- At the shipped h = 0.25 ms, the worst change on halving is 1.06×10⁻⁶ (S4) and the worst deviation from h = 1/64 ms is 2.4×10⁻⁶.
- Even h = 1 ms changes outputs by < 1.6×10⁻⁵, so every tested step meets the 0.5% criterion.
- The error decreases but not cleanly at 4th order (S4 is non-monotone between h = 1 and 0.5 ms). That is expected with ideal-diode valves (non-smooth RHS, no event location). It is irrelevant at this error level.
- **Caveat for Methods:** the 1 ms clock tick itself is not refined. It sets the sampling of beat extrema (LVEDP, LVESV), the forward-Euler baroreflex lags (τ = 2 s and 8 s) and the actuator slew. These are part of the model definition, not of the ODE solve.

**V1b. Limit cycle** (`v1_limitcycle_conservation.ts` → `v1_limitcycle.csv`)
- *Pre-specified criterion:* |xₙ − xₙ₋₁| ≤ 0.1% · max(|x|, s) for MAP, total flow, SV, LVEDP, LVEDV and LVESV, sustained for 10 consecutive beats. For IABP 1:2 the lag is 2 beats.

| | Beats to steady | Time to steady |
|---|---|---|
| Cold start (unsupported) | 33 | 19.8 s |
| After the device command, including the actuator ramp | 33 (IABP) to 63 (ECMO 6) | 20–38 s |

- The shipped recipe allows 200 beats on device. Its residual against +300 s is ≤ 7.2×10⁻⁸ relative.

**V1c. Conservation** (`v1_conservation.csv`): max |V(t) − V(0)| ≤ 2.0×10⁻⁹ mL out of 2,287 mL in all 9 scenarios, including every pump and ECMO 6 L/min.

## V2. Baseline physiology (`v2_baseline.ts` → `v2_baseline.csv`)

Shock baseline (S0):

| Variable | Value |
|---|---|
| MAP | 61.9 mmHg |
| SBP / DBP | 73.3 / 52.9 mmHg |
| CO | 2.98 L/min |
| SV | 29.8 mL |
| LVEDP | 20.0 mmHg |
| LVEDV | 187.8 mL |
| LVESV | 159.2 mL |
| EF_native (native SV/EDV) | 15.9% |
| AV open fraction | 0.27 of the cycle |
| PCWP-equivalent (mean LAP) | 20.2 mmHg |
| RAP | 13.5 mmHg |
| mPAP | 25.1 mmHg |
| SVR | 15.8 WU |
| HR | 100 bpm |

**Reference values** (`benchmarks/reference_ranges.csv`, built by `scripts/build_benchmarks.py`; author instruction: no outside sources, only the shock baselines in the downloaded benchmark papers):

| Variable | Model | Donker 2019 LV failure (human simulation; model − source) | Ostadal 2015 EBF 1 (porcine, mean ± SD) | Hála 2020 EBF 0 (porcine, mean ± SD) |
|---|---|---|---|---|
| MAP (mmHg) | 61.9 | 61 (+0.9) | — | — |
| CO (L/min) | 2.98 | 3.1 (−0.1) | 2.05–3.57, inside | 2.01–3.79, inside |
| SV (mL) | 29.8 | 31 (−1.2) | 27.9–68.1, inside | 6.3–95.7, inside |
| LVEDP (mmHg) | 20.0 | — | 14.1–20.3, inside | 2.5–11.5, above |
| LVEDV (mL) | 187.8 | 158 (+29.8, +19%) | 69.5–154.5, above | 130.9–247.1, inside |
| LVESV (mL) | 159.2 | 127 (+32.2, +25%) | 39.4–88.6, above | 101.0–177.0, inside |
| EF_native (%) | 15.9 | 20 (−4.1) | 36.3–49.7, below | 9.4–40.7, inside |
| PCWP-equivalent mean LAP (mmHg) | 20.2 | 30 (−9.8, −33%) | — | — |
| RAP (mmHg) | 13.5 | 11 (+2.5) | — | 9.5–18.5, inside |
| mPAP (mmHg) | 25.1 | 33 (−7.9) | — | — |
| HR (bpm) | 100 | 100 (0) | 85–103, inside | 52–150, inside |

- **Porcine values are context only.** SD = SEM × √5 (n = 5 in both studies). Absolute values are not compared across species. Ostadal's baseline was measured on ECMO 1 L/min, not unsupported.
- **Against the source model**, CardioFlow's shock state has the same MAP, CO, SV and HR. It has a **larger LV** (EDV +19%, ESV +25%) and **lower left-sided filling pressures** (mean LAP 20 vs PCWP 30 mmHg; mPAP 25 vs 33). CardioFlow's PCWP surrogate is mean LAP.
- **Scope (author decision, 2026-11-14):** shock baseline only, with no normal-physiology calibration (Limitations item 15).

## V3. Device hemodynamics, model side (`v3_devices.ts` → `v3_runs.csv`, `v3_model_directions.csv`, `v3_pv_loops.csv`; figures `v3_ecmo_sweep.png`, `v3_pv_loops.png`)

64 runs:
- the ECMO sweep, 0–7 L/min in 0.5 L/min steps;
- ECMO 1–5 L/min × {none, IABP, Impella P2/P4/P5/P6/P8};
- Impella P1–P9 alone;
- IABP 1:1 and 1:2.

**LV venting is not implemented** in the code, so it was not run.

**ECMO sweep, 0 → 7 L/min.** Every listed output is strictly monotone:

| Outcome | 0 L/min | 7 L/min | Direction |
|---|---|---|---|
| MAP (mmHg) | 61.9 | 92.0 | ↑ |
| Total flow (L/min) | 2.98 | 8.81 | ↑ |
| Native SV (mL) | 29.8 | 18.1 | ↓ |
| LVEDP (mmHg) | 20.0 | 30.5 | ↑ |
| LVEDV (mL) | 188 | 222 | ↑ |
| LVESV (mL) | 159 | 205 | ↑ |
| AV open fraction | 0.27 | 0.20 | ↓ |
| Mean LAP (mmHg) | 20.2 | 30.6 | ↑ |
| PVA | — | — | ↑ |
| SVR (WU) | 15.8 | 9.1 | ↓ |

Stroke work is non-monotone.

**Matched-flow comparisons:**

| Comparison | MAP | Total flow | Native SV | LVEDP | LVEDV | AV open | PVA |
|---|---|---|---|---|---|---|---|
| ECMO 4 vs none | +31% | +110% | −24% | +32% (+6.5 mmHg) | +12% | −17% | +35% |
| ECMO 4 + IABP vs ECMO 4 | +3.5% | +8% | +22% | −16% (−4.1) | −7% | +16% | −17% |
| ECMO 4 + P5 vs ECMO 4 (S4 vs S3) | +2.7% | +6% | −79% | −14% (−3.7) | −6% | −48% | −12% |
| ECMO 4 + P8 vs ECMO 4 | +7.8% | +18% | −100% | −39% (−10.2) | −18% | −100% | −38% |
| Impella P8 vs none | +11% | +26% | −100% | −35% (−7.0) | −17% | −100% | −35% |
| IABP 1:1 vs none | +6.4% | +14% | +14% | −17% (−3.4) | −8% | +10% | −21% |

**EF definitions (author decision, 2026-11-14; applied identically to every scenario, `runner/core.ts` `efMetrics`):**
- **EF_native** = native aortic-valve SV / LVEDV. This is the primary EF metric.
- **LV emptying fraction** = (LVEDV − Vmin)/LVEDV. This is the simulator's internal `ef`. It includes Impella outflow, so it is never labeled EF.
- Native CO and the AV opening fraction are reported alongside (`v3_model_directions.csv`).

| Comparison | EF_native | LV emptying fraction | Native CO |
|---|---|---|---|
| ECMO 4 vs none | 15.9 → 10.7% | 15.9 → 10.7% | 2.98 → 2.26 L/min |
| ECMO 4 + P5 vs ECMO 4 | 10.7 → 2.4% | 10.7 → 9.2% | — |
| ECMO 4 + P8 vs ECMO 4 | 10.7 → 0% | 10.7 → 11.0% | — |
| Impella P8 vs none | 15.9 → 0% | 15.9 → 13.0% | — |

The two metrics agree whenever no pump is running, and they diverge exactly where the old `ef` was misleading.

## V3b. Benchmark concordance (`build_benchmarks.py` → `benchmarks/*.csv`; `v3_concordance.ts` → `v3_concordance.csv`, `v3_concordance_summary.json`, `v3_arms.csv`; `v3_sweep.ts` → `v3_ecmo_sweep.csv`; figures `v3a_ecmo_sweep_benchmarks.png`, `v3b_unloading_on_ecmo.png`, `v3c_concordance_scatter.png`)

**Sources downloaded and read** (`benchmarks/xml`, `pdfs`, `img`, `text`):

| Key | Class | Species | What was used |
|---|---|---|---|
| donker2019simulation (PMC6325768; confirmed as Donker et al., ASAIO J 2019;65:11–20) | consistency | human simulation | Table 1 (an image in the XML, rows 2–10); SDC Appendix (.docx) |
| donker2019review (PMC6378398) | consistency | review | IABP PCWP fall "maximally 5 mmHg"; Impella "up to 10 mmHg / 20%" |
| broome2016 (PMC4704258) | consistency | human simulation | Table 1, "+ECMO only" column |
| ostadal2015 (PMC4537539) | consistency | porcine | EBF 1→5 results text; Table 1 |
| hala2020 (PMC7017528) | **independent** | porcine | Table 1, EBF 0–5 |
| frontiers2020impella = Nix et al. 2020 (PMC7299088) | **independent** | porcine | Results text; Table 2 (Abiomed-funded study) |
| mollerhelgestad2019 (EuroIntervention 2019;14:e1585) | **independent** | porcine | Tables 1–2 (publisher HTML images) |

Burkhoff 2015 is paywalled and was not downloaded. It is cited as background only.

**Rules (fixed in `v3_concordance.ts` before the run):**
- Direction is scored. Magnitude is reported as model % / benchmark % and is not scored.
- The model counts as "flat" when |Δ| < 1%.
- Animal data are compared by direction and % only.
- Consistency and independent sources are never pooled.
- All arms start from the same S0 shock state on the shipped patient.
- Reflex on is primary. Reflex off is also reported, because Donker's model has no reflexes.

**Counts:**

| | Reflex on (shipped) | Reflex off |
|---|---|---|
| Consistency (Donker, Donker review, Broomé, Ostadal) | **35 / 38** | 35 / 38 |
| Independent (Hála, Nix, Møller-Helgestad) | **24 / 29** | 24 / 29 |
| Independent, statistically significant benchmark only | 10 / 11 | 10 / 11 |

**By source (reflex on):**
- Donker 21/23
- Donker review 3/3 (all within the stated bounds)
- Broomé 4/4
- Ostadal 7/8
- Hála 6/8
- Nix 7/9
- Møller-Helgestad 11/12

With the reflex off, the PCWP fall from Impella P8 on ECMO (−10.4 mmHg) slightly exceeds the review's "up to 10 mmHg".

**Discordant comparisons (the same with the reflex on or off):**

| ID | Class | Benchmark | Model (reflex on) | Reading |
|---|---|---|---|---|
| DK-IABP-MAP | consistency | MAP 65 → 65; Donker held MAP at 65 by adjusting SVR | +2.8 mmHg | Protocol difference: Donker clamped MAP, CardioFlow does not |
| DK-RANK-PCWP-P5 | consistency | Impella 2.5 L/min lowers PCWP more than IABP (−2 vs −1) | P5 (2.2 L/min) −3.45 vs IABP −4.10 | Mismatch 2 (see below). At flow-matched P6 (2.6 L/min) the ranking is concordant (−4.45 vs −4.10) |
| OS-stroke work | consistency | SW +38% (EBF 1→5) | −9% | Phenotype: CardioFlow is the afterload-dominant ventricle (Ea/Ees ≈ 4, EF 16%). README E8 shows SW rising at Ostadal-like contractility |
| HA-stroke work | **independent** | SW +32% (EBF 0→5) | −10% | Same phenotype explanation; Hála's EF was 25% |
| HA-LV SV | **independent** | SV +2% net (non-monotone, peak at EBF 3) | −28% | The model ventricle cannot sustain SV against the added afterload |
| NX-ECMO-mPAP | **independent** | mPAP 15.8 → 11.2 (RV bypassed) | +4.6 mmHg (+18%) | Model mPAP follows the LAP rise. Donker's model also shows mPAP up (33 → 36) |
| NX-ECMO-EDV | **independent** | EDV "slightly reduced" at onset (qualitative) | +11% | Conflicts with Hála and Møller-Helgestad, where EDV rises (both concordant with the model) |
| MH-IMP-LV peak pressure | **independent** | 37 → 46 mmHg on Impella P8, all animals on norepinephrine | −11.5 mmHg | The model has no vasopressor; with the aortic valve closed, peak LV pressure falls |

**Magnitudes** (`relative_magnitude` column):
- The model's ECMO LV-loading changes are within about a factor of 2 of Donker's. For example, ΔPCWP is +6.4 vs +5 mmHg (×1.3 in mmHg, ×1.9 in %).
- The model's changes are mostly smaller than in the porcine sweeps: Hála LVEDP +35% vs +114%; Ostadal SBP +20% vs +62%.
- The model's change is larger than the porcine data for Impella PVA: −35% vs −12% in Møller-Helgestad.
- With the reflex off, the ECMO sweep moves toward Hála on LVEDP and away from Hála on SV (figure `v3a`).

## V4. Sensitivity (`v4_sensitivity.ts` → `v4_runs.csv`, `v4_tornado.csv`, `v4_direction_flips.csv`; figure `v4_tornado.png`)

Setup:
- 15 parameters × ±20% plus an open-loop (reflex-off) structural arm, 6 configurations each, 192 runs.
- SVR was perturbed as the reflex range (`svrMin`/`svrMax`). As shipped, `rSvr` is only the initial value.

**Directions.**
- None of the 50 comparison × outcome directions (C1–C5 × 10 outcomes, including EF_native) flips sign in any of the 31 perturbed cases.
- None collapses to "no change" either.
- Every V3 direction is robust to ±20% on every parameter tested.

**Magnitudes** are dominated by the LV parameters:

| Outcome | Baseline | Range under ±20% |
|---|---|---|
| S3 LVEDP | 26.5 mmHg | 20.9–31.6 (EDPVR B); 22.2–32.6 (Ees) |
| ECMO-induced ΔLVEDP | +6.5 mmHg | +5.0 to +8.8 (Ees); +4.8 to +8.2 (B) |
| ECpella ΔLVEDP | −3.7 mmHg | −2.9 to −6.2 (Ees); −2.5 to −5.3 (Impella H_max) |
| S3 MAP | 81.0 mmHg | 75.3–87.4 (baroreflex setpoint) |

- **The largest single sensitivity is structural.** With the baroreflex off, the ECMO-induced ΔLVEDP doubles from +6.5 to **+12.9 mmHg** and S3 MAP rises from 81 to 98.7. The reflex gain is a modeling choice (documented in the README), so the magnitude of ECMO-induced LV loading should be presented as reflex-dependent.

## V5. Twin integrity (`v5_twin.ts` → `v5_twin.csv`), using the app's own `TwinEngine`

| Test | Cases | Result |
|---|---|---|
| T1 Identical inputs | S0\|S0, S3\|S3, S4\|S4 | Every tick and beat is bit-identical over 1,000 beats (600,000 ticks); max diff 0 |
| T2 One pane changed via `applyRight` | ECMO 4, Impella P8, IABP, ECMO 7 | The other pane is bit-identical to an independent solo run over 1,000 beats; the changed pane did diverge |
| T3 `fork()` mid-beat | 1 | The continuing pane is bit-identical to a clone taken at the fork |
| T4 Separate patient objects differing in Ees | 1 | The unchanged simulation is bit-identical to a solo run |

The app exposes only device settings per pane. The panes share one read-only patient object, and nothing in `src/` writes to it.

---

## Mismatch 2 diagnosis: IABP vs Impella on ECMO 4 (`scripts/m2_impella_vs_iabp.ts` → `m2_impella_vs_iabp.csv`, `m2_iabp_balloon_volume.csv`)

**Checks:**
1. **Impella circuit attachment: no error.**
   - `sim.ts:116-117` has `dy[LV] = qMitral − qAortic − imp.q` and `dy[AO] = qAortic + imp.q − qRc`.
   - Inflow comes from the LV and outflow goes to the proximal aorta. The flow leaves LV volume exactly once and enters the aorta exactly once.
   - V1c conservation (2×10⁻⁹ mL) confirms it.
2. **Impella flow actually achieved under ECMO 4 afterload (L/min): no error, not changed.**

   | P-level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
   |---|---|---|---|---|---|---|---|---|---|
   | Reflex on | 0.72 | 1.05 | 1.40 | 1.78 | 2.19 | 2.63 | 3.03 | 3.40 | 3.78 |
   | Reflex off | 0.55 | 0.81 | 1.15 | 1.51 | 1.87 | 2.15 | 2.44 | 2.75 | 3.07 |

   - Without ECMO, P5 delivers 2.45 L/min and P8 delivers 3.76.
   - Flow falls with ECMO afterload, as the H-Q line intends, but it does not collapse.
   - The mapping follows the code's stated design ("P2..P8 span roughly 0.5–3.5 L/min", `impella.ts:16-18`), and the units are consistent (mmHg, mL/s).
   - None of the downloaded sources contains a manufacturer H-Q curve, so no documented device characteristic justifies changing it.
3. **IABP: no code error.**
   - The 40 mL balloon displaces volume in the single systemic-arterial compliance (C_SA = 1.3 mL/mmHg).
   - On ECMO 4 it raises peak diastolic pressure from 84.0 to 98.1 mmHg (+14) and lowers aortic end-diastolic pressure from 74.0 to 58.5 (−15.6). Without ECMO the changes are +14.4 and −12.4.
   - 40 mL is a standard adult balloon size, and the timing logic matches the code comments.

**Root cause: the ranking is faithful model behavior, set by three factors.**
- **Impella flow.**
  - P5 under ECMO 4 delivers only 2.2 L/min.
  - The ranking reverses between P5 and P6. P6 (2.6 L/min) gives ΔLAP −4.45 vs −4.10 for the IABP.
  - At P8 (3.4 L/min) the Impella lowers LAP by 9.7 mmHg vs 4.1 for the IABP.
  - P5 was chosen for on-screen legibility (commit `9c569ff`), not physiology.
- **Balloon volume and the lumped arterial compartment.** A 40 mL displacement acting on the whole arterial compliance, with no partial occlusion, unloads more than Donker's 30 mL segmental balloon. The IABP ΔLAP is −3.1 at 30 mL (−2.4 with the reflex off) and −2.1 at 20 mL (−1.6 with the reflex off) (`m2_iabp_balloon_volume.csv`).
- **The baroreflex.** The IABP raises MAP, the reflex then lowers SVR, and afterload falls further. IABP ΔLVEDP is −4.15 with the reflex on vs −3.16 with it off. For Impella P5 the figures are −3.74 vs −3.18.

**Against the benchmarks:**
- IABP ΔPCWP (−4.1) is inside the Donker review's "maximally 5 mmHg" (DR-IABP-PCWP concordant).
- It is larger than Donker Table 1 (−1). Donker's comparator state also differs: row 5 has −800 mL volume and MAP held at 65.
- Under Donker-like conditions (30 mL balloon, reflex off), CardioFlow gives PCWP −2.4 mmHg, EDV −2.8% and SV +19%. Donker gives −1 mmHg, −2.6% and +33%.

**The ranking reverses** when Impella flow is at least about 2.6 L/min under ECMO 4 (P ≥ 6), with a smaller balloon, or with the reflex off.

**Decision: no code fix.** No `fix/impella-model` branch was created, and `src/` is untouched. The rules allow a fix only for a code error, a wrong unit or a documented device characteristic, and none was found. The Impella mapping, the IABP lumping and the S4 = P5 choice are stated as limitations (`model_spec.md` items 10 and 11) and in Methods.

## Mismatch 3: baroreflex on vs off (`scripts/m3_reflex_table.py` → `m3_reflex_on_off.csv`)

- **The reflex roughly halves every ECMO-induced change.** For ECMO 4 (reflex on vs off): ΔMAP +19.1 vs +36.5, ΔLVEDP +6.5 vs +12.9, Δnative SV −7.3 vs −14.4 mL.
- **It slightly enlarges IABP and Impella unloading on ECMO**, by a factor of 1.2–1.6.
- **0 of 63 device-effect signs differ** between reflex on and off, and the V3 concordance counts are identical in both arms.
- **The reflex gain is a modeling assumption, not a measurement.** The reflex was added to bring the ECMO ΔLVEDP into a window taken from Donker 2019, yet Donker's own model has no reflexes (`parameter_provenance.md`). Both arms are reported.

## Mismatch 4: ECMO is an ideal flow source and the drainage limit never triggers

This goes in Limitations (`model_spec.md` item 9). There is no pump curve, and the drainage roll-off never engaged in any run, so its ±20% sensitivity is zero by construction.

## Mismatches, concerns and things a reviewer will find (earlier list, kept for the record)

0. **Update (second pass).**
   - Circularity is confirmed: PMC6325768 is Donker et al., ASAIO J 2019;65(1):11–20. Its parameter provenance is in `parameter_provenance.md`.
   - Items 2 and 4 below are resolved as mismatches 4 and 2 above.
   - The AV-opening item (3) remains unbenchmarked: none of the downloaded sources reports AV opening fraction under ECMO.
   - The main independent discordances are listed in V3b: stroke work, SV maintenance, mPAP, and Impella LV peak pressure under vasopressor.
   - Nix 2020 was funded by Abiomed. Disclose this when citing it.
   - The model cannot reach Impella 5.0 flows on ECMO (maximum 3.8 L/min at P9).

1. **Benchmark circularity (the most important).** The LV EDPVR and Ees were recalibrated (Task D, commit `8769c12`) against **Donker 2019** (+10% EDV and +5 mmHg PCWP at 4 L/min) and **Ostadal 2015** (`patient.ts:52-56`, README).
   - I believe PMC6325768 *is* Donker et al. 2019 (ASAIO J). I'll confirm this from the PDF.
   - If so, the primary benchmark was used to tune the model. Concordance with it is calibration consistency, not independent verification, and must be reported separately and disclosed in Methods.
   - Burkhoff 2015 is (as far as the code records) independent.
   - `v3_concordance.ts` already separates calibration-overlap sources from independent ones.
2. **The ECMO drainage limit is never exercised.** No run, including 7 L/min and every ±20% case, triggered it, because venous pressure stays ≈ 12 mmHg. The "ECMO pump-curve parameter" sensitivity is therefore null by construction. ECMO is an ideal flow source, so the paper must not describe a pump curve.
3. **The aortic valve keeps opening at every ECMO flow.** At 7 L/min it is still open 20% of the cycle (native SV 18 mL). Whether that matches the benchmarks is open. The baroreflex (SVR 15.8 → 9.1 WU) shields the LV, and with the reflex off, native output falls much more (README: 2.98 → 1.53 L/min at 4 L/min).
4. **IABP unloading on ECMO is at least as strong as Impella P5.** IABP gives ΔLVEDP −4.1 vs −3.7 for P5, and IABP *raises* native SV by 22%. The balloon is a pure volume displacement in a single arterial compartment. This is a plausible target for a benchmark mismatch, so check it against the PDFs.
5. **EF (resolved).** The internal `ef` counts pump outflow; it rises from P8 to P9 (13.0 → 15.3%). Resolved by the EF_native / LV-emptying-fraction definitions above. This is a reporting change, not a model change.
6. **A known, documented divergence:** IABP late deflation gives a ~2% higher SV than correct timing (validation report). It stays reported, not tuned.
7. **IABP 1:2 needs care in reporting.** It has a 2-beat cycle (MAP 57.5 / 70.4 by beat). Use the two-beat mean (MAP 64.0, `v3_iabp_1to2.csv`), never a single beat.
8. **Supranormal total flow at high ECMO** (8.8 L/min at 7 L/min) is arithmetically forced (README "Where S3's 6.3 L/min comes from").

## Recommendation

- **Nothing needs fixing before submission on numerical grounds.** P0, V1 and V5 pass by wide margins, and V4 shows no direction instability.
- **No parameters have been changed.**
- **Benchmarks.** Directional concordance is 35/38 for consistency sources and 24/29 for independent sources.
- **Independent discordances.** Four are physiologically interpretable: stroke work and SV maintenance on ECMO, mPAP on ECMO, and Impella peak LV pressure under vasopressor. They are reported, not tuned away. The fifth (EDV at ECMO onset) is a qualitative statement that conflicts with the other two independent sources.
- **Magnitudes** differ from the porcine data, as expected across species and phenotype.

## Author decisions recorded (2026-11-14)

1. **Normal baseline:** dropped. V2 = shock vs shock ranges only, and the Limitations section says there is no normal-physiology calibration.
2. **Donker:** if confirmed as PMC6325768 and as a source of CardioFlow parameters, it is reported as "consistency with the source model", with parameter provenance stated in Methods. Ostadal 2015 falls in the same category. At least one independent benchmark is required: Burkhoff 2015 plus author-supplied clinical or animal data. The full list of what's needed is in `paper/TODO.md`.
3. **EF:** EF_native is primary, LV emptying fraction is secondary, and native AV flow and opening are reported. The definition goes in Methods.
4. **Git:** committed and pushed on `paper/asaio-verification`, not merged to main.
5. **Benchmarks (second pass, 2026-11-14):** sources fetched from Europe PMC and the publishers. Burkhoff 2015 is background only. Animal data are compared by direction and % only. V2 reference values come only from the benchmark papers' shock baselines. Mismatch 2 is not fixed because no code error or documented device characteristic was found.
