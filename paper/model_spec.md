# CardioFlow Twin: model specification (extracted from source)

Branch `paper/asaio-verification`, model source at commit `a472db9` (the last commit touching `src/model/` is `6d74829`, 2026-09-24).
The source is the authority. Every value below was read from the file and line given. Nothing comes from the earlier manuscript.

Internal units (`src/model/types.ts:1-8`): pressure mmHg, volume mL, flow mL/s, resistance mmHg·s/mL, compliance mL/mmHg, elastance mmHg/mL, time in ms (clock) and s (physics). Displayed L/min = mL/s × 0.06.

---

## 1. Topology

`src/model/sim.ts:10-16`:

```
PV(LA) -mitral-> LV -aortic valve-> AO -Rc-> SA -Rsvr-> SV -tricuspid-> RV -pulmonic-> PA -Rpvr-> PV
                   \--- Impella ----/         ^  \                |
                                              |   \--bronchial--> PV
                                              +---- ECMO <--------+
IABP balloon occupies volume inside SA.
```

There are seven volume states: LV, RV, AO (proximal aortic root), SA (systemic arteries, the Windkessel C), SV (systemic veins), PA (pulmonary arteries) and PV (pulmonary veins and LA, lumped). The LV and RV volumes are absolute. Vessel volumes are **stressed** volumes, so $P = V/C$ with no unstressed term.

## 2. State variables

| Symbol | Meaning | Integrated by | Code |
|---|---|---|---|
| $V_{LV},V_{RV},V_{Ao},V_{SA},V_{SV},V_{PA},V_{PV}$ | compartment volumes | RK4 | `sim.ts:51,103-109` |
| $\int Q_{AV}, \int Q_{imp}, \int Q_{ECMO}$, SW, DPTI, $\int P_{Ao}$, AV-open time, $\int P_{PV}$, $\int P_{SV}$, $\int P_{PA}$, $\int SVR$ | per-beat integrals, reset at each beat close | RK4 (same step) | `sim.ts:52-54,111-121,474` |
| $\hat P$ (`baroSensed`) | sensed arterial pressure | forward Euler, 1 ms | `sim.ts:320-322` |
| $R_{SVR}$ (`svr`) | reflex effector SVR | forward Euler, 1 ms | `sim.ts:323-324` |
| actuator positions: balloon fill, IABP timing offsets, Impella level, ECMO flow | rate-limited ramps | per tick | `sim.ts:305-311` |
| IABP notch / AV-opening references | captured once from an unassisted beat | event | `sim.ts:422-426` |

## 3. Equations

### 3.1 Ventricles (time-varying elastance), `ventricle.ts`

$$
P(V,t) = a(t)\,E_{es}\,(V - V_0) + \bigl(1 - a(t)\bigr)\,A\left(e^{B(V - V_{0,ed})} - 1\right) \tag{1}
$$

(`ventricle.ts:50-61`). The exponent is clamped at 12 (`ventricle.ts:46-48`). The LV has separate ESPVR and EDPVR intercepts ($V_0 = 40$, $V_{0,ed} = 53$). The **RV uses one intercept for both** ($V_{0,ed} = V_0 = 15$, `sim.ts:82`).

Activation is a normalized double-Hill function (Stergiopulos form):

$$
\tilde a(\phi) = \frac{(\phi s/\alpha_1)^{n_1}}{1 + (\phi s/\alpha_1)^{n_1}} \cdot \frac{1}{1 + (\phi s/\alpha_2)^{n_2}}, \qquad
a(t) = \frac{\tilde a(t/T)}{\max_\phi \tilde a(\phi)} \tag{2}
$$

$$
s = \mathrm{clamp}\!\left(\sqrt{800/T_{ms}},\,0.6,\,1.9\right)\cdot \texttt{actScale} \tag{3}
$$

(`ventricle.ts:10-44`). The peak is found numerically on a 4001-point grid and cached (`ventricle.ts:28-38`). The LV and RV share the same $a(t)$. There is **no separate atrial activation**.

### 3.2 Pressures, `sim.ts:81-87`

$$
P_{Ao} = \frac{V_{Ao}}{C_{Ao}},\quad P_{SA} = \frac{V_{SA} + V_b(t)}{C_{SA}},\quad P_{SV} = \frac{V_{SV}}{C_{SV}},\quad P_{PA} = \frac{V_{PA}}{C_{PA}},\quad P_{PV} = \frac{V_{PV}}{C_{PV}} \tag{4}
$$

$V_b(t)$ is the IABP balloon volume (§3.6).

### 3.3 Flows, `sim.ts:89-100`

The valves are ideal diodes (open if and only if upstream > downstream), each with a forward resistance:

