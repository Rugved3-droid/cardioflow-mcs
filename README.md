# CardioFlow MCS

**One patient in cardiogenic shock. Two simultaneous realities. One cardiac clock.**

An educational simulator for mechanical circulatory support (IABP, Impella, VA-ECMO, ECpella). Pane A keeps running the current therapy; pane B gets the intervention. Both run live, beat-locked to the same clock, so the learner watches *the pressure get better while the ventricle gets worse* instead of being told about it.

> **Educational model only.** Not clinically validated, not a medical device, not for patient care.
> Nothing in this repository has been compared against patient data.

---

## Running it (resident laptop, no setup)

Open **`release/CardioFlow-MCS.html`** by double-clicking it. It is one self-contained file: no install, no server, no network. It works in current Chrome and Edge.

- **Explore:** keys **1–5** select S0–S4. B takes the new therapy and A keeps the previous one. **Space** pauses. The B controls adjust ECMO flow, Impella P-level, and IABP on/timing/ratio.
- **Resident session:** 10 prediction items, anonymous, about 10 minutes. Each item runs: predict → lock → watch the intervention run (3×) → reveal → pick a mechanism → see the causal chain.

### Session data

- Stored only in the browser on that machine (`localStorage`). No names are collected. The session ID is random (e.g. `K7QX-M2PA`). The optional group tag is free text; tell residents not to type names.
- **Download this session (JSON)** is on the scorecard. **Export all sessions (CSV)** writes one row per item response across every session stored on the machine. **Import session JSON…** merges files from other laptops so you can build one aggregate CSV.
- CSV columns: `session_id, cohort, app_version, session_started_at, item_id, construct, competency_item, stem, prediction, correct_answer, prediction_correct, latency_ms, mechanism_choice, mechanism_correct_choice, mechanism_correct, mechanism_latency_ms, shown_at, locked_at`.
- Clearing browser data deletes stored sessions, so export before handing the laptop back.

### Scorecard

- % correct by construct: IABP timing, Impella unloading, aortic valve opening, VA-ECMO pressure, VA-ECMO LV filling pressure, VA-ECMO native SV, ECpella.
- **Headline competency, "distinguishes systemic perfusion from ventricular unloading":** % correct on the items where perfusion and ventricular loading move independently (Impella LVEDP, ECMO MAP, ECMO native SV, ECpella LVEDP). It also reports the **key dissociation**: whether the resident predicted *both* that VA-ECMO raises MAP *and* that it lowers native stroke volume — both halves evidence-backed and robust to the preload/afterload balance.
- This is formative feedback. It is not a validated assessment instrument, and the threshold for "competent" is not defined.

### Where answers come from

Correct answers live in `src/assessment/itemBank.ts`, keyed from physiology/literature with a source and a written basis on each item. They are **never** read from simulator output. The dependency runs the other way: validation check E7 fails if the simulator ever disagrees with a key.

**`validation/ANSWER-KEYS.md` is the sign-off sheet** — generated from the item bank by `npm run keytable`, so it cannot drift from what ships. Take it to a cardiologist and have each row marked agree / disagree / reword.

All nine cited references were checked against the published record on 2026-09-24 and exist with the stated journal, year, volume and pages. Whether a citation *supports the specific claim* is tracked separately, per item.

**One item was retired** (`ecmo-lvedp`, "VA-ECMO raises LVEDP") because its direction is contingent in humans rather than established: reported LV-distension incidence spans 1–68%, and a published case series found LVEDP *lower* at high circuit flow than at low flow. This model is parameterised so afterload dominates and LVEDP rises, which is a defensible teaching configuration but not a universal finding, so scoring a learner wrong for answering "fall" is not defensible. It stays in the file, inactive, with the reasoning. The teaching point is carried instead by native SV and aortic-valve opening, where preload reduction and afterload rise push the same way.

---

## Developer commands

```
npm install
npm run keytable    # regenerate validation/ANSWER-KEYS.md (cardiologist sign-off sheet)
npm run validate    # headless sanity checks → validation/report.md + results.csv (exit 1 on failure)
npm run snapshots   # regenerate shipped steady states after any model/patient change
npm run build       # typecheck + single-file build → release/CardioFlow-MCS.html
npm run dev         # live dev server
```

---

## The model

