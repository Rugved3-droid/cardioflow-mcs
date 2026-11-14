# CardioFlow Twin: Phase 0–1 verification report

Branch `paper/asaio-verification` · 2026-11-14 · model source unchanged (`src/model/` last changed in `6d74829`).
Every number below comes from a CSV in `paper/results/`, and the script that wrote it is named. No parameters were changed.

## Status at a glance

| Item | Result | Status |
|---|---|---|
| P0 Headless runner = browser engine | Node vs Chrome max rel. error **3.7×10⁻¹⁴** (criterion 1×10⁻⁶) | PASS |
| V1a Time-step convergence | shipped h = 0.25 ms; worst change on halving **1.1×10⁻⁶ relative (0.0001%)**, criterion 0.5% | PASS |
| V1b Limit cycle | steady 33–63 beats after the command; recipe residual ≤ 7×10⁻⁸ | PASS |
| V1c Volume conservation | max drift **2.2×10⁻⁹ mL** (≤ 9×10⁻¹³ relative) over 510,000 ticks | PASS |
| V2 Baseline vs reference shock ranges | shock baseline run (normal baseline dropped by author decision); **ranges not supplied** | BLOCKED |
| V3 Device benchmark | model side complete (64 runs); **benchmark PDFs not supplied**, so concordance is not computed | BLOCKED |
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

**V1c. Conservation** (`v1_conservation.csv`): max |V(t) − V(0)| ≤ 2.2×10⁻⁹ mL out of 2,287 mL in all 9 scenarios, including every pump and ECMO 6 L/min.

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

- **The in/out-of-range verdict is PENDING** because `reference_ranges.csv` has not been supplied.
- **Scope (author decision, 2026-11-14):** shock baseline vs reference shock ranges only. No normal baseline. The Limitations section states that there is no normal-physiology calibration.

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

- **Concordance with benchmarks: NOT COMPUTED.** No PDFs are in `paper/benchmarks/pdfs/`. `v3_concordance.ts` is ready and will join `device_benchmarks.csv` (schema in `benchmarks/README.md`) to these rows once you supply the PDFs.

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

## Mismatches, concerns and things a reviewer will find

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
- **No parameters have been changed.** Whether any V3 behavior is a real mismatch (items 3 and 4 are the likely ones) is decided only against the benchmarks.

## Author decisions recorded (2026-11-14)

1. **Normal baseline:** dropped. V2 = shock vs shock ranges only, and the Limitations section says there is no normal-physiology calibration.
2. **Donker:** if confirmed as PMC6325768 and as a source of CardioFlow parameters, it is reported as "consistency with the source model", with parameter provenance stated in Methods. Ostadal 2015 falls in the same category. At least one independent benchmark is required: Burkhoff 2015 plus author-supplied clinical or animal data. The full list of what's needed is in `paper/TODO.md`.
3. **EF:** EF_native is primary, LV emptying fraction is secondary, and native AV flow and opening are reported. The definition goes in Methods.
4. **Git:** committed and pushed on `paper/asaio-verification`, not merged to main.
