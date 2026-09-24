/**
 * PREDICTION ITEM BANK — the single source of correct answers.
 *
 * RULE: correct answers here are keyed from physiology/literature and are NEVER
 * read from simulator output. The simulator only *shows* what happens after the
 * learner has locked an answer. `npm run validate` (E7) checks the reverse — that
 * the simulator agrees with this key — and fails loudly if it ever does not.
 *
 * CITATION STATUS (checked against the published record 2026-09-24): every reference
 * below was confirmed to exist with the stated journal, year, volume and pages.
 * What a citation SUPPORTS is a separate question from whether it exists — see the
 * per-item `verification` field and README "Answer-key verification".
 *
 * Key references:
 *  [BURKHOFF15] Burkhoff D, Sayer G, Doshi D, Uriel N. Hemodynamics of mechanical
 *               circulatory support. J Am Coll Cardiol. 2015;66(23):2663-74.
 *  [RAO18]      Rao P, Khalpey Z, Smith R, Burkhoff D, Kociol RD. Venoarterial ECMO for
 *               cardiogenic shock and cardiac arrest. Circ Heart Fail. 2018;11:e004905.
 *  [OSTADAL15]  Ostadal P, Mlcek M, Kruger A, et al. Increasing venoarterial ECMO flow
 *               negatively affects left ventricular performance in a porcine model of
 *               cardiogenic shock. J Transl Med. 2015;13:266.
 *  [DONKER19]   Donker DW, Brodie D, Henriques JPS, Broomé M. Left ventricular unloading
 *               during veno-arterial ECMO: a simulation study. ASAIO J. 2019;65(1):11-20.
 *  [PAPPA17]    Pappalardo F, Schulte C, Pieri M, et al. Concomitant implantation of
 *               Impella on top of VA-ECMO may improve survival of patients with
 *               cardiogenic shock. Eur J Heart Fail. 2017;19(3):404-12.
 *               NOTE: an outcomes/survival study. It does NOT establish any hemodynamic
 *               direction and must not be cited as if it did.
 *  [EZAD23]     Ezad SM, Ryan M, Donker DW, et al. Unloading the left ventricle in
 *               venoarterial ECMO: in whom, when, and how? Circulation.
 *               2023;147(16):1237-50.
 *  [SCHRAGE18]  Schrage B, Burkhoff D, Westermann D, et al. Unloading of the left
 *               ventricle during venoarterial extracorporeal membrane oxygenation
 *               therapy in cardiogenic shock. JACC Heart Fail. 2018;6(12):1035-43.
 *  [TROST06]    Trost JC, Hillis LD. Intra-aortic balloon counterpulsation.
 *               Am J Cardiol. 2006;97(9):1391-8.
 *  [KRISHNA09]  Krishna M, Zacharowski K. Principles of intra-aortic balloon pump
 *               counterpulsation. Contin Educ Anaesth Crit Care Pain. 2009;9(1):24-8.
 */

import type { BeatMetrics, DeviceSettings } from '../model/types';
import type { SteadyKey } from '../model/steadyStates';
import { IABP_TIMINGS } from '../model/devices/iabp';

export type Construct =
  | 'ecmo_perfusion'
  | 'ecmo_lvedp'
  | 'ecmo_sv'
  | 'av_opening'
  | 'impella_unloading'
  | 'iabp_timing'
  | 'ecpella';

export const CONSTRUCT_LABEL: Record<Construct, string> = {
  ecmo_perfusion: 'VA-ECMO: systemic pressure',
  ecmo_lvedp: 'VA-ECMO: LV filling pressure',
  ecmo_sv: 'VA-ECMO: native stroke volume',
  av_opening: 'Aortic valve opening',
  impella_unloading: 'Impella: LV unloading',
  iabp_timing: 'IABP timing',
  ecpella: 'ECpella',
};

export type Direction = 'rise' | 'fall' | 'unchanged';