The code lives in `src/model/`. `Sim.state` is the single source of truth, and every number and visual is read from it.

| | |
|---|---|
| Clock | Fixed **1 ms tick**, integer ticks. HR 100 → 600 ticks per beat exactly. |
| Integrator | Classical RK4, 4 fixed substeps per tick. No adaptive step, no wall-clock input. |
| Determinism | Same inputs → byte-identical output **within one JS engine** (checked by SHA-256 in `validate`). `Math.exp`/`Math.pow` are not bit-specified *across* engines, so record the demo in one browser. |
| LV | Time-varying elastance blending linear ESPVR `Ees(V-V0)` and exponential EDPVR `A(e^{B(V-V0ed)}-1)` via a normalized double-Hill activation. **The ESPVR and EDPVR have separate volume intercepts** (`lvV0` = 40, `lvV0ed` = 53); a dilated, remodelled ventricle sits on a right-shifted passive curve, and sharing one intercept forces the operating point deep onto the exponential. |
| RV | Same construction. Present only to close the loop. |
| Systemic | 3-element Windkessel (Rc, C, Rsvr) plus a small proximal aortic capacitance, so the aortic-valve/Impella-outlet node is an ODE state. |
| Venous | Finite stressed-volume reservoir (C = 120 mL/mmHg). |
| Pulmonary | PA compliance, PVR, pulmonary-venous/LA compliance. |
| Bronchial/Thebesian return | Systemic arteries → LA, bypassing the RV. This is a real path, and it keeps filling the LV even when the AV is closed. |
| Valves | Ideal diodes: the aortic valve is open **iff** P_LV > P_Ao (asserted every tick). |
| Volume | Conserved exactly (checked to 1e-6 every tick). No hidden corrector, no clamps. |

### Devices

- **IABP.** The balloon occupies volume in the descending aorta: `P = (V_blood + V_balloon)/C`. Inflation starts at the dicrotic notch; deflation completes 20 ms before the AV opens. Both references are captured from an unassisted beat, the way an operator times off both landmarks. The four mistimings are fixed ms offsets (`src/model/devices/iabp.ts`). 1:1 and 1:2 are both supported.
- **Impella.** Flow sits on a monotonically decreasing H-Q line, `Q = max(0, (H0(level) − (P_Ao − P_LV))/K)`, so flow surges in systole and falls when afterload rises. **Suction guard:** flow rolls off smoothly as V_LV → V0 + 5 mL and raises a flag. The curves are **illustrative, not manufacturer H-Q curves**, and retrograde pump flow is not modeled.
- **VA-ECMO.** A flow source from the venous reservoir, returned retrograde into the descending aorta. **Drainage limit:** flow rolls off and a flag is raised as venous pressure → 0.
- **ECpella** is simply both devices running together. There is no special-case physiology.
- **Rate limits** (`src/model/constants.ts`): ECMO 0.6 L/min/s, Impella 1.5 levels/s, balloon fill 0.5/s, IABP timing 120 ms/s. Every commanded step becomes a ramp through valid intermediate states (the harness asserts no beat-to-beat jump).

### Per-beat outputs

MAP, SBP, DBP, pulse pressure, peak diastolic (augmented) pressure, aortic EDP at AV opening, LVEDP, LVEDV, LVESV, EF, native SV, native CO, Impella flow, ECMO flow, total flow (native + Impella + ECMO), AV open fraction, stroke work (loop area), PVA, DPTI, LAP, RAP, PA mean, suction/drainage flags.

- **AV open fraction** is the fraction of the cardiac cycle the valve is open, integrated inside RK4 and then EMA-smoothed across beats (α = 0.35). It updates once per beat, so it cannot flicker frame to frame.
- **PVA** = SW + PE, with PE = ½·P_es·(V_es − V0) − ∫EDPVR from V0 to V_es. The end-systolic point is max P/(V−V0).
- **DPTI** (coronary perfusion surrogate) = ∫(P_Ao − P_LV)⁺ dt over diastole. Diastole means LV activation < 0.1, defined by activation rather than valve state so it stays meaningful when the AV never opens. Units: mmHg·s per beat.

### The patient and the five states

