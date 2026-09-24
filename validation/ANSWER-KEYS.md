# Answer-key sign-off

**For cardiologist review.** Every row is one item a resident is scored on. Generated from
`src/assessment/itemBank.ts` by `npm run keytable` — this table and the shipped bank cannot diverge.

The simulator never supplies these answers. They are keyed by hand here, and validation check E7
fails the build if the simulator ever disagrees with a key.

**9 active items** (shown to learners and scored) · **1 retired** (never shown, kept for the record).

Please mark each row **agree / disagree / reword** and return.

## Active items

| # | Intervention | Learner predicts | KEY | Mechanism marked correct | Status |
|---|---|---|---|---|---|
| 1 | IABP started 1:1, correctly timed | Peak diastolic aortic pressure | **RISE** | The balloon inflates at the dicrotic notch and displaces aortic blood during diastole | VERIFIED |
| 2 | IABP deflation moved LATE (balloon still inflated as systole begins) | Aortic end-diastolic pressure (the pressure the LV must exceed to open the valve) | **RISE** | The balloon is still occupying aortic volume when the LV begins to eject | VERIFIED |
| 3 | IABP inflation moved EARLY (before the dicrotic notch) | Timing of aortic valve closure | **Closes earlier** | Balloon pressure exceeds LV pressure while the LV is still ejecting | VERIFIED |
| 4 | Impella inserted and run at P8 | LVEDP | **FALL** | The pump aspirates blood from the LV throughout the cycle, including diastole | VERIFIED |
| 5 | Impella inserted and run at P8 | Aortic valve opening | **Opens less** | The LV is emptied before it can build pressure above the (now higher) aortic pressure | VERIFIED |
| 6 | VA-ECMO started at 4 L/min | Mean arterial pressure | **RISE** | Circuit flow is added to the arterial tree | VERIFIED |
| 7 | VA-ECMO flow 2 → 4 L/min | Native LV stroke volume | **FALL** | Higher circuit flow raises aortic pressure, so the weak LV ejects less against it | VERIFIED |
| 8 | VA-ECMO flow 2 → 4 L/min | Aortic valve opening | **Opens less** | LV pressure spends less of the cycle above the raised aortic pressure | VERIFIED |
| 9 | Impella P8 added to VA-ECMO; ECMO weaned 4 → 2 L/min | LVEDP | **FALL** | The Impella empties the LV into the aorta without the LV having to open its valve | VERIFIED |

## Basis for each key

### iabp-augmentation — IABP timing

- **Stem:** IABP started 1:1, correctly timed. *Peak diastolic aortic pressure* will: **RISE**
- **Causal chain shown after reveal:** Inflation at AV closure occupies aortic volume → aortic diastolic pressure rises → coronary perfusion pressure (DPTI) rises.
- **Cited:** Trost & Hillis, Am J Cardiol 2006; Krishna & Zacharowski, CEACCP 2009
- **Basis:** VERIFIED. Diastolic augmentation is the defining action of counterpulsation; [TROST06] states IABP increases diastolic arterial pressure. Not model-dependent.

### iabp-late-deflation — IABP timing

- **Stem:** IABP deflation moved LATE (balloon still inflated as systole begins). *Aortic end-diastolic pressure (the pressure the LV must exceed to open the valve)* will: **RISE**
- **Causal chain shown after reveal:** Balloon still inflated at the start of systole → aortic pressure at AV opening is higher → LV must generate more pressure before it can eject (afterload ↑).
- **Cited:** Trost & Hillis, Am J Cardiol 2006; Krishna & Zacharowski, CEACCP 2009
- **Basis:** VERIFIED. Standard bedside criterion: late deflation raises the assisted aortic end-diastolic pressure and impedes ejection [TROST06][KRISHNA09]. Direction not model-dependent. (This model reproduces the AoEDP rise but not the accompanying SV fall - see validation report; the item asks only about AoEDP.)

### iabp-early-inflation — IABP timing