export interface PredictionItem {
  id: string;
  construct: Construct;
  /** counts toward the headline competency: "distinguishes systemic perfusion from ventricular unloading" */
  competency: boolean;
  from: SteadyKey;
  /** applied to the right pane when the answer is locked */
  to: Partial<DeviceSettings>;
  /** e.g. "VA-ECMO flow 2 → 4 L/min" */
  intervention: string;
  /** what the learner predicts about */
  variable: string;
  /** option labels for rise / fall / unchanged (defaults: Rise / Fall / Unchanged) */
  optionLabels?: Record<Direction, string>;
  correct: Direction;
  mechanism: { stem: string; options: [string, string, string, string]; correctIndex: 0 | 1 | 2 | 3 };
  /** one-line causal chain shown after reveal (the causal engine replaces this in the UI later) */
  explanation: string;
  source: string;
  /** which simulator metric illustrates the answer after reveal, and the band treated as "unchanged" (E7 only) */
  observe: { metric: keyof BeatMetrics; unit: string; unchangedBand: number };
  /**
   * false = RETIRED from the active bank. Retired items are never shown to a learner,
   * never scored, and never checked by E7. They stay here with their reason so a
   * reviewing cardiologist can see what was removed and why.
   */
  active: boolean;
  /** why this key is or is not defensible; surfaced in the sign-off table. */
  verification: string;
}

const AV_LABELS: Record<Direction, string> = {
  rise: 'Opens more',
  fall: 'Opens less',
  unchanged: 'Unchanged',
};

