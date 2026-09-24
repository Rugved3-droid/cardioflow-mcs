/**
 * Model types.
 *
 * UNITS (everywhere inside src/model; never mix):
 *   pressure mmHg | volume mL | flow mL/s | resistance mmHg*s/mL
 *   compliance mL/mmHg | elastance mmHg/mL | time ms (clock) / s (physics)
 * Display-only conversion: L/min = mL/s * 0.06.
 */

/** One patient. All physiology lives here; nothing physiological is written inline elsewhere. */
export interface PatientParams {
  /** Heart rate, bpm. The beat length is rounded to an integer number of 1 ms ticks. */
  hr: number;

  /* LV: time-varying elastance between ESPVR and passive EDPVR (same V0, per spec) */
  lvEes: number; // end-systolic elastance, mmHg/mL
  lvV0: number; // unstressed volume, mL
  lvA: number; // EDPVR scale, mmHg     P_ed = A(e^{B(V-V0)} - 1)
  lvB: number; // EDPVR stiffness, 1/mL
  /**
   * EDPVR volume intercept, mL — the volume at which passive pressure is zero.
   * Physiologically distinct from the ESPVR intercept lvV0 (a dilated, remodelled
   * ventricle sits on a right-shifted passive curve), so the two are separate
   * parameters. Sharing one intercept forces the operating point deep onto the
   * exponential and makes LVEDP hypersensitive to volume.
   */
  lvV0ed: number;

  /**
   * Multiplier on the activation time-base. 1 = default double-Hill timing.
   * >1 shortens systole, <1 lengthens it. Present so E(t) timing is a sweepable
   * parameter rather than a buried constant.
   */
  actScale: number;

  /* RV: same construction; present only to close the loop */
  rvEes: number;
  rvV0: number;
  rvA: number;
  rvB: number;

  /* valves (forward resistance of an ideal diode) */
  rMitral: number;
  rAortic: number;
  rTricuspid: number;
  rPulmonic: number;

  /* --- arterial baroreflex (acts on SVR only; see README "Baroreflex") --- */
  /** false pins SVR at rSvr, reproducing the open-loop model. */
  baroEnabled: boolean;
  /** pressure the reflex defends, mmHg */
  baroSetpoint: number;
  /** sigmoid width, mmHg. Smaller = higher gain. */
  baroK: number;
  /** effector bounds, mmHg*s/mL: fully dilated and fully constricted */
  svrMin: number;
  svrMax: number;
  /** baroreceptor sensing lag, s */
  baroSenseTau: number;
  /** vascular effector lag, s */
  baroEffectorTau: number;

  /* systemic 3-element Windkessel (Rc, C, Rsvr) + small proximal aortic capacitance */
  cAo: number; // proximal aortic root capacitance (makes the AV/Impella-outlet node an ODE state)
  rc: number; // characteristic impedance
  cSa: number; // arterial compliance (the Windkessel C)
  rSvr: number; // systemic vascular resistance

  /* venous reservoir (finite, stressed volume) */
  cSv: number;

  /* pulmonary */
  cPa: number;
  rPvr: number;
  cPv: number; // pulmonary veins + LA

  /** bronchial + Thebesian return: systemic arteries -> pulmonary veins/LA, bypassing the RV */
  rBronchial: number;

  /** initial volumes; their sum is the conserved total (LV/RV absolute, vessels stressed) */
  v0: StateVolumes;
}

export interface StateVolumes {
  lv: number;
  rv: number;
  ao: number;
  sa: number;
  sv: number;
  pa: number;
  pv: number;
}

/** What the operator commands. The model never applies these directly — actuators slew toward them. */
export interface DeviceSettings {
  iabpOn: boolean;
  /** 1 = every beat, 2 = every other beat (how timing is assessed at the bedside) */
  iabpRatio: 1 | 2;
  /** inflation onset relative to the dicrotic notch (AV closure), ms. 0 = correct. */
  iabpInflateOffsetMs: number;
  /** deflation relative to correct (complete just before the aortic valve opens), ms. 0 = correct. */
  iabpDeflateOffsetMs: number;
  /** Impella performance level. 0 = no pump. Continuous 1..9 permitted. */
  impellaLevel: number;
  /** VA-ECMO commanded circuit flow, L/min. */
  ecmoFlowLpm: number;
}

/** Rate-limited actuator positions. These — not DeviceSettings — enter the physics. */
export interface Actuators {
  iabpFill: number; // 0..1 fraction of balloon volume engaged
  iabpInflateOffsetMs: number;
  iabpDeflateOffsetMs: number;
  impellaLevel: number;
  ecmoFlowLpm: number;
}

