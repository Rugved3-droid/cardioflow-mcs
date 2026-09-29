# CardioFlow MCS

**One patient in cardiogenic shock. Two simultaneous realities. One cardiac clock.**

An educational simulator for mechanical circulatory support (IABP, Impella, VA-ECMO, ECpella). Pane A keeps running the current therapy; pane B gets the intervention. Both run live, beat-locked to the same clock, so the learner watches *the pressure get better while the ventricle gets worse* instead of being told about it.

> **Educational model only.** Not clinically validated, not a medical device, not for patient care.
> Nothing in this repository has been compared against patient data.

---

## Running it (resident laptop, no setup)

Open **`release/CardioFlow-MCS.html`** by double-clicking it. It is one self-contained file: no install, no server, no network. It works in current Chrome and Edge.

- **Explore:** press **?** for the key list. **D** runs the scripted demo hands-free. **1–6** select S0–S5; **A** and **P** open the anatomy and plane full-screen; **W** walks the causal chain, and each metric tile also has a **WHY?** button on hover. B takes the new therapy and A keeps the previous one. **Space** pauses. The B controls adjust ECMO flow, Impella P-level, and IABP on/timing/ratio.
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
| Systemic | 3-element Windkessel (Rc, C, Rsvr) plus a small proximal aortic capacitance, so the aortic-valve/Impella-outlet node is an ODE state. Rsvr is set by the baroreflex (below), not fixed. |
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

| State | MAP | LVEDP | LVEDV | Native SV | Total flow | AV open | SVR |
|---|---:|---:|---:|---:|---:|---:|---:|
| S0 Shock, no support | 62 | 20 | 188 | 30 mL | 3.0 L/min | 27% | 15.8 WU |
| S1 IABP 1:1 | 66 | 17 | 174 | 34 | 3.4 | 30% | 14.8 |
| S2 Impella P8 | 69 | 13 | 157 | 0 | 3.8 | 0% | 14.0 |
| S3 VA-ECMO 4 L/min | 81 | **26** | 210 | 23 | 6.3 | 23% | 10.9 |
| S4 ECpella (VA-ECMO **4** + Impella P5) | 83 | **23** | 198 | 5 | 6.7 | 12% | 10.4 |
| S5 ECpella, ECMO weaned to 2 (Impella P8) | 79 | 15 | 166 | 0 | 5.6 | 0% | 11.4 |

**S4 differs from S3 by exactly one variable: the pump.** Circuit flow stays at 4 L/min,
so the S3 -> S4 comparison is a clean counterfactual, and the harness fails if a second
variable ever changes. S5 is the weaned configuration; it changes two things at once, so it
is offered as a management step rather than as a comparison.

(Full values in `validation/report.md`.)

### Device / anatomy co-registration

A schematic band under both panes, one heart per reality, so a device setting and its
mechanical consequence are on screen together. Deliberately schematic rather than
anatomical: the target is legibility at 1080p after video compression.

**Devices are fixed in position.** The learner changes settings only. Nothing can be placed,
advanced, positioned or cannulated, and there is no malposition feedback. This is mechanistic
co-registration, not a placement trainer.

**Everything drawn is a function of simulator state. There is no animation timeline.**

| drawn | driven by | field |
|---|---|---|
| LV cavity size | instantaneous cavity volume | `vLv` |
| Aortic valve leaflets | instantaneous transvalvular flow | `qAortic` |
| IABP balloon size | instantaneous balloon volume | `vBalloon` |
| Impella / ECMO / mitral / systemic arrow density | the corresponding instantaneous flow | `qImpella`, `qEcmo`, `qMitral`, `qSvr` |
| Arrow *position* along every path | cumulative transported volume | `state.cum.*` |

That last row is the part that matters. Arrow motion is not a timer: the model integrates the
volume each path has actually carried (`state.cum`, on the same fixed 1 ms tick as the
physiology), and an arrow's position is that volume modulo a spacing constant. Flow doubles,
arrows move twice as fast, because twice the volume passes. Pause the simulation and the
picture stops. Being part of sim state, it is deterministic, clone-safe and snapshot-safe.