$$
Q_{MV} = \frac{[P_{PV} - P_{LV}]^+}{R_{MV}},\; Q_{AV} = \frac{[P_{LV} - P_{Ao}]^+}{R_{AV}},\; Q_{TV} = \frac{[P_{SV} - P_{RV}]^+}{R_{TV}},\; Q_{PV} = \frac{[P_{RV} - P_{PA}]^+}{R_{PuV}} \tag{5}
$$

$$
Q_{Rc} = \frac{P_{Ao} - P_{SA}}{R_c},\quad Q_{SVR} = \frac{P_{SA} - P_{SV}}{R_{SVR}(t)},\quad Q_{PVR} = \frac{P_{PA} - P_{PV}}{R_{PVR}},\quad Q_{br} = \frac{P_{SA} - P_{PV}}{R_{br}} \tag{6}
$$

### 3.4 Volume balance, `sim.ts:103-109`

$$
\begin{aligned}
\dot V_{LV} &= Q_{MV} - Q_{AV} - Q_{imp} &\quad \dot V_{Ao} &= Q_{AV} + Q_{imp} - Q_{Rc}\\
\dot V_{SA} &= Q_{Rc} + Q_{ECMO} - Q_{SVR} - Q_{br} &\quad \dot V_{SV} &= Q_{SVR} - Q_{TV} - Q_{ECMO}\\
\dot V_{RV} &= Q_{TV} - Q_{PV} &\quad \dot V_{PA} &= Q_{PV} - Q_{PVR}\\
\dot V_{PV} &= Q_{PVR} + Q_{br} - Q_{MV}
\end{aligned} \tag{7}
$$

The right-hand sides sum to zero identically, so total volume is conserved by construction (V1c tests it numerically).

### 3.5 Baroreflex on SVR, `baroreflex.ts:41-48`, `sim.ts:317-324`

$$
R^{*}(\hat P) = R_{min} + \frac{R_{max} - R_{min}}{1 + e^{(\hat P - P_{set})/k}} \tag{8}
$$

$$
\dot{\hat P} = \frac{P_{Ao} - \hat P}{\tau_s},\qquad \dot R_{SVR} = \frac{R^{*}(\hat P) - R_{SVR}}{\tau_e} \tag{9}
$$

These are integrated by forward Euler once per 1 ms tick, before the RK4 step. $R_{SVR}$ is held constant within the tick. The exponent is clamped to ±40. The sensed input is the proximal aortic pressure $P_{Ao}$. $\hat P$ is initialized to $P_{Ao}$ on the first tick. With `baroEnabled=false`, $R^* = R_{SVR,0}$ (`rSvr`).

### 3.6 IABP, `devices/iabp.ts`

The balloon displaces volume in SA (Eq. 4). It adds or removes no blood.

$$
\sigma(x) = \mathrm{clamp}(x,0,1)^2\,\bigl(3 - 2\,\mathrm{clamp}(x,0,1)\bigr) \tag{10}
$$

$$
\pi(u) = \sigma\!\left(\frac{u - t_i}{T_{inf}}\right)\left[1 - \sigma\!\left(\frac{u - t_d}{T_{def}}\right)\right] \text{ (0 before inflation onset)} \tag{11}
$$

$$
t_i = t_{notch} + \Delta_i,\qquad t_d = \max\!\left(T + t_{open} - L - T_{def} + \Delta_d,\; t_i + T_{inf}\right) \tag{12}
$$

$$
V_b(u) = V_{bal}\cdot f\cdot \min\bigl(\pi(u)\,\chi_{this} + \pi(u + T)\,\chi_{prev},\;1\bigr) \tag{13}
$$

(`iabp.ts:39-74`). $t_{notch}$ and $t_{open}$ are the AV closure and opening times captured from the **last unassisted beat** when the balloon is armed, then held (`sim.ts:422-426`). If the AV did not open on that beat, they fall back to 0.4T and 0.1T (`iabp.ts:26-27`). $f$ is the rate-limited fill fraction. $\chi$ selects 1:1 or 1:2 assist.

### 3.7 Impella (trans-aortic axial pump), `devices/impella.ts`

$$
H_0(\ell) = H_{max}\left(0.5 + 0.5\,\frac{\mathrm{clamp}(\ell,1,9)}{9}\right)^2 \tag{14}
$$

$$
Q_{imp} = \max\!\left(0,\frac{H_0(\ell) - (P_{Ao} - P_{LV})}{K}\right)\cdot \min(\ell,1)\cdot \sigma\!\left(\frac{V_{LV} - V_0 - S_{end}}{S_{start} - S_{end}}\right) \tag{15}
$$