export const ITEM_BANK: PredictionItem[] = [
  {
    // SOURCE: [TROST06] diastolic augmentation is the defining effect of correctly timed counterpulsation; [KRISHNA09].
    id: 'iabp-augmentation',
    active: true,
    verification:
      `VERIFIED. Diastolic augmentation is the defining action of counterpulsation; [TROST06] states IABP increases diastolic arterial pressure. Not model-dependent.`,
    construct: 'iabp_timing',
    competency: false,
    from: 'S0',
    to: { iabpOn: true, iabpRatio: 1 },
    intervention: 'IABP started 1:1, correctly timed',
    variable: 'Peak diastolic aortic pressure',
    correct: 'rise',
    mechanism: {
      stem: 'Which mechanism?',
      options: [
        'The balloon inflates at the dicrotic notch and displaces aortic blood during diastole',
        'The balloon increases LV contractility',
        'The balloon adds flow to the circulation from an external pump',
        'The balloon raises systemic vascular resistance',
      ],
      correctIndex: 0,
    },
    explanation: 'Inflation at AV closure occupies aortic volume → aortic diastolic pressure rises → coronary perfusion pressure (DPTI) rises.',
    source: 'Trost & Hillis, Am J Cardiol 2006; Krishna & Zacharowski, CEACCP 2009',
    observe: { metric: 'peakDiastolicP', unit: 'mmHg', unchangedBand: 2 },
  },
  {
    // SOURCE: [TROST06]/[KRISHNA09] late deflation: assisted aortic end-diastolic pressure ≥ unassisted; balloon impedes ejection.
    id: 'iabp-late-deflation',
    active: true,
    verification:
      `VERIFIED. Standard bedside criterion: late deflation raises the assisted aortic end-diastolic pressure and impedes ejection [TROST06][KRISHNA09]. Direction not model-dependent. (This model reproduces the AoEDP rise but not the accompanying SV fall - see validation report; the item asks only about AoEDP.)`,
    construct: 'iabp_timing',
    competency: false,
    from: 'S1',
    to: { iabpDeflateOffsetMs: IABP_TIMINGS.lateDeflation.deflate },
    intervention: 'IABP deflation moved LATE (balloon still inflated as systole begins)',
    variable: 'Aortic end-diastolic pressure (the pressure the LV must exceed to open the valve)',
    correct: 'rise',
    mechanism: {
      stem: 'Which mechanism?',
      options: [
        'Late deflation lengthens diastole',
        'The balloon is still occupying aortic volume when the LV begins to eject',
        'Late deflation increases coronary flow',
        'The balloon deflates before the dicrotic notch',
      ],
      correctIndex: 1,
    },
    explanation: 'Balloon still inflated at the start of systole → aortic pressure at AV opening is higher → LV must generate more pressure before it can eject (afterload ↑).',
    source: 'Trost & Hillis, Am J Cardiol 2006; Krishna & Zacharowski, CEACCP 2009',
    observe: { metric: 'aorticEdp', unit: 'mmHg', unchangedBand: 1.5 },
  },
  {
    // SOURCE: [TROST06]/[KRISHNA09] early inflation (before the dicrotic notch) causes premature aortic valve closure.
    id: 'iabp-early-inflation',
    active: true,
    verification:
      `VERIFIED. Premature aortic valve closure is the named consequence of inflation before the dicrotic notch [TROST06][KRISHNA09]. Not model-dependent.`,
    construct: 'iabp_timing',
    competency: false,
    from: 'S1',
    to: { iabpInflateOffsetMs: IABP_TIMINGS.earlyInflation.inflate },
    intervention: 'IABP inflation moved EARLY (before the dicrotic notch)',
    variable: 'Timing of aortic valve closure',
    optionLabels: { rise: 'Closes later', fall: 'Closes earlier', unchanged: 'Unchanged' },
    correct: 'fall',
    mechanism: {
      stem: 'Which mechanism?',
      options: [
        'Early inflation lowers LV pressure',
        'Early inflation increases LV preload',
        'Balloon pressure exceeds LV pressure while the LV is still ejecting',
        'The balloon obstructs the mitral valve',
      ],
      correctIndex: 2,
    },
    explanation: 'Balloon inflates during ejection → aortic pressure rises above LV pressure before ejection is complete → valve closes early → SV falls, end-systolic volume rises.',
    source: 'Trost & Hillis, Am J Cardiol 2006; Krishna & Zacharowski, CEACCP 2009',
    observe: { metric: 'avCloseMs', unit: 'ms', unchangedBand: 5 },
  },
  {
    // SOURCE: [BURKHOFF15] Impella directly unloads the LV: PV loop shifts left, LVEDP/LVEDV/PVA fall.
    id: 'impella-lvedp',
    active: true,
    verification:
      `VERIFIED. Direct mechanical removal of LV volume; the PV loop shifts left and down [BURKHOFF15]. Robust: no plausible parameter set reverses it. Not model-dependent.`,
    construct: 'impella_unloading',
    competency: true,
    from: 'S0',
    to: { impellaLevel: 8 },
    intervention: 'Impella inserted and run at P8',
    variable: 'LVEDP',
    correct: 'fall',
    mechanism: {
      stem: 'Which mechanism?',
      options: [
        'The pump lowers systemic vascular resistance',
        'The pump increases LV contractility',
        'The pump drains the right atrium',
        'The pump aspirates blood from the LV throughout the cycle, including diastole',
      ],
      correctIndex: 3,
    },
    explanation: 'Pump removes LV volume continuously → LV end-diastolic volume falls → on the steep EDPVR, LVEDP falls → PVA (O2 demand) falls.',
    source: 'Burkhoff et al., JACC 2015',
    observe: { metric: 'lvedp', unit: 'mmHg', unchangedBand: 1 },
  },
  {
    // SOURCE: [BURKHOFF15] at high support the LV no longer generates enough pressure to open the AV; loop loses isovolumic phases.
    id: 'impella-av',
    active: true,
    verification:
      `VERIFIED at high support. At full support the LV no longer exceeds aortic pressure and the valve stops opening [BURKHOFF15]; a persistently closed aortic valve is a recognized indication to vent [EZAD23]. Level-dependent: at low support the valve still opens. Keyed at P8, where the direction is not in doubt.`,
    construct: 'av_opening',
    competency: false,
    from: 'S0',
    to: { impellaLevel: 8 },
    intervention: 'Impella inserted and run at P8',
    variable: 'Aortic valve opening',
    optionLabels: AV_LABELS,
    correct: 'fall',
    mechanism: {
      stem: 'Which mechanism?',
      options: [
        'The pump catheter mechanically holds the valve shut',
        'The LV is emptied before it can build pressure above the (now higher) aortic pressure',
        'The pump reduces heart rate',
        'The pump causes aortic regurgitation',
      ],
      correctIndex: 1,
    },
    explanation: 'Pump empties the LV and raises aortic pressure → peak LV pressure no longer exceeds aortic pressure → valve opens less (or not at all).',
    source: 'Burkhoff et al., JACC 2015',
    observe: { metric: 'avOpenFraction', unit: 'of cycle', unchangedBand: 0.01 },
  },
  {
    // SOURCE: [RAO18]/[BURKHOFF15] VA-ECMO returns flow to the arterial tree, raising arterial pressure.
    id: 'ecmo-map',
    active: true,
    verification:
      `VERIFIED. Uncontroversial: circuit flow into the arterial tree raises arterial pressure [RAO18][BURKHOFF15]. Not model-dependent. Magnitude is reflex-dependent; direction is not.`,
    construct: 'ecmo_perfusion',
    competency: true,
    from: 'S0',
    to: { ecmoFlowLpm: 4 },
    intervention: 'VA-ECMO started at 4 L/min',
    variable: 'Mean arterial pressure',
    correct: 'rise',
    mechanism: {
      stem: 'Which mechanism?',
      options: [
        'Circuit flow is added to the arterial tree',
        'ECMO increases LV contractility',
        'ECMO raises systemic vascular resistance',
        'ECMO increases LV stroke volume',
      ],
      correctIndex: 0,
    },
    explanation: 'Venous blood is pumped into the arterial tree → arterial volume rises → MAP rises.',
    source: 'Rao et al., Circ Heart Fail 2018; Burkhoff et al., JACC 2015',
    observe: { metric: 'map', unit: 'mmHg', unchangedBand: 2 },
  },
  {
    // SOURCE: [BURKHOFF15]/[RAO18]/[DONKER19] retrograde VA-ECMO flow raises LV afterload; in a poorly contractile LV,
    //         EDV and EDP rise (LV distension). [OSTADAL15] shows the same with increasing flow in a porcine model.
    id: 'ecmo-lvedp',
    active: false,
    verification:
      `RETIRED 2026-09-24 - DIRECTION IS CONTINGENT IN HUMANS. VA-ECMO both unloads preload (venous drainage) and raises afterload (retrograde return); which dominates varies by patient. Reported LV distension incidence spans 1-68% [EZAD23]. A published case series found LVEDP LOWER at high circuit flow (median 6 mmHg at 4.1 L/min) than at low flow (13.5 mmHg at 1.9 L/min) - the opposite of this key. This model is parameterised so afterload dominates, which is a legitimate teaching configuration (it is the patient who needs venting) but is NOT a universal human finding. Scoring a learner wrong for answering 'fall' is indefensible. The teaching point survives via ecmo-sv and ecmo-av, where preload reduction and afterload rise push the SAME way.`,
    construct: 'ecmo_lvedp',
    competency: true,
    from: 'S0',
    to: { ecmoFlowLpm: 4 },
    intervention: 'VA-ECMO started at 4 L/min',
    variable: 'LVEDP',
    correct: 'rise',
    mechanism: {
      stem: 'Which mechanism?',
      options: [
        'ECMO drains blood directly out of the LV',
        'ECMO increases right-heart output, raising LV preload',
        'Retrograde arterial flow raises LV afterload; the weak LV ejects less and the retained blood distends it',
        'LVEDP is unchanged because the LV is bypassed',
      ],
      correctIndex: 2,
    },
    explanation: 'Retrograde return → aortic pressure ↑ (afterload) → weak LV ejects less → blood retained in LV → EDV ↑ → LVEDP ↑ on the steep EDPVR.',
    source: 'Burkhoff et al., JACC 2015; Rao et al., Circ Heart Fail 2018; Donker et al., ASAIO J 2019',
    observe: { metric: 'lvedp', unit: 'mmHg', unchangedBand: 1 },
  },
  {
    // SOURCE: [OSTADAL15] increasing VA-ECMO flow decreased LV stroke volume/ejection; [BURKHOFF15].
    id: 'ecmo-sv',
    active: true,
    verification:
      `VERIFIED by direct measurement. [OSTADAL15] porcine cardiogenic shock, conductance-catheter PV loops: raising circuit flow 1->5 L/min reduced cardiac output 2.8->1.86 L/min and LVEF 43%->32%. Robust because preload reduction and afterload rise both lower SV. Caveat: porcine, n=5, and the human magnitude is not established.`,
    construct: 'ecmo_sv',
    competency: true,
    from: 'ECMO2',
    to: { ecmoFlowLpm: 4 },
    intervention: 'VA-ECMO flow 2 → 4 L/min',
    variable: 'Native LV stroke volume',
    correct: 'fall',
    mechanism: {
      stem: 'Which mechanism?',
      options: [
        'Higher circuit flow raises aortic pressure, so the weak LV ejects less against it',
        'Higher circuit flow reduces LV contractility directly',
        'Higher circuit flow increases LV preload, which lowers SV',
        'The ECMO cannula obstructs the LV outflow tract',
      ],
      correctIndex: 0,
    },
    explanation: 'Circuit flow ↑ → aortic pressure ↑ → ejection ends at a higher ESV → native SV ↓ (the same ESPVR, a higher afterload).',
    source: 'Ostadal et al., J Transl Med 2015; Burkhoff et al., JACC 2015',
    observe: { metric: 'nativeSv', unit: 'mL', unchangedBand: 1 },
  },
  {
    // SOURCE: [RAO18]/[OSTADAL15] with rising VA-ECMO flow the aortic valve opens less and may stop opening.
    id: 'ecmo-av',
    active: true,
    verification:
      `VERIFIED as mechanism and as recognised clinical phenomenon: an aortic valve that stops opening on VA-ECMO is a listed indication for venting [EZAD23][RAO18]. Robust for the same reason as ecmo-sv. Caveat: the circuit flow at which the valve closes is patient-specific, so the KEY is safe but the THRESHOLD shown is this model's.`,
    construct: 'av_opening',
    competency: false,
    from: 'ECMO2',
    to: { ecmoFlowLpm: 4 },
    intervention: 'VA-ECMO flow 2 → 4 L/min',
    variable: 'Aortic valve opening',
    optionLabels: AV_LABELS,
    correct: 'fall',
    mechanism: {
      stem: 'Which mechanism?',
      options: [
        'The ECMO return jet pushes the valve leaflets shut',
        'LV pressure spends less of the cycle above the raised aortic pressure',
        'ECMO lowers LV end-diastolic volume',
        'ECMO slows the heart rate',
      ],
      correctIndex: 1,
    },
    explanation: 'Aortic pressure ↑ → the LV needs longer to exceed it and leaves it sooner → valve open for less of the cycle → toward a closed valve and stasis.',
    source: 'Ezad et al., Circulation 2023; Rao et al., Circ Heart Fail 2018',
    observe: { metric: 'avOpenFraction', unit: 'of cycle', unchangedBand: 0.01 },
  },
  {
    // SOURCE: [DONKER19]/[PAPPA17]/[BURKHOFF15] adding a transvalvular pump to VA-ECMO unloads the LV (LVEDP/LVEDV fall).
    id: 'ecpella-lvedp',
    active: true,
    verification:
      `VERIFIED as direction. A transvalvular pump removes LV volume irrespective of the aortic valve, so LVEDP falls from wherever it started [BURKHOFF15]; quantified in a closed-loop human simulation [DONKER19] and the basis of the venting literature [EZAD23][SCHRAGE18]. [PAPPA17] supports clinical use and outcomes, NOT the hemodynamic direction. CONFOUND (pre-Task-C): as shipped this item changed two variables at once (added Impella AND weaned ECMO 4->2). Fixed when S4 was restored to ECMO-held.`,
    construct: 'ecpella',
    competency: true,
    from: 'S3',
    to: { impellaLevel: 8, ecmoFlowLpm: 2 },
    intervention: 'Impella P8 added to VA-ECMO; ECMO weaned 4 → 2 L/min',
    variable: 'LVEDP',
    correct: 'fall',
    mechanism: {
      stem: 'Which mechanism?',
      options: [
        'The Impella raises aortic pressure further, closing the valve',
        'ECMO weaning alone restores native ejection',
        'The Impella empties the LV into the aorta without the LV having to open its valve',
        'The Impella lowers right atrial pressure',
      ],
      correctIndex: 2,
    },
    explanation: 'Pump removes blood from the LV regardless of the valve → LV volume ↓ → LVEDP ↓, while total systemic flow is preserved by pump + circuit.',
    source: 'Burkhoff et al., JACC 2015; Donker et al., ASAIO J 2019 (simulation); Ezad et al., Circulation 2023',
    observe: { metric: 'lvedp', unit: 'mmHg', unchangedBand: 1 },
  },
];

/** What learners actually see and what E7 checks. Retired items are excluded. */
export const ACTIVE_ITEMS: PredictionItem[] = ITEM_BANK.filter((i) => i.active);
export const RETIRED_ITEMS: PredictionItem[] = ITEM_BANK.filter((i) => !i.active);

export const HEADLINE_COMPETENCY = 'Distinguishes systemic perfusion from ventricular unloading';