What each device shows: the **Impella** draws blood from an inlet inside the LV, across the
valve, to an outlet in the ascending aorta, with the chamber visibly smaller in the same frame
that LVEDV falls. **VA-ECMO** drains the venous reservoir, crosses the pump, and returns
**retrograde** up the descending aorta — drawn on the opposite side of the vessel from
antegrade flow and in the opposite direction, because that opposition is the reason afterload
rises. The **IABP balloon** inflates and deflates against cardiac phase, so a mistiming is
visible as motion rather than only as a waveform change. The **aortic valve** leaflets track
instantaneous transvalvular flow, so the intermittent opening at S4/P5 is visible as
intermittency.

The band plugs into the same `surfaces` field the causal graph already declared, so **WHY**
highlighting lights up the relevant structure alongside the waveform, PV loop and numeric
tiles — the graph remains the single source of truth. Press **A** for a large overlay.

Validation E13 asserts that every animated quantity names a real instantaneous simulator
field, that the cavity changes size *within* a beat rather than only between states, that
arrow count is monotonic in flow and zero at zero flow, that S4 draws a smaller LV than S3,
that every node claiming the anatomy surface maps to a drawable structure, that all paths are
well formed inside the unit box, and that the ECMO return runs geometrically opposite to
antegrade aortic flow rather than merely being labelled retrograde.

### Endovascular interior views

Press **I** in Explore for a view from inside the vessel (IABP or Impella; there is no VA-ECMO interior view), for pane B (the pane solo shows).
It is never part of a default view, does nothing in a resident session, and closes during
the demo. The code is in `src/endo/`; nothing existing was changed to draw it.

**IABP, from inside the aorta.** A cut-away with the viewer in the lumen: aortic valve,
root with both coronary ostia, arch, and the descending aorta with the balloon.

| drawn | driven by |
|---|---|
| balloon radius | `vBalloon` (cross-section ~ volume) |
| root / descending wall position | `pAo` / `pSa` (r ~ sqrt of stressed volume) — the diastolic rise is displacement, not a number |
| coronary inflow | the DPTI integrand, (P_Ao − P_LV)⁺ while LV activation < 0.1; arrow position from its running integral over the beat |
| valve leaflets, antegrade arrows | `qAortic`, positions from `state.cum.aortic` |
| root ↔ descending flow | `qRc` (negative = pushed back toward the ostia) |
| red balloon / red strip band | balloon > 2 mL while the valve is open — the mistiming made visible |

Under it, a one-cycle sweep on the same clock shows valve opening, balloon volume and
coronary drive, with the console's two timing references marked.

> **The "deflation reference" marker is the *unassisted* aortic-valve opening, and with a
> correctly timed balloon the valve opens *before* it. That is correct, not a bug.** The
> console captures both references from an unassisted beat (see `iabp.ts`). Once the
> balloon is working, pre-systolic deflation lowers aortic end-diastolic pressure
> (52.9 → 40.6 mmHg at S1), so the LV reaches aortic pressure sooner and the valve opens
> earlier than on the reference beat. The balloon is still fully deflated by then (E18:
> zero collision frames at correct timing). Do not "fix" the earlier opening, and do not
> move the marker to the assisted opening: the console times off the unassisted beat.

**Filming a mistimed beat.** In early inflation and late deflation the balloon and the
open valve overlap for about 20 ms, one frame at real time. Press **S** in the view for
**⅛× slow motion**: fewer 1 ms ticks per rendered frame, the same mechanism as time
compression run the other way, so the overlap lasts about ten frames at 60 fps. The tick
and the physiology are untouched (E18 checks the state is bit-identical to real time). A
therapy change still compresses time until it settles; slow motion resumes afterwards,
and closing the view returns to real time. The strip also holds the whole last cycle, so
the red overlap band stays on screen, and **Space** freezes the frame.