(`impella.ts:27-46`). The inlet is in the LV and the outlet is in the AO node. Flow is **never negative**, so retrograde pump flow is not modeled. Suction is flagged when the roll-off factor is < 0.95 while $Q_{H\text{-}Q} > 1$ mL/s. The source states the curve is illustrative, not a manufacturer H-Q curve (`impella.ts:16-19`).

### 3.8 VA-ECMO, `devices/ecmo.ts`

$$
Q_{ECMO} = \frac{F_{cmd}}{0.06}\cdot \sigma\!\left(\frac{P_{SV} - P_{d0}}{P_{d1} - P_{d0}}\right) \tag{16}
$$

(`ecmo.ts:22-28`). This is an **ideal flow source**. It drains SV and returns into SA, the single systemic arterial compartment (the "descending aorta"). There is no centrifugal-pump H-Q curve: delivered flow does **not** depend on arterial pressure, only on the venous drainage roll-off. The drainage-limited flag is raised when the roll-off factor is < 0.97. Circuit and oxygenator volume are not represented.

### 3.9 ECpella

ECpella is Eqs. 15 and 16 active together. There is no special-case code.

### 3.10 Actuator slew, `constants.ts:18-23`, `sim.ts:139-143,305-311`

Commanded settings never enter the physics directly. Each actuator ramps toward its command at a fixed rate:

| Actuator | Rate |
|---|---|
| IABP fill | 0.5 per s |
| IABP timing offsets | 120 ms per s |
| Impella level | 1.5 levels per s |
| ECMO flow | 0.6 L/min per s |

## 4. Integration scheme

- **Clock.** Integer 1 ms ticks (`TICK_MS`, `constants.ts:6`). The beat length is `round(60000/HR)` ticks (`sim.ts:182`). At HR 100 that is exactly 600 ticks per beat.
- **ODE solver.** Classical fixed-step RK4 with `SUBSTEPS = 4` per tick, so h = 0.25 ms (`constants.ts:8`, `sim.ts:329-345`). The baroreflex SVR, actuator positions and IABP references are frozen within a tick. Activation is evaluated at the exact substep times.
- **Per-tick order** (`sim.ts:300-367`): (1) slew the actuators; (1b) Euler-update the baroreflex; (2) sample the state and fold it into the beat extrema; (3) take the RK4 step; (3b) update the animation counters; (4) advance the clock and close the beat at the boundary.
- **No adaptive step and no wall-clock input.** Results are deterministic within one JS engine. Across engines they agree to about 4×10⁻¹⁴ relative (Node 24 vs Chrome 157, `paper/results/p0_equivalence.json`).
- **Discontinuities.** The diode valves make the RHS non-smooth, and RK4 steps across the switching instants without event location.

## 5. Per-beat outputs (definitions), `sim.ts:373-478`

| Output | Definition |
|---|---|
| LVEDP, LVEDV | $P_{LV}$ and $V_{LV}$ at the first tick of the beat (activation onset) |
| LVESV, LVESP | the 1 ms sample maximizing $P_{LV}/(V_{LV}-V_0)$ (requires $V - V_0 > 2$) |
| EF | $(EDV - V_{min})/EDV$. **Uses the beat minimum volume, not LVESV**, so EF ≠ (EDV−ESV)/EDV in general |
| Native SV | $\int Q_{AV}\,dt$ over the beat |
| MAP | beat-mean $P_{Ao}$ (proximal aortic node) |
| SBP | max $P_{Ao}$ while activation ≥ 0.1 |
| DBP | min $P_{Ao}$ over the beat |
| Total flow | native + Impella + ECMO (beat means, L/min) |
| LAP (PCWP-equivalent) | beat-mean $P_{PV}$ |
| RAP | beat-mean $P_{SV}$ |
| SVR | beat-mean reflex $R_{SVR}$ (Wood units × 16.6667) |
| SW | $-\oint P_{LV}\,dV_{LV}$, integrated inside RK4 |
| PE | $\tfrac12 P_{es}(V_{es}-V_0) - \int_{V_{0,ed}}^{V_{es}} EDPVR$, floored at 0 |
| PVA | SW + PE |
| DPTI | $\int [P_{Ao} - P_{LV}]^+ dt$ while activation < 0.1 (mmHg·s per beat) |
| AV open fraction | (time with $Q_{AV}>0$)/T. The raw value is reported here; the UI shows an EMA with α = 0.35 |

## 6. Parameters, shipped patient (`src/model/patient.ts`, `SHOCK_PATIENT`)

