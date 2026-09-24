/**
 * Trans-aortic axial pump (Impella-class). Inlet in LV, outlet in ascending aorta.
 *
 * Flow is NOT a set value. It sits on a monotonically decreasing H-Q line:
 *
 *     dP = P_ao - P_lv           (the head the pump works against)
 *     Q  = max(0, (H0(level) - dP) / K) * suction(V_lv)
 *     H0 = H_MAX * (0.5 + 0.5*level/9)^2      (shut-off head ~ rotor speed^2)
 *
 * So flow surges in systole (dP small) and falls in diastole (dP large), and the
 * same P-level delivers less flow when afterload rises — e.g. under VA-ECMO.
 *
 * Suction guard: as V_lv falls toward V0 the inlet cannot fill; flow rolls off
 * smoothly and a flag is raised.
 *
 * CALIBRATION: H_MAX and K are illustrative values chosen so P2..P8 span roughly
 * 0.5–3.5 L/min at typical shock pressures. They are NOT manufacturer H-Q curves.
 * Retrograde flow through the pump at low speed is not modeled.
 */

const H_MAX = 200; // mmHg, shut-off head at P9
const K = 2.2; // mmHg per mL/s
/** suction roll-off band above V0, mL */
const SUCTION_START = 45; // flow begins to roll off at V0 + 45
const SUCTION_END = 5; // flow reaches zero at V0 + 5

export function shutoffHead(level: number): number {
  const l = Math.min(Math.max(level, 1), 9);
  const w = 0.5 + (0.5 * l) / 9;
  return H_MAX * w * w;
}

export interface ImpellaFlow {
  q: number;
  suction: boolean;
}

export function impellaFlow(level: number, pAo: number, pLv: number, vLv: number, lvV0: number): ImpellaFlow {
  if (level <= 0) return { q: 0, suction: false };
  const presence = Math.min(level, 1); // blends the pump in between level 0 and P1
  const qHq = Math.max(0, (shutoffHead(level) - (pAo - pLv)) / K) * presence;
  const x = (vLv - lvV0 - SUCTION_END) / (SUCTION_START - SUCTION_END);
  const t = x <= 0 ? 0 : x >= 1 ? 1 : x;
  const s = t * t * (3 - 2 * t);
  return { q: qHq * s, suction: s < 0.95 && qHq > 1 };
}