**Phenotype: low-contractility, afterload-dominant LV failure** - Ees 0.62 mmHg/mL, Ea/Ees ~ 4.0, EF ~ 16%. A severely uncoupled ventricle that cannot eject against added arterial pressure: the patient in whom VA-ECMO distends the LV, and therefore a candidate for venting. The label is shown in the app, and the harness fails if it drifts from the shipped parameters.

**This is one phenotype, not all of them.** How far VA-ECMO raises LV filling pressure depends on the ventricle (see "LV afterload response calibration" below). The app says so wherever it reports an LV-loading result, rather than implying that ECMO always distends.

The parameters (`src/model/patient.ts`) were tuned by hand so that S0 lands in a textbook SCAI C–D cardiogenic-shock profile. They were **not fitted to any patient or dataset.**

| State | MAP | LVEDP | LVEDV | Native SV | Total flow | AV open |
|---|---:|---:|---:|---:|---:|---:|
| S0 Shock, no support | 62 | 20 | 188 | 30 mL | 3.0 L/min | 27% |
| S1 IABP 1:1 | 68 | 17 | 177 | 33 | 3.3 | 30% |
| S2 Impella P8 | 74 | 14 | 162 | 0 | 3.7 | 0% |
| S3 VA-ECMO 4 L/min | 99 | **33** | 229 | 15 | 5.5 | 18% |
| S4 ECpella (Impella P8 + ECMO weaned to 2) | 97 | **18** | 180 | 0 | 5.2 | 0% |

MAP at S3/S4 is too high because there is **no baroreflex yet** - added circuit flow has
nowhere to go but pressure. That is the next piece of work, and the LVEDP rise at S3
(+13 mmHg) is expected to fall to roughly +7 once it lands.

(Full values in `validation/report.md`.)

### LV afterload response calibration

The first build's ventricle over-responded to afterload. Two external anchors said so:
Ostadal 2015 measured stroke work **rising** (x1.45) as porcine ECMO flow went 1->5 L/min,
where this model's fell x0.25; and Donker 2019 reports +5 mmHg PCWP and +10% EDV at
4 L/min, where this model gave +18 mmHg LVEDP.

A one-at-a-time sensitivity sweep at S3 (`npx tsx scripts/coupling.ts`) found the culprits,
and ruled some out. Elasticities (% change in output per % change in parameter):

| Parameter | on stroke work | on LVEDP |
|---|---:|---:|
| EDPVR `B` | **-7.4** | +0.69 |
| `Ees` | **+6.2** | -0.64 |
| `Rsvr` | **-3.8** | +0.51 |
| `Rc` | -0.17 | +0.02 |
| E(t) timing (`actScale`) | -0.17 | +0.02 |
| `Csa` | +0.06 | -0.03 |

So characteristic impedance, arterial compliance and the E(t) waveform were **not**
involved. Two faults were:

1. **Diastolic operating point.** ESPVR and EDPVR shared one volume intercept, putting the
   passive curve at e^4.0 at EDV 195. Local stiffness `dP/dV = B(P+A)` was 0.58 mmHg/mL at
   S0 and 1.04 at S3, against the ~0.25 implied by Donker. Fixed by separating the
   intercepts and re-fitting: `A` 0.4 -> 8.0, `B` 0.026 -> 0.0093, `V0ed` = 53. Stiffness is
   now 0.26 mmHg/mL and the harness enforces 0.15-0.40.
2. **Ventriculo-arterial coupling.** Ea/Ees was 5.0 at S0 and **29.4** at S3 (EF 2.7%) - a
   mechanically arrested ventricle, which is what collapsed stroke work. `Ees` 0.5 -> 0.62
   brings S0 to Ea/Ees 4.0, inside the published cardiogenic-shock range, and the harness
   enforces 2.5-5.

Stroke work at S3 is now x0.74 rather than x0.25.

**Does the model contradict Ostadal?** No - it reproduces their direction when given their
ventricle. Sweeping contractility and nothing else (validation E8):

| Ees | baseline EF | Ea/Ees | stroke work ratio at ECMO 4 | LVEDP rise |
|---:|---:|---:|---:|---:|
| 0.62 (shipped) | 16% | 4.0 | **0.74** (falls) | +12.9 |
| 0.90 | 21% | 2.7 | 1.05 | +9.5 |
| 1.30 | 26% | 1.8 | 1.26 | +6.6 |
| 1.80 | 32% | 1.3 | **1.28** (rises) | +3.9 |
| 2.40 | 37% | 0.9 | 1.23 | +2.1 |

