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
| LV | Time-varying elastance blending linear ESPVR `Ees(V−V0)` and exponential EDPVR `A(e^{B(V−V0)}−1)` via a normalized double-Hill activation. |
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

The parameters (`src/model/patient.ts`) were tuned by hand so that S0 lands in a textbook SCAI C–D cardiogenic-shock profile. They were **not fitted to any patient or dataset.**

| State | MAP | LVEDP | Total flow | Native SV | AV open |
|---|---:|---:|---:|---:|---:|
| S0 Shock, no support | 54 | 22 | 2.6 L/min | 26 mL | 28% |
| S1 IABP 1:1 | 63 | 18 | 3.1 | 31 | |
| S2 Impella P8 | 72 | 13 | 3.6 | 0 | 0% |
| S3 VA-ECMO 4 L/min | 81 | **40** | 4.6 | 6 | 14% |
| S4 ECpella (Impella P8 + ECMO weaned to 2) | 94 | **17** | 5.2 | 0 | 0% |

(Full values in `validation/report.md`.)

### Design decisions that differ from the original spec

1. **S4 weans ECMO from 4 to 2 L/min as the Impella is added.** With fixed SVR and no baroreflex, adding a vent at *constant* ECMO flow reopens flow through the lungs: the RV now pumps what the LV can pass. Total flow rises and MAP rises (to 117 mmHg at ECMO 4 + P8; see E4). "MAP holds while LVEDP falls" only happens in this model when the circuit is weaned, which is also standard practice. The literal spec version (ECMO held at 4 + Impella ramp) runs as E4, and the "MAP holds" claim is reported there as not met.
2. **IABP E6 checks assert each mistiming's textbook signature**, not the spec's blanket "correct timing → higher DPTI and lower stroke work than early inflation". Early inflation cuts SV, so stroke work (loop area) falls rather than rises. The O₂-demand index is PVA. The spec-literal lines are still reported as non-gating notes.
3. **Two pre-specified textbook expectations failed on first run and are reported as documented divergences, not hidden.** Early inflation gives PVA ≈ −1.5% instead of higher (SV↓, ESV↑, EDV↑ and premature AV closure are all reproduced). Late deflation gives SV ≈ +2% instead of lower (AoEDP↑ and PVA↑ are reproduced; the balloon finishes deflating during early ejection). Both were reclassified *after* the numbers were seen; the report says so.

### Known limitations

No baroreflex or autoregulation. No drugs (by design). The RV is minimal. No aortic regurgitation or watershed/mixing zone. Impella and ECMO curves are illustrative. No inertance, so there is no dicrotic notch *on the trace*, although AV closure is exact in the state. The IABP timing reference falls back to defaults if the balloon is armed while the AV is not opening.

---

## Internal implementation sanity checks (`npm run validate`)

**These are internal implementation sanity checks, NOT validation against clinical data.** They confirm that the model moves in the directions its equations should produce, never enters an impossible state, and agrees with the hand-keyed answers.

- **E1** Baseline lands inside the shock design targets.
- **E2** ECMO ramp 0→4: native SV↓, LVEDP↑, LVEDV↑, AV-open↓, MAP↑, total flow↑, PVA↑, all strictly monotone.
- **E3** Impella P0→P8: LVEDP↓, LVEDV↓, PVA↓, pump flow↑, total flow↑, native SV↓.
- **E4** ECMO 4 + Impella ramp: LVEDP↓ strictly, endpoint below the E2 endpoint.
- **E5** IABP on vs off: augmentation↑, AoEDP↓, DPTI↑, SV↑, LVEDP↓, PVA↓. In 1:2, assisted systole < unassisted systole and assisted AoEDP < unassisted AoEDP.
- **E6** Correct timing vs each of the four mistimings, using each one's textbook signature.
- **E7** The simulator agrees with the answer key for all 10 items.
- **Every tick of every run:** no NaN/Inf, no negative volume, no P_LV > P_Ao while the AV is flagged closed, volume conserved, slew limits respected. Beat-to-beat continuity is checked during every ramp.
- **Determinism:** two identical runs hash identically, lockstepped clones stay bit-identical, and the shipped snapshots equal a fresh recomputation.

Current result: see `validation/report.md`.
