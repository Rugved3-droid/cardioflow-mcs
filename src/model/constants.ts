/**
 * Numerical and actuator constants. Physiology lives in patient.ts and devices/.
 */

/** Model clock tick, ms. Fixed. The render loop never changes this. */
export const TICK_MS = 1;
/** Fixed RK4 substeps per tick. Stiffest time constant (AV/aortic root) is ~1 ms. */
export const SUBSTEPS = 4;

export const ML_S_TO_LPM = 0.06;
export const MMHG_ML_TO_J = 1.333e-4;

/**
 * Actuator slew limits (units per second). Every device setting change passes
 * through these, so a commanded step becomes a ramp and the PV loop moves through
 * intermediate states that are all solutions of the same equations.
 */
export const SLEW = {
  iabpFillPerS: 0.5, // 0 -> full balloon in 2 s
  iabpTimingMsPerS: 120,
  impellaLevelPerS: 1.5,
  ecmoLpmPerS: 0.6,
} as const;

/** EMA weight for the beat-to-beat aortic-valve open fraction. */
export const AV_FRACTION_EMA = 0.35;

/** Activation threshold that defines diastole for the DPTI integral (see metrics). */
export const DIASTOLE_ACTIVATION = 0.1;