/** The single source of truth for one simulated patient. */
export interface SimState {
  /** integer ms since reset */
  tick: number;
  beat: number;
  /** integer ms since the start of the current beat (activation onset = end-diastole) */
  tickInBeat: number;
  v: StateVolumes;
  act: Actuators;
  settings: DeviceSettings;
  /**
   * Dicrotic-notch reference used by the IABP console, ms from beat start.
   * Captured once from an unassisted beat when the balloon is armed, then held
   * (an operator times the balloon once; it does not chase its own effect).
   */
  iabpNotchMs: number | null;
  /** AV-opening reference (ms from beat start) captured with the notch; deflation is timed to it */
  iabpOpenMs: number | null;
  /** AV closure / opening times of the last completed beat, ms from beat start (null if it never opened) */
  lastAvClosureMs: number | null;
  lastAvOpeningMs: number | null;
  /** temporally smoothed aortic-valve open fraction (EMA across beats) */
  avOpenFractionSmoothed: number;
  /** low-pass sensed arterial pressure driving the baroreflex, mmHg */
  baroSensed: number;
  /** current systemic vascular resistance (reflex effector position), mmHg*s/mL */
  svr: number;
  /**
   * Cumulative volume transported by each path, mL, wrapped at CUM_WRAP.
   *
   * These exist so the anatomy layer can animate flow WITHOUT owning a clock of its
   * own: an arrow's position along a path is a function of the volume that has
   * actually passed through it. Integrated on the same fixed tick as the physiology,
   * so they are deterministic, clone-safe and snapshot-safe.
   */
  cum: { aortic: number; impella: number; ecmo: number; mitral: number; systemic: number };
}

/** Everything evaluated at one instant. Derived only; never integrated. */
export interface Sample {
  tick: number;
  beat: number;
  tickInBeat: number;
  phase: number;
  activation: number;

  pLv: number;
  pRv: number;
  pAo: number;
  pSa: number;
  pSv: number;
  pPa: number;
  pPv: number;
  vLv: number;
  vRv: number;

  qMitral: number;
  qAortic: number;
  qTricuspid: number;
  qPulmonic: number;
  qRc: number; // Ao -> SA (negative = retrograde, e.g. ECMO-dominated)
  qSvr: number;
  qPvr: number;
  qBronchial: number;
  qImpella: number;
  qEcmo: number;

  vBalloon: number;

  avOpen: boolean;
  impellaSuction: boolean;
  ecmoDrainageLimited: boolean;
}

/** Per-beat outputs. Computed once, at the end of each beat. */
export interface BeatMetrics {
  beat: number;
  endTick: number;

  map: number;
  sbp: number; // peak aortic pressure during LV systole
  dbp: number; // minimum aortic pressure in the beat
  pulsePressure: number;
  /** peak aortic pressure during diastole (IABP augmentation; = early-diastolic value otherwise) */
  peakDiastolicP: number;
  /** aortic end-diastolic pressure (at activation onset) — the pressure the next ejection must overcome */
  aorticEdp: number;

  lvedp: number;
  lvedv: number;
  lvesv: number;
  lvesp: number;
  lvPeakP: number;
  ef: number;

  nativeSv: number; // mL, integral of aortic valve flow
  nativeCoLpm: number;
  impellaLpm: number;
  ecmoLpm: number;
  /** native + Impella + ECMO forward flow into the aorta, L/min */
  totalFlowLpm: number;

  strokeWork: number; // mmHg*mL, PV loop area
  pe: number; // potential energy, mmHg*mL
  pva: number; // SW + PE, mmHg*mL
  /** coronary perfusion surrogate: integral of (P_ao - P_lv) over diastole, mmHg*s per beat */
  dpti: number;

  /** fraction of this beat's cycle during which the AV was open (raw) */
  avOpenFractionRaw: number;
  /** EMA-smoothed across beats; this is the displayed value */
  avOpenFraction: number;
  avOpened: boolean;
  /** AV opening / closure time in this beat, ms from activation onset (null if it never opened) */
  avOpenMs: number | null;
  avCloseMs: number | null;

  lapMean: number;
  rapMean: number;
  paMean: number;

  impellaSuction: boolean;
  ecmoDrainageLimited: boolean;
  iabpFill: number;

  /** mean systemic vascular resistance over the beat, mmHg*s/mL (reflex output) */
  svr: number;
  /** the same in Wood units, for display */
  svrWood: number;
}