Validation **E18** asserts that every animated quantity names a real instantaneous
simulator field; balloon size is strictly monotonic in `vBalloon`; wall position is
strictly monotonic in pressure; coronary inflow is monotonic in the gradient and zero at
zero; the drawn gradient integrates to the reported DPTI within 2%; computing a frame
never touches the sim; correct timing and the four mistimings are pairwise different from
inside (≥ 12 px at 1080p); and each mistiming shows its own signature — early inflation
as an overlap at the *end* of ejection, late deflation at the *start*, late inflation as
a late-filling balloon after closure, early deflation as an empty balloon long before
opening.

**Impella, from inside the left ventricle.** A long-axis cut-away with the viewer in the
cavity: the pump crosses the aortic valve, inlet down in the chamber, outlet up in the
ascending aorta. Beside it, the same valve seen from below with the cannula through it,
over a one-cycle sweep of valve opening, pump flow and LV volume.

| drawn | driven by |
|---|---|
| endocardial wall | `vLv`, as distance from the viewer: cbrt(V) − cbrt(60 mL) |
| wall thickness | `vLv` with constant muscle volume (as E17) |
| inlet → cannula → outlet arrows | `qImpella`, one position from `state.cum.impella` along the whole path |
| native ejection, mitral inflow | `qAortic` / `qMitral`, positions from `state.cum` |
| leaflets, side-on and from below | `qAortic` |
| dashed outline | end-diastolic wall position of the reference loop captured at the last therapy change |

The camera volume (60 mL, fixed) is what makes unloading read as the walls closing in
around the viewer: walls are drawn at their distance from someone sitting in the middle
of the cavity, not from an empty centre. It is monotonic in volume and the same in every
state. At 1080p, S0 → S2 brings the end-diastolic walls in by 81 px, S3 → S4 by 29 px.

At **P5 (S4) the valve opens from below on every beat, but only for ~71 ms and to 44% of
full excursion** (136 ms and 72% at S3). "Intermittent" here means brief opening each
beat, not skipped beats. At P8 (S2, S5) it never opens, so the two levels look different
from below.

The from-below orifice is drawn outward from the cannula edge and grows as the square
root of the opening, so the P5 partial opening (44%) sits clear of the cannula instead of
behind it. Its size is schematic; its timing is exact.

> **Shooting note.** Two moments in these views are invisible at real time and must be
> filmed at **1/8x** (press **S** in the view): the late-deflation balloon/open-valve
> overlap (caught in 1 of 35 real-time frames) and the P5 valve opening from below (0 of 8).
> At 1/8x each is caught on every beat. Slow motion only changes ticks per frame, and E18
> checks that the state it reaches is bit-identical to real time.

E18 adds, for the Impella: fields are real; inlet flow monotonic in `qImpella`, zero at
zero; wall distance strictly monotonic in `vLv` with the wall thickening as it empties;
the closing-in is at least 60 px (S0 → S2) and 15 px (S3 → S4) at 1080p; the drawn
from-below opening matches the AV-open tile within 3 points; P5 opens every beat, more
briefly and less far than S3, and P8 never; frames never touch the sim and pumped volume
moves the arrows.

### Perfusion / unloading plane

Two axes a single number cannot express, plotted against each other so the divergence
between them becomes geometry:

- **X, systemic support** = mean of normalised MAP and normalised total systemic flow.
- **Y, ventricular unloading** = mean of normalised *inverse* LVEDP and normalised *inverse* PVA.

**Normalisation.** Both axes are 0-1 against fixed anchors, chosen from clinical reference
points and never fitted to the data being plotted, so a point means the same thing in every
session and two states are always comparable. Values outside the anchors clamp. Each axis is
the unweighted mean of its two components, so neither dominates.

| component | 0 maps to | 1 maps to |
|---|---:|---:|
| MAP | 50 mmHg (profound shock) | 90 mmHg (adequate) |
| Total systemic flow | 2.0 L/min (CI ~1.1) | 7.0 L/min (CI ~3.9) |
| LVEDP (inverted) | 35 mmHg (severe congestion) | 8 mmHg (normal) |
| PVA (inverted) | 9000 mmHg·mL (high O2 demand) | 3000 mmHg·mL (low) |