The ratio crosses 1 exactly once, near Ea/Ees ~ 2.5. Ostadal's pigs began at EF 43%, well
above that crossing, and measured x1.45; this model at EF 32% gives x1.28. **Same
direction, comparable magnitude, different patient.** The divergence is a phenotype
difference, not a modelling error, and E8 fails the build if that stops being true.

The same sweep is why the `ecmo-lvedp` assessment item was retired: the LVEDP rise varies
more than sixfold across plausible contractilities (+2.1 to +12.9 mmHg) while native SV and
aortic-valve opening fall at **every** phenotype.

### Design decisions that differ from the original spec

1. **S4 weans ECMO from 4 to 2 L/min as the Impella is added.** With fixed SVR and no baroreflex, adding a vent at *constant* ECMO flow reopens flow through the lungs: the RV now pumps what the LV can pass. Total flow rises and MAP rises (to 117 mmHg at ECMO 4 + P8; see E4). "MAP holds while LVEDP falls" only happens in this model when the circuit is weaned, which is also standard practice. The literal spec version (ECMO held at 4 + Impella ramp) runs as E4, and the "MAP holds" claim is reported there as not met.
2. **IABP E6 checks assert each mistiming's textbook signature**, not the spec's blanket "correct timing → higher DPTI and lower stroke work than early inflation". Early inflation cuts SV, so stroke work (loop area) falls rather than rises. The O₂-demand index is PVA. The spec-literal lines are still reported as non-gating notes.
3. **Two pre-specified textbook expectations failed on first run and are reported as documented divergences, not hidden.** Early inflation gives PVA ≈ −1.5% instead of higher (SV↓, ESV↑, EDV↑ and premature AV closure are all reproduced). Late deflation gives SV ≈ +2% instead of lower (AoEDP↑ and PVA↑ are reproduced; the balloon finishes deflating during early ejection). Both were reclassified *after* the numbers were seen; the report says so.

### Known limitations

No baroreflex or autoregulation. No drugs (by design). The RV is minimal. No aortic regurgitation or watershed/mixing zone. Impella and ECMO curves are illustrative. No inertance, so there is no dicrotic notch *on the trace*, although AV closure is exact in the state. The IABP timing reference falls back to defaults if the balloon is armed while the AV is not opening.

---

## Internal implementation sanity checks (`npm run validate`)

**These are internal implementation sanity checks, NOT validation against clinical data.** They confirm that the model moves in the directions its equations should produce, never enters an impossible state, and agrees with the hand-keyed answers.

- **E1** Baseline lands inside the shock design targets, with Ea/Ees in 2.5-5, diastolic stiffness in 0.15-0.40 mmHg/mL, and the declared phenotype matching the shipped parameters.
- **E2** ECMO ramp 0→4: native SV↓, LVEDP↑, LVEDV↑, AV-open↓, MAP↑, total flow↑, PVA↑, all strictly monotone.
- **E3** Impella P0→P8: LVEDP↓, LVEDV↓, PVA↓, pump flow↑, total flow↑, native SV↓.
- **E4** ECMO 4 + Impella ramp: LVEDP↓ strictly, endpoint below the E2 endpoint.
- **E5** IABP on vs off: augmentation↑, AoEDP↓, DPTI↑, SV↑, LVEDP↓, PVA↓. In 1:2, assisted systole < unassisted systole and assisted AoEDP < unassisted AoEDP.
- **E6** Correct timing vs each of the four mistimings, using each one's textbook signature.
- **E7** The simulator agrees with the answer key for every active item, and retired items are excluded from the learner-facing bank.
- **E8** The stroke-work response to VA-ECMO changes sign with contractility, reconciling this model with Ostadal 2015; native SV and AV opening fall at every phenotype; the shipped patient is the afterload-dominant one.
- **Every tick of every run:** no NaN/Inf, no negative volume, no P_LV > P_Ao while the AV is flagged closed, volume conserved, slew limits respected. Beat-to-beat continuity is checked during every ramp.
- **Determinism:** two identical runs hash identically, lockstepped clones stay bit-identical, and the shipped snapshots equal a fresh recomputation.

Current result: see `validation/report.md`.
