/**
 * Ventricular time-varying elastance.
 *
 *   P(V,t) = a(t) * Ees*(V - V0)  +  (1 - a(t)) * A*(e^{B(V-V0)} - 1)
 *
 * a(t) in [0,1] is a normalized double-Hill activation (Stergiopulos 1996 form).
 * At a=1 the chamber sits on its linear ESPVR; at a=0 on its exponential EDPVR.
 */

const ALPHA1 = 0.303; // rise midpoint, fraction of an 800 ms reference cycle
const ALPHA2 = 0.508; // fall midpoint
const N1 = 1.32;
const N2 = 21.9;
const REF_CYCLE_MS = 800;

function rawHill(phase: number, scale: number): number {
  const p = phase * scale;
  const g1 = Math.pow(p / ALPHA1, N1);
  const g2 = Math.pow(p / ALPHA2, N2);
  return (g1 / (1 + g1)) * (1 / (1 + g2));
}

/** Systolic duration scales with sqrt(cycle length) so tachycardia shortens systole. */
function scaleFor(cycleMs: number): number {
  return Math.min(Math.max(Math.sqrt(REF_CYCLE_MS / cycleMs), 0.6), 1.9);
}

const peakCache = new Map<number, number>();
function peakFor(cycleMs: number): number {
  const hit = peakCache.get(cycleMs);
  if (hit !== undefined) return hit;
  const s = scaleFor(cycleMs);
  let peak = 0;
  for (let i = 0; i <= 4000; i++) peak = Math.max(peak, rawHill(i / 4000, s));
  peakCache.set(cycleMs, peak);
  return peak;
}

/** Normalized activation at time tMs (possibly fractional) into a beat of cycleMs. */
export function activation(tMs: number, cycleMs: number): number {
  const phase = tMs / cycleMs;
  return rawHill(phase, scaleFor(cycleMs)) / peakFor(cycleMs);
}

export function edpvr(v: number, a: number, b: number, v0: number): number {
  return a * (Math.exp(Math.min(b * (v - v0), 12)) - 1);
}

export function chamberPressure(
  v: number,
  act: number,
  ees: number,
  v0: number,
  a: number,
  b: number,
): number {
  return act * ees * (v - v0) + (1 - act) * edpvr(v, a, b, v0);
}

/** Area under the EDPVR from V0 to V (analytic), mmHg*mL. Used for PVA potential energy. */
export function edpvrIntegral(v: number, a: number, b: number, v0: number): number {
  const d = v - v0;
  return a * ((Math.exp(Math.min(b * d, 12)) - 1) / b - d);
}
