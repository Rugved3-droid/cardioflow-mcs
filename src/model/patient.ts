/**
 * The one patient: acute severe LV failure / cardiogenic shock.
 *
 * Parameter values are internal choices tuned so the unsupported state lands in
 * a textbook SCAI C–D cardiogenic-shock hemodynamic profile (see README,
 * "Design targets"). They are NOT fitted to any patient or dataset.
 */

import type { DeviceSettings, PatientParams } from './types';

/**
 * Phenotype descriptor. The LV's response to added afterload is NOT the same in
 * every failing ventricle, so the one being simulated is named explicitly and
 * shown in the UI. See PHENOTYPE_NOTE.
 */
export const PHENOTYPE = {
  label: 'Low-contractility, afterload-dominant LV failure',
  short: 'Afterload-dominant LV failure',
  /** defining numbers, verified by the validation harness */
  ees: 0.62,
  eaOverEes: 4.0,
  ef: 16,
  summary:
    'Ees 0.62 mmHg/mL with Ea/Ees ~4 at baseline: a severely uncoupled ventricle that ' +
    'cannot eject against added arterial pressure. This is the patient in whom VA-ECMO ' +
    'distends the LV and who is therefore a candidate for venting.',
} as const;

/**
 * Shown wherever the simulator reports an LV-loading result.
 *
 * How much VA-ECMO raises LV filling pressure is phenotype-contingent, not universal.
 * In this model, holding everything else fixed and varying only contractility, the
 * LVEDP rise at 4 L/min ranges from about +2 mmHg (Ees 2.4, EF 37%) to about +13 mmHg
 * (Ees 0.62, EF 16%), and the stroke-work response changes sign near Ea/Ees ~2.5.
 * Reported LV-distension incidence on VA-ECMO spans 1-68% for the same reason.
 * What is robust across phenotypes is that native stroke volume falls and the aortic
 * valve opens less.
 */
export const PHENOTYPE_NOTE =
  'How far LV filling pressure rises on VA-ECMO depends on the ventricle. This patient is ' +
  'the afterload-dominant phenotype, in which it rises. It does not rise in every patient.';

export const SHOCK_PATIENT: PatientParams = {
  hr: 100,

  /* --- LV: recalibrated in Task D (see README "LV afterload response calibration") --- */
  /** contractility; severe systolic failure. Ea/Ees ~4 at baseline. */
  lvEes: 0.62,
  /** ESPVR volume intercept */
  lvV0: 40,
  /**
   * EDPVR scale and stiffness, chosen so local diastolic stiffness dP/dV = B(P+A)
   * is ~0.26 mmHg/mL at the operating point - the value implied by Donker 2019
   * (+10% EDV for +5 mmHg PCWP at 4 L/min). The previous pairing sat at 0.58-1.04.
   */
  lvA: 8.0,
  lvB: 0.0093,
  /** EDPVR volume intercept, right-shifted for a dilated remodelled ventricle */
  lvV0ed: 53,

  actScale: 1,

  rvEes: 0.8,
  rvV0: 15,
  rvA: 0.3,
  rvB: 0.06,

  rMitral: 0.005,
  rAortic: 0.006,
  rTricuspid: 0.004,
  rPulmonic: 0.004,

  /* --- baroreflex on SVR ---
   * Calibrated so the reflex output at the unsupported shock pressure reproduces
   * the SVR the open-loop model used (0.96 mmHg*s/mL = 16 Wood units): a shocked
   * patient's high SVR IS the reflex near maximal constriction. */
  baroEnabled: true,
  baroSetpoint: 68,
  baroK: 12,
  svrMin: 0.45,
  svrMax: 1.25,
  baroSenseTau: 2,
  baroEffectorTau: 8,

  cAo: 0.2,
  rc: 0.05,
  cSa: 1.3,
  rSvr: 0.96,

  cSv: 120,

  cPa: 3.5,
  rPvr: 0.1,
  cPv: 12,

  rBronchial: 30,

  v0: { lv: 185, rv: 120, ao: 12, sa: 80, sv: 1500, pa: 100, pv: 290 },
};

export const NO_DEVICE: DeviceSettings = {
  iabpOn: false,
  iabpRatio: 1,
  iabpInflateOffsetMs: 0,
  iabpDeflateOffsetMs: 0,
  impellaLevel: 0,
  ecmoFlowLpm: 0,
};