The source comment (`patient.ts:1-7`) says the values are "internal choices tuned so the unsupported state lands in a textbook SCAI C–D cardiogenic-shock hemodynamic profile … NOT fitted to any patient or dataset." **However, the LV EDPVR and Ees were recalibrated (Task D, commit `8769c12`) against two literature anchors: Donker 2019 (+10% EDV for +5 mmHg PCWP at 4 L/min) and Ostadal 2015 (stroke-work direction). See `patient.ts:52-56` and the README section "LV afterload response calibration".** Those anchors therefore cannot serve as independent benchmarks (see the verification report, §V3).

| Parameter | Symbol | Value | Units | Code |
|---|---|---:|---|---|
| Heart rate | HR | 100 | bpm | patient.ts:45 |
| LV end-systolic elastance | $E_{es,LV}$ | 0.62 | mmHg/mL | patient.ts:49 |
| LV ESPVR volume intercept | $V_{0,LV}$ | 40 | mL | patient.ts:51 |
| LV EDPVR scale | $A_{LV}$ | 8.0 | mmHg | patient.ts:57 |
| LV EDPVR stiffness | $B_{LV}$ | 0.0093 | 1/mL | patient.ts:58 |
| LV EDPVR volume intercept | $V_{0,ed,LV}$ | 53 | mL | patient.ts:60 |
| Activation time-scale multiplier | actScale | 1 | – | patient.ts:62 |
| RV end-systolic elastance | $E_{es,RV}$ | 0.8 | mmHg/mL | patient.ts:64 |
| RV volume intercept (ESPVR and EDPVR) | $V_{0,RV}$ | 15 | mL | patient.ts:65 |
| RV EDPVR scale | $A_{RV}$ | 0.3 | mmHg | patient.ts:66 |
| RV EDPVR stiffness | $B_{RV}$ | 0.06 | 1/mL | patient.ts:67 |
| Mitral forward resistance | $R_{MV}$ | 0.005 | mmHg·s/mL | patient.ts:69 |
| Aortic forward resistance | $R_{AV}$ | 0.006 | mmHg·s/mL | patient.ts:70 |
| Tricuspid forward resistance | $R_{TV}$ | 0.004 | mmHg·s/mL | patient.ts:71 |
| Pulmonic forward resistance | $R_{PuV}$ | 0.004 | mmHg·s/mL | patient.ts:72 |
| Baroreflex enabled | – | true | – | patient.ts:78 |
| Baroreflex setpoint | $P_{set}$ | 68 | mmHg | patient.ts:79 |
| Baroreflex sigmoid width | $k$ | 12 | mmHg | patient.ts:80 |
| SVR lower bound | $R_{min}$ | 0.45 | mmHg·s/mL | patient.ts:81 |
| SVR upper bound | $R_{max}$ | 1.25 | mmHg·s/mL | patient.ts:82 |
| Baroreceptor sensing lag | $\tau_s$ | 2 | s | patient.ts:83 |
| Vascular effector lag | $\tau_e$ | 8 | s | patient.ts:84 |
| Proximal aortic compliance | $C_{Ao}$ | 0.2 | mL/mmHg | patient.ts:86 |
| Characteristic impedance | $R_c$ | 0.05 | mmHg·s/mL | patient.ts:87 |
| Systemic arterial compliance | $C_{SA}$ | 1.3 | mL/mmHg | patient.ts:88 |
| Initial SVR (open-loop SVR if reflex off) | $R_{SVR,0}$ | 0.96 | mmHg·s/mL | patient.ts:89 |
| Systemic venous compliance | $C_{SV}$ | 120 | mL/mmHg | patient.ts:91 |
| Pulmonary arterial compliance | $C_{PA}$ | 3.5 | mL/mmHg | patient.ts:93 |
| Pulmonary vascular resistance | $R_{PVR}$ | 0.1 | mmHg·s/mL | patient.ts:94 |
| Pulmonary venous + LA compliance | $C_{PV}$ | 12 | mL/mmHg | patient.ts:95 |
| Bronchial/Thebesian resistance | $R_{br}$ | 30 | mmHg·s/mL | patient.ts:97 |
| Initial volumes LV, RV, Ao, SA, SV, PA, PV | $V(0)$ | 185, 120, 12, 80, 1500, 100, 290 (sum 2287, conserved) | mL | patient.ts:99 |

Activation constants (`ventricle.ts:10-14`): $\alpha_1 = 0.303$, $\alpha_2 = 0.508$, $n_1 = 1.32$, $n_2 = 21.9$, reference cycle 800 ms, scale clamp [0.6, 1.9] (`ventricle.ts:25`).

Device constants:

| Parameter | Value | Units | Code |
|---|---:|---|---|
| Impella shut-off head at P9, $H_{max}$ | 200 | mmHg | impella.ts:21 |
| Impella H-Q slope, $K$ | 2.2 | mmHg per mL/s | impella.ts:22 |
| Suction roll-off start, $S_{start}$ | $V_0$ + 45 | mL | impella.ts:24 |
| Suction roll-off end, $S_{end}$ | $V_0$ + 5 | mL | impella.ts:25 |
| ECMO drainage zero-flow pressure, $P_{d0}$ | 0.5 | mmHg | ecmo.ts:14 |
| ECMO drainage full-flow pressure, $P_{d1}$ | 3.5 | mmHg | ecmo.ts:15 |
| IABP balloon volume, $V_{bal}$ | 40 | mL | iabp.ts:21 |
| IABP inflation duration, $T_{inf}$ | 60 | ms | iabp.ts:22 |
| IABP deflation duration, $T_{def}$ | 50 | ms | iabp.ts:23 |
| IABP deflation lead before AV opening, $L$ | 20 | ms | iabp.ts:24 |
| IABP fallback notch / opening fractions | 0.4 / 0.1 | of T | iabp.ts:26-27 |
| IABP mistiming offsets (inflate, deflate) | early infl. (−70, 0); late infl. (+90, 0); early defl. (0, −170); late defl. (0, +70) | ms | iabp.ts:30-36 |

Named therapy states (`therapyStates.ts`):

| State | Settings |
|---|---|
| S0 | no support |
| S1 | IABP 1:1 |
| S2 | Impella P8 |
| S3 | VA-ECMO 4 L/min |
| S4 | VA-ECMO 4 + Impella P5 (one variable differs from S3) |
| S5 | VA-ECMO 2 + Impella P8 |

Steady-state recipe (`steadyStates.ts:292-302`): 90 s unsupported from $V(0)$, then 120 s on the target settings.

## 7. Physiology that is missing or simplified (for Limitations)

Each item below was confirmed in the code:

1. **Heart rate is fixed.** There is no chronotropic reflex. This is a deliberate design choice so both panes share one integer cardiac clock (`baroreflex.ts:20-23`).
2. **The baroreflex acts on SVR only.** There is no contractility, venous-tone or unstressed-volume control and no pulsatility sensing (`baroreflex.ts:19-33`). Its gain is a modeling choice. With the reflex off, the S3 results change substantially (README "Baroreflex"; V4 open-loop arm).
3. **No atrial contraction.** The LA is lumped with the pulmonary veins as one passive compliance ($C_{PV}$), so there is no atrial kick.
4. **The RV is minimal.** It has one intercept for ESPVR and EDPVR. There is no RV failure phenotype and no ventricular interdependence (septal or pericardial).
5. **No inertance.** There is no dicrotic notch on the pressure trace and no flow-acceleration effects.
6. **Ideal diode valves.** There is no regurgitation, so aortic regurgitation under ECMO or Impella cannot be represented.
7. **No coronary circulation.** DPTI is a perfusion-pressure surrogate. There is no myocardial O₂ supply–demand coupling back to contractility.
8. **No gas exchange or oxygenation.** There is no differential hypoxia (North–South syndrome) and no mixing or watershed zone. The ECMO return enters one lumped arterial compartment.
9. **ECMO is an ideal flow source.** There is no centrifugal-pump pressure–flow curve, so delivered flow does not fall with rising afterload. There is no circuit volume and no cannula resistance beyond the drainage roll-off.
10. **The Impella H-Q line is illustrative.** It is linear in ΔP and has no retrograde flow at low speed.
11. **The IABP is a volume displacement in one lumped arterial compartment.** There is no spatial wave propagation and no coronary flow augmentation beyond the DPTI surrogate. The timing references are captured once from an unassisted beat.
12. **No LV venting device** (surgical, atrial septostomy or transaortic vent) is implemented. "Unloading" is available only as IABP or Impella.
13. **No autoregulation and no drugs** (inotropes or vasopressors).
14. **No cerebral, renal or other regional circulations.** The systemic bed is one SVR.
15. **One patient, and no normal-physiology calibration.** There is a single phenotype (afterload-dominant LV failure, Ees 0.62, Ea/Ees ≈ 4). No normal-physiology parameter set exists or was calibrated, so V2 verifies the shock baseline only (author decision 2026-11-14).
16. **EF under pump support.** The simulator's internal `ef` (`sim.ts:450`, (EDV − Vmin)/EDV) counts Impella outflow. The paper uses EF_native = native SV/EDV as its EF and reports the internal value only as the "LV emptying fraction" (`paper/runner/core.ts`, `efMetrics`).