- **Stem:** IABP inflation moved EARLY (before the dicrotic notch). *Timing of aortic valve closure* will: **Closes earlier**
- **Causal chain shown after reveal:** Balloon inflates during ejection → aortic pressure rises above LV pressure before ejection is complete → valve closes early → SV falls, end-systolic volume rises.
- **Cited:** Trost & Hillis, Am J Cardiol 2006; Krishna & Zacharowski, CEACCP 2009
- **Basis:** VERIFIED. Premature aortic valve closure is the named consequence of inflation before the dicrotic notch [TROST06][KRISHNA09]. Not model-dependent.

### impella-lvedp — Impella: LV unloading

- **Stem:** Impella inserted and run at P8. *LVEDP* will: **FALL**
- **Causal chain shown after reveal:** Pump removes LV volume continuously → LV end-diastolic volume falls → on the steep EDPVR, LVEDP falls → PVA (O2 demand) falls.
- **Cited:** Burkhoff et al., JACC 2015
- **Basis:** VERIFIED. Direct mechanical removal of LV volume; the PV loop shifts left and down [BURKHOFF15]. Robust: no plausible parameter set reverses it. Not model-dependent.

### impella-av — Aortic valve opening

- **Stem:** Impella inserted and run at P8. *Aortic valve opening* will: **Opens less**
- **Causal chain shown after reveal:** Pump empties the LV and raises aortic pressure → peak LV pressure no longer exceeds aortic pressure → valve opens less (or not at all).
- **Cited:** Burkhoff et al., JACC 2015
- **Basis:** VERIFIED at high support. At full support the LV no longer exceeds aortic pressure and the valve stops opening [BURKHOFF15]; a persistently closed aortic valve is a recognized indication to vent [EZAD23]. Level-dependent: at low support the valve still opens. Keyed at P8, where the direction is not in doubt.

### ecmo-map — VA-ECMO: systemic pressure

- **Stem:** VA-ECMO started at 4 L/min. *Mean arterial pressure* will: **RISE**
- **Causal chain shown after reveal:** Venous blood is pumped into the arterial tree → arterial volume rises → MAP rises.
- **Cited:** Rao et al., Circ Heart Fail 2018; Burkhoff et al., JACC 2015
- **Basis:** VERIFIED. Uncontroversial: circuit flow into the arterial tree raises arterial pressure [RAO18][BURKHOFF15]. Not model-dependent. Magnitude is reflex-dependent; direction is not.

### ecmo-sv — VA-ECMO: native stroke volume

- **Stem:** VA-ECMO flow 2 → 4 L/min. *Native LV stroke volume* will: **FALL**
- **Causal chain shown after reveal:** Circuit flow ↑ → aortic pressure ↑ → ejection ends at a higher ESV → native SV ↓ (the same ESPVR, a higher afterload).
- **Cited:** Ostadal et al., J Transl Med 2015; Burkhoff et al., JACC 2015
- **Basis:** VERIFIED by direct measurement. [OSTADAL15] porcine cardiogenic shock, conductance-catheter PV loops: raising circuit flow 1->5 L/min reduced cardiac output 2.8->1.86 L/min and LVEF 43%->32%. Robust because preload reduction and afterload rise both lower SV. Caveat: porcine, n=5, and the human magnitude is not established.

### ecmo-av — Aortic valve opening

- **Stem:** VA-ECMO flow 2 → 4 L/min. *Aortic valve opening* will: **Opens less**
- **Causal chain shown after reveal:** Aortic pressure ↑ → the LV needs longer to exceed it and leaves it sooner → valve open for less of the cycle → toward a closed valve and stasis.
- **Cited:** Ezad et al., Circulation 2023; Rao et al., Circ Heart Fail 2018
- **Basis:** VERIFIED as mechanism and as recognised clinical phenomenon: an aortic valve that stops opening on VA-ECMO is a listed indication for venting [EZAD23][RAO18]. Robust for the same reason as ecmo-sv. Caveat: the circuit flow at which the valve closes is patient-specific, so the KEY is safe but the THRESHOLD shown is this model's.