> **Educational visualisation, not a validated clinical score.** No threshold on this plane has
> any established meaning. It is not a target, a risk score, or a treatment indication. The app
> says so under the plot.

Where the five states land, and the claim the view exists to make:

| state | X | Y | |
|---|---:|---:|---|
| S0 shock | 0.25 | 0.58 | |
| S1 IABP | 0.34 | 0.74 | small move up and right |
| S2 Impella | 0.41 | 0.87 | up: unloads, perfusion barely moves |
| S3 VA-ECMO | **0.81** | **0.31** | **right and DOWN — perfusion bought at the ventricle's expense** |
| S4 ECpella | 0.88 | 0.45 | **up, without giving up X** |
| S5 weaned | 0.72 | 0.79 | further up, trading some X back |

The live point for each pane carries a fading trail drawn from that pane's own beat history
(120 beats, 72 s) rather than from any separate animation buffer, so during a transition the
trail traces the actual route: out to the right and down into S3, then back up to S4. A dashed
arrow connects pane A's point to pane B's, because that gap is the comparison.

Press **P** for a large overlay suitable for filming. Validation E12 asserts the geometry
directly — that S0->S3 is right and down, that S3->S4 is up and not left, that each axis
component moves its axis the correct way in isolation, that out-of-range values clamp, and
that the plane reads the same BeatMetrics fields the numeric tiles display.

### Causal engine

`src/causal/graph.ts` holds an explicit directed graph of model variables: 17 nodes and 22
typed edges. Each edge carries a sign (+1 = same direction, -1 = opposite) and a one-clause
mechanism string. It is a data structure, not prose, and there are no canned paragraphs
anywhere in the explanation path.

**The chain is derived, not looked up.** On "WHY?", `derivePath` reads the real before beat
(pane A) and after beat (pane B), works out which way each variable actually moved, and then
walks the graph breadth-first accepting only edges whose predicted direction matches the
observed one. The shortest consistent chain wins. If no consistent chain exists, the app says
so rather than inventing one.

So the same button produces different chains on different interventions, because the numbers
differ. On S0 -> S3 it yields:

    ECMO flow up 0.0 -> 4.0 L/min
      -> arterial volume up      (the circuit returns blood retrograde into the aorta)
      -> MAP up 62 -> 86 mmHg    (more volume in a compliant arterial tree raises its pressure)
      -> LV afterload up 53 -> 80 mmHg
      -> native SV down 30 -> 20 mL   (a weak ventricle ejects less against a higher pressure)
      -> LVEDV up 188 -> 215 mL  (blood not ejected stays in the ventricle)
      -> LVEDP up 20 -> 28 mmHg  (on a steep exponential EDPVR, a little more volume is a lot
                                  more pressure)

while on S3 -> S4 the same target yields the three-link chain
`Impella flow up -> LVEDV down -> LVEDP down`.

**Highlighting.** The walk takes ~1.5 s total (minimum 230 ms per link, so long chains stay
readable). At each step the active node lights up simultaneously on every surface it appears
on: the numeric tile, the pressure waveform (its traces stay at full strength while the rest
dim), the PV loop (the relevant feature is marked - the end-diastolic point, the stroke-volume
bracket, the enclosed area), and the device chips. Which surfaces a node touches is declared
on the node itself, so the graph stays the single source of truth. The anatomy layer is step 5
and plugs into the same `surfaces` field.

Controls: hover any of MAP, LVEDP, native SV or AV opening for a **WHY?** button, or press
**W** to step through the four in fixed order (deterministic, for the scripted demo).

### Demo mode

Press **D**. The scripted run sequences itself from start to finish with no further input and
stops on its own; **Esc** aborts it. While it runs the script owns the keyboard, and the
phenotype chip, disclaimer and mode toggle are hidden so the top bar does not wrap.

Two rules make it reproducible on camera, and both are enforced rather than hoped for:

1. **No step advances on wall-clock time.** Steps that follow an intervention wait for the
   engine's own settling test, and holds are measured in *cardiac beats*, not seconds. The run
   is therefore identical at any frame rate and at any time compression.
2. **No step depends on where the last take left off.** The run begins by loading a shipped
   steady state, which is bit-identical every time.

Time compression is part of the script rather than a key press: an intervention turns it on
and the settle gate turns it off.

The sequencing lives in `src/demo/runner.ts` as a plain object with no React in it, so the
harness drives the whole demo headlessly. Validation E15 asserts that two runs produce an
identical trace (same steps, same cardiac beats), that the trace is identical at 1× and at the
8× compressed rate, that the script reaches its end and stops by itself, that **every scripted
WHY fires only once both panes have settled**, that each one has a derivable chain at the
moment it fires, and that the script never starts an intervention while a chain is still
displayed — a chain left up across a transition would be narrating the previous one.

Measured: 15 steps, 145 s of simulated time, about 60 s of wall clock.

### Keys

| | |
|---|---|
| **1 – 6** | Select S0–S5. Pane B takes the new therapy, pane A continues the previous one. |
| **W** | Explain the next variable in turn: MAP, LVEDP, native SV, aortic-valve opening. |
| **P** | Perfusion / unloading plane, full screen. |
| **A** | Device / anatomy schematic, full screen. |
| **I** | Inside the vessel: the IABP from inside the aorta, or the Impella from inside the LV, for pane B. **S** toggles 1/8 slow motion while it is open. |
| **D** | Run the scripted demo. |
| **Space** | Pause / resume. |
| **Esc** | Stop the demo, or close an overlay. |
| **?** | Key list. |

### Time compression

An intervention takes about 40 s of simulated time to equilibrate, because the device ramp is
rate-limited and the baroreflex effector has an 8 s time constant. Four transitions of honest
settling is roughly three minutes — most of a 3-5 minute video — and cutting it in the edit
would make the tiles jump.

So a therapy change automatically **steps more 1 ms ticks per rendered frame** (8x) until both
panes settle, then drops back to real time by itself. While it is active the top bar carries a
large badge reading *8x TIME COMPRESSED — equilibrating · physiology unchanged*.

**No physiologic time constant is shortened.** The tick stays 1 ms, the tick *sequence* is
unchanged, and only the number of ticks per frame moves; settling is not shortened, merely
watched at a faster wall-clock rate. Measured: 42.7 s of simulated settling in 5.4 s of wall
clock.

Validation E14 proves this rather than asserting it. The same 120 s of simulated time was run
chunked at 1, 17, 67, 133, 267 and 800 ticks per frame (0.06x to 48x): **bit-identical final
state and identical beat hashes at every rate**, same beat count, max ΔMAP across rates
exactly 0. E14 also checks that compression starts on an intervention and ends by itself, and
that every shipped snapshot is genuinely converged — the engine declares snapshots settled on
load, and that claim has to be true.

Throughput: 26.6 µs per tick for both panes, so 8x uses about 21% of a 60 fps frame budget.

The resident session uses the same mechanism: the reveal now waits for the panes to **settle**
rather than for a fixed duration, so a learner is never shown a transient as if it were the
answer.

**Live numbers, and equilibration.** The path *structure* is fixed when the chain is
derived; the *numbers* are re-read from the live pane metrics on every render, through the
same formatter the numeric tiles use. The ribbon and the tiles are therefore two views of one
number and cannot disagree in a freeze-frame — validation E11 asserts this as a
byte-for-byte identity, not a tolerance.

Interventions take time to equilibrate: the device ramp is rate-limited and the baroreflex
effector has an 8 s time constant, so S0 -> S3 needs about 40 s to settle and MAP *overshoots*
to 88 mmHg around t = 10 s before falling back to 81. A chain read during that window is a
transient, so each pane runs a beat-to-beat stability test (headline metrics compared five
beats apart, stable for five consecutive evaluations) and the ribbon shows a **still
equilibrating** badge until it passes. Thresholds are calibrated so the badge clears when
every metric is within 1% of its true steady state; measured worst case across the four
canonical transitions is 0.62%, firing at 28-41 s. If a link's live direction momentarily
reverses while the system equilibrates, that link is marked rather than quietly re-drawn.

