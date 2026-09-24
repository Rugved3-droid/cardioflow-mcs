/**
 * The one patient: acute severe LV failure / cardiogenic shock.
 *
 * Parameter values are internal choices tuned so the unsupported state lands in
 * a textbook SCAI C–D cardiogenic-shock hemodynamic profile (see README,
 * "Design targets"). They are NOT fitted to any patient or dataset.
 */

import type { DeviceSettings, PatientParams } from './types';

export const SHOCK_PATIENT: PatientParams = {
  hr: 100,

  lvEes: 0.5,
  lvV0: 40,
  lvA: 0.4,
  lvB: 0.026,

  rvEes: 0.8,
  rvV0: 15,
  rvA: 0.3,
  rvB: 0.06,

  rMitral: 0.005,
  rAortic: 0.006,
  rTricuspid: 0.004,
  rPulmonic: 0.004,

  cAo: 0.2,
  rc: 0.05,
  cSa: 1.3,
  rSvr: 0.96,

  cSv: 120,

  cPa: 3.5,
  rPvr: 0.1,
  cPv: 12,

  rBronchial: 30,

  v0: { lv: 185, rv: 120, ao: 12, sa: 80, sv: 1300, pa: 100, pv: 290 },
};

export const NO_DEVICE: DeviceSettings = {
  iabpOn: false,
  iabpRatio: 1,
  iabpInflateOffsetMs: 0,
  iabpDeflateOffsetMs: 0,
  impellaLevel: 0,
  ecmoFlowLpm: 0,
};