### ecpella-lvedp — ECpella

- **Stem:** Impella P8 added to VA-ECMO; ECMO weaned 4 → 2 L/min. *LVEDP* will: **FALL**
- **Causal chain shown after reveal:** Pump removes blood from the LV regardless of the valve → LV volume ↓ → LVEDP ↓, while total systemic flow is preserved by pump + circuit.
- **Cited:** Burkhoff et al., JACC 2015; Donker et al., ASAIO J 2019 (simulation); Ezad et al., Circulation 2023
- **Basis:** VERIFIED as direction. A transvalvular pump removes LV volume irrespective of the aortic valve, so LVEDP falls from wherever it started [BURKHOFF15]; quantified in a closed-loop human simulation [DONKER19] and the basis of the venting literature [EZAD23][SCHRAGE18]. [PAPPA17] supports clinical use and outcomes, NOT the hemodynamic direction. CONFOUND (pre-Task-C): as shipped this item changed two variables at once (added Impella AND weaned ECMO 4->2). Fixed when S4 was restored to ECMO-held.

## Retired items (NOT shown to learners, NOT scored)

### ecmo-lvedp — would have keyed **RISE**

- **Stem:** VA-ECMO started at 4 L/min. *LVEDP* will: RISE
- **Why retired:** RETIRED 2026-09-24 - DIRECTION IS CONTINGENT IN HUMANS. VA-ECMO both unloads preload (venous drainage) and raises afterload (retrograde return); which dominates varies by patient. Reported LV distension incidence spans 1-68% [EZAD23]. A published case series found LVEDP LOWER at high circuit flow (median 6 mmHg at 4.1 L/min) than at low flow (13.5 mmHg at 1.9 L/min) - the opposite of this key. This model is parameterised so afterload dominates, which is a legitimate teaching configuration (it is the patient who needs venting) but is NOT a universal human finding. Scoring a learner wrong for answering 'fall' is indefensible. The teaching point survives via ecmo-sv and ecmo-av, where preload reduction and afterload rise push the SAME way.

## References

All confirmed to exist with the journal, year, volume and pages below.

- Burkhoff D, Sayer G, Doshi D, Uriel N. Hemodynamics of mechanical circulatory support. *J Am Coll Cardiol.* 2015;66(23):2663–74.
- Rao P, Khalpey Z, Smith R, Burkhoff D, Kociol RD. Venoarterial extracorporeal membrane oxygenation for cardiogenic shock and cardiac arrest. *Circ Heart Fail.* 2018;11(9):e004905.
- Ostadal P, Mlcek M, Kruger A, et al. Increasing venoarterial extracorporeal membrane oxygenation flow negatively affects left ventricular performance in a porcine model of cardiogenic shock. *J Transl Med.* 2015;13:266.
- Donker DW, Brodie D, Henriques JPS, Broomé M. Left ventricular unloading during veno-arterial ECMO: a simulation study. *ASAIO J.* 2019;65(1):11–20.
- Pappalardo F, Schulte C, Pieri M, et al. Concomitant implantation of Impella on top of veno-arterial ECMO may improve survival of patients with cardiogenic shock. *Eur J Heart Fail.* 2017;19(3):404–12. *(outcomes only — cited for clinical use, not for any hemodynamic direction)*
- Ezad SM, Ryan M, Donker DW, et al. Unloading the left ventricle in venoarterial ECMO: in whom, when, and how? *Circulation.* 2023;147(16):1237–50.
- Schrage B, Burkhoff D, Westermann D, et al. Unloading of the left ventricle during venoarterial extracorporeal membrane oxygenation therapy in cardiogenic shock. *JACC Heart Fail.* 2018;6(12):1035–43.
- Trost JC, Hillis LD. Intra-aortic balloon counterpulsation. *Am J Cardiol.* 2006;97(9):1391–8.
- Krishna M, Zacharowski K. Principles of intra-aortic balloon pump counterpulsation. *Contin Educ Anaesth Crit Care Pain.* 2009;9(1):24–8.