**Validation E10** re-derives the chain for all four targets on four canonical transitions and
fails the build if any narrated step contradicts what its metric actually did. At most one
link per chain may be an unobservable intermediate, and it must appear on an explicit
whitelist (`UNOBSERVABLE_ALLOWED`, currently just arterial volume). A new node with no metric
fails the build rather than silently consuming that allowance, and a whitelisted node that
later gains a metric fails too, so the list cannot go stale.

### Where S3's 6.3 L/min comes from

Total systemic flow at S3 is high, and it decomposes exactly:

| | L/min |
|---|---:|
| Native ejection across the aortic valve (SV 22.6 mL x 100 bpm) | 2.26 |
| VA-ECMO circuit | 4.00 |
| Impella | 0.00 |
| **Reported total** | **6.26** |
| of which through SVR | 6.15 |
| of which bronchial/Thebesian shunt (bypasses SVR, returns to LA) | 0.10 |

Cardiac index 3.5 L/min/m2 at an assumed BSA of 1.8. Ohm's law closes on the reflex's own
resistance: mean P_SA 79.1 - mean P_SV 12.2 over 6.15 L/min gives 10.87 Wood units against a
reflex SVR state of 10.87 WU, a 0.006% discrepancy. Validation E9 checks all of this on every
run, so the decomposition cannot silently drift.

**Why it is supranormal, and the answer to give if asked.** It is arithmetically forced: a
4 L/min circuit running on top of a ventricle still ejecting 2.3 L/min totals 6.3, and
nothing else is going on. S3 is deliberately *full circuit support before weaning* - which is
the state in which LV distension happens, and therefore the state worth teaching. Clinically
you would wean the circuit, which is exactly what S5 does.

**The soft spot, stated plainly.** Native ejection is better preserved here (2.98 -> 2.26,
-24%) than in many real patients on full flow, because the reflex drops SVR from 15.8 to
10.9 Wood units and that partly shields the ventricle from the afterload rise. With the
reflex disabled the same patient falls to 1.53 L/min. A real shocked patient on
catecholamines sits somewhere between: more vasoconstricted than this reflex allows, so less
native output and more distension. The gain here is a modelling choice, and this is the
optimistic end of the plausible range.

### Baroreflex

An arterial baroreflex acts on systemic vascular resistance:

    SVR_target(P) = SVRmin + (SVRmax - SVRmin) / (1 + exp((P - setpoint)/k))

with a 2 s baroreceptor sensing lag and an 8 s vascular effector lag, integrated on the same
fixed 1 ms tick as everything else. Setpoint 68 mmHg, k = 12 mmHg, SVR bounded to
0.45-1.25 mmHg*s/mL (7.5-20.8 Wood units).

**Why it exists.** Without it, resistance is fixed, so every litre of added circuit flow
turns directly into pressure. VA-ECMO at 4 L/min produced MAP 99, and ECMO 4 + Impella P8
produced MAP 117 - numbers no shocked patient has.

**How it is calibrated.** The setpoint was chosen so the reflex output at the unsupported
operating point *reproduces the SVR the open-loop model was already calibrated with*
(~16 Wood units). That is the physiologically meaningful reading of a shocked patient's high
SVR: it is the reflex, already near maximal constriction. Support then unloads the reflex.
S0 is therefore unchanged by adding it (MAP 62.2 -> 61.9, LVEDP 20.1 -> 20.0), and nothing
downstream had to be re-tuned to accommodate it.

**Is it compensating for something, or fixing it?** Fixing it. Across a setpoint sweep from
66 to 78 mmHg the ratio dLVEDP/dMAP stayed at 0.339-0.347 - the same 0.35 measured in the
open-loop model. The reflex shrinks the pressure excursion; LVEDP then follows the same
unchanged relationship. Had the ratio moved, the reflex would have been papering over the
ventricular mechanics instead.

