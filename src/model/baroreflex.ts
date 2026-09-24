/**
 * Arterial baroreflex, acting on systemic vascular resistance.
 *
 * Without it, flow added by a device has nowhere to go but pressure: a fixed
 * resistance turns every litre of circuit flow directly into millimetres of
 * mercury, and VA-ECMO at 4 L/min produced a MAP no shocked patient would have.
 *
 *     SVR_target(P) = SVRmin + (SVRmax - SVRmin) / (1 + exp((P - setpoint)/k))
 *
 * a falling sigmoid: pressure below the setpoint drives constriction toward
 * SVRmax, pressure above it drives dilation toward SVRmin. Two first-order lags
 * follow, one for baroreceptor sensing and one for the vascular effector, so the
 * reflex cannot respond instantaneously to a pressure transient.
 *
 * CALIBRATION. The setpoint and bounds are chosen so that at the unsupported
 * shock operating point the reflex output equals the SVR the open-loop model was
 * calibrated with (~0.96 mmHg*s/mL, ~16 Wood units). That is the physiologically
 * meaningful reading of a shocked patient's high SVR: it IS the reflex, already
 * near maximal constriction. Support then unloads the reflex rather than the
 * model being re-tuned around it.
 *
 * WHAT THIS DELIBERATELY OMITS
 *  - HR. A reflex-driven heart rate would differ between the two panes, which
 *    would desynchronise the shared cardiac clock the twin-pane comparison rests
 *    on. Left out on purpose, not overlooked.
 *  - Contractility. Ees defines this patient's phenotype and is reported in the
 *    UI; letting the reflex move it would make that label unstable.
 *  - Pulsatility sensing. Real baroreceptors fire on the pulsatile component too,
 *    so the loss of pulse pressure on full VA-ECMO is itself a constrictor
 *    stimulus. Omitted; it would push SVR the other way and is not needed for
 *    anything this simulator teaches.
 *  - Venous tone and unstressed-volume recruitment.
 *
 * Reflex gain in cardiogenic shock is variable and often blunted, especially
 * after catecholamines. The gain here is a modelling choice, not a measurement.
 */

import type { PatientParams } from './types';

/** Steady-state effector target for a sensed pressure. */
export function svrTarget(sensedMmHg: number, p: PatientParams): number {
  if (!p.baroEnabled) return p.rSvr;
  const x = (sensedMmHg - p.baroSetpoint) / p.baroK;
  // clamp the exponent so a transient cannot overflow
  const f = 1 / (1 + Math.exp(Math.min(Math.max(x, -40), 40)));
  return p.svrMin + (p.svrMax - p.svrMin) * f;
}

/** Fraction of maximal constriction, 0 (fully dilated) .. 1 (fully constricted). */
export function constrictionFraction(svr: number, p: PatientParams): number {
  const span = p.svrMax - p.svrMin;
  return span > 1e-9 ? Math.min(Math.max((svr - p.svrMin) / span, 0), 1) : 0;
}

export const WOOD_PER_MMHG_S_ML = 16.6667;