| | open loop | with reflex |
|---|---:|---:|
| S0 MAP / LVEDP | 62.2 / 20.1 | 61.9 / 20.0 |
| S3 MAP / LVEDP | 98.7 / 33.0 | 81.0 / 26.5 |
| dMAP / dLVEDP | +36.5 / +12.9 | **+19.1 / +6.5** |
| SVR at S3 | 16.0 WU (fixed) | 10.9 WU |

**What it deliberately leaves out**, each for a reason rather than by omission:

- **Heart rate - a design constraint, not an omission.** Baroreflex tachycardia is real, and
  it is left out for a structural reason. The two panes sit at different pressures, so a
  pressure-dependent heart rate would give them different beat lengths. They would drift out
  of phase within seconds, and the shared cardiac clock is the thing the entire twin-pane
  comparison rests on: both panes advance by the same integer number of 1 ms ticks, so the
  same point in the cardiac cycle is on screen in both at every frame. Lose that and the
  waveforms, the PV loops and the beat-aligned delta panel stop being comparable - the
  learner could no longer tell whether a difference between panes came from the therapy or
  from the two hearts being at different points in their beat. A constant heart rate is the
  price of the comparison, and it is worth it. It also means every per-beat number in the
  app is a like-for-like comparison at identical cycle length.
- **Contractility.** Ees defines this patient's phenotype and is displayed in the app; a
  reflex moving it would make that label unstable.
- **Pulsatility sensing.** Real baroreceptors fire on the pulsatile component, so the loss of
  pulse pressure on full VA-ECMO is itself a constrictor stimulus. Omitted - it would push
  SVR the other way and is not needed for anything taught here.
- **Venous tone and unstressed-volume recruitment.**

Reflex gain in cardiogenic shock is variable and often blunted, particularly after
catecholamines. The gain here is a modelling choice, not a measurement. `baroEnabled: false`
restores the open-loop behaviour for comparison.

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

1. **The demo's ECpella state uses Impella P5, not P8.** At P8 in this phenotype the pump
   takes over ejection completely: native SV and aortic-valve opening both go to zero. That
   is correct, but on camera the S3 -> S4 transition then reads as the pump having arrested
   the heart rather than unloaded it. P5 keeps the valve intermittently opening (23% -> 12%
   of the cycle) and native SV non-zero (23 -> 5 mL) while still reversing more than half the
   ECMO-induced LVEDP rise. The trade-off is real and is a genuine choice, not a fix, so P8
   stays selectable in Explore and is what S5 uses:

   | Impella level (ECMO held at 4) | LVEDP | change vs S3 | AV open | native SV |
   |---:|---:|---:|---:|---:|
   | none (S3) | 26.5 | - | 23% | 23 mL |
   | P4 | 23.7 | -2.8 | 15% | 8 |
   | **P5 (demo)** | **22.8** | **-3.7** | **12%** | **5** |
   | P6 | 21.7 | -4.8 | 7% | 2 |
   | P7 | 19.5 | -7.0 | 0% | 0 |
   | P8 | 16.3 | -10.2 | 0% | 0 |

   P8 tells the stronger unloading story (LVEDP ends *below* the unsupported baseline of 20);
   P5 tells the more legible one. Switch by changing `IMPELLA_ECPELLA_LEVEL`.
2. **IABP E6 checks assert each mistiming's textbook signature**, not the spec's blanket "correct timing → higher DPTI and lower stroke work than early inflation". Early inflation cuts SV, so stroke work (loop area) falls rather than rises. The O₂-demand index is PVA. The spec-literal lines are still reported as non-gating notes.
3. **One pre-specified textbook expectation is still not reproduced, and is reported as a divergence rather than hidden.** Late deflation gives native SV about 2% *higher* than correct timing instead of lower; the raised aortic end-diastolic pressure and raised PVA are reproduced, but the balloon finishes deflating during early ejection and draws blood out of the LV. It was reclassified *after* the numbers were seen and the report says so. A second divergence (early inflation giving slightly lower PVA) was resolved by the Task D recalibration and is a gating check again.

### Known limitations

Baroreflex acts on SVR only. Heart rate is held constant by design, because a pressure-dependent HR would desynchronise the two panes' cardiac clocks and break the comparison the app exists to make (see Baroreflex above). No local autoregulation. No drugs (by design). The RV is minimal. No aortic regurgitation or watershed/mixing zone. Impella and ECMO curves are illustrative. No inertance, so there is no dicrotic notch *on the trace*, although AV closure is exact in the state. The IABP timing reference falls back to defaults if the balloon is armed while the AV is not opening.

---

## Internal implementation sanity checks (`npm run validate`)

**These are internal implementation sanity checks, NOT validation against clinical data.** They confirm that the model moves in the directions its equations should produce, never enters an impossible state, and agrees with the hand-keyed answers.

- **E1** Baseline lands inside the shock design targets, with Ea/Ees in 2.5-5, diastolic stiffness in 0.15-0.40 mmHg/mL, and the declared phenotype matching the shipped parameters.
- **E2** ECMO ramp 0→4: native SV↓, LVEDP↑, LVEDV↑, AV-open↓, MAP↑, total flow↑, PVA↑, all strictly monotone.
- **E3** Impella P0→P8: LVEDP↓, LVEDV↓, PVA↓, pump flow↑, total flow↑, native SV↓.
- **E4** ECMO 4 + Impella ramp: LVEDP↓ strictly, endpoint below the E2 endpoint.
- **E5** IABP on vs off: augmentation↑, AoEDP↓, DPTI↑, SV↑, LVEDP↓, PVA↓. In 1:2, assisted systole < unassisted systole and assisted AoEDP < unassisted AoEDP.
- **E6** Correct timing vs each of the four mistimings, using each one's textbook signature.
- **E18** The interior views read only simulator state; balloon, wall and coronary inflow are monotonic in their fields; the coronary drive is the DPTI integrand; each IABP mistiming is visibly and distinctively different from inside; the LV walls close in visibly with unloading and the valve seen from below opens exactly as often as the AV-open tile says; slow motion is bit-identical to real time.
- **E15** The scripted demo produces an identical trace on every run and at every rate, finishes by itself, fires each WHY only once both panes have settled, and never starts an intervention with a chain still on screen.
- **E14** Time compression is bit-identical at every supported rate; it starts on an intervention and ends by itself; shipped snapshots are genuinely converged.
- **E13** The anatomy layer reads only instantaneous simulator fields; the cavity pulsates within a beat; arrow count is monotonic in flow; S4 draws a smaller LV than S3; every anatomy-surfaced node maps to a structure; paths are normalised; the ECMO return is geometrically retrograde.
- **E12** The perfusion/unloading plane's geometry: S0->S3 right and down, S3->S4 up and not left, per-axis monotonicity, clamping, fixed anchors, and shared fields with the tiles.
- **E11** Every mapped node and its numeric tile read the same field; every value the WHY ribbon renders is byte-identical to the tile for that pane.
- **E10** Every WHY target exists in the graph; the graph is structurally sound; and on four canonical transitions the derived chain for each target contradicts no metric.
- **E9** Total systemic flow decomposes exactly into native + Impella + ECMO; arterial inflow balances SVR outflow plus bronchial shunt; Ohm's law closes on the reflex's own SVR; the shunt stays under 5% of systemic flow.
- **E7** The simulator agrees with the answer key for every active item, and retired items are excluded from the learner-facing bank.
- **E8** The stroke-work response to VA-ECMO changes sign with contractility, reconciling this model with Ostadal 2015; native SV and AV opening fall at every phenotype; the shipped patient is the afterload-dominant one.
- **Every tick of every run:** no NaN/Inf, no negative volume, no P_LV > P_Ao while the AV is flagged closed, volume conserved, slew limits respected. Beat-to-beat continuity is checked during every ramp.
- **Determinism:** two identical runs hash identically, lockstepped clones stay bit-identical, and the shipped snapshots equal a fresh recomputation.

Current result: see `validation/report.md`.
