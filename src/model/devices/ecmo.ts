/**
 * Peripheral VA-ECMO: centrifugal pump treated as a flow source. Drains the
 * systemic venous reservoir, returns retrograde into the descending aorta.
 * Circuit volume is constant, so drainage == return at every instant.
 *
 * Nothing here encodes "ECMO worsens the LV". The circuit only moves blood from
 * veins to arteries; the rise in LV afterload and the fall in LV ejection are
 * consequences computed by the circulation.
 *
 * Drainage limit: as venous pressure approaches zero the cannula cannot deliver
 * the commanded flow (chatter); flow rolls off and a flag is raised.
 */

const DRAIN_ZERO_MMHG = 0.5;
const DRAIN_FULL_MMHG = 3.5;

export interface EcmoFlow {
  q: number;
  drainageLimited: boolean;
}

export function ecmoFlow(commandLpm: number, pSv: number): EcmoFlow {
  if (commandLpm <= 0) return { q: 0, drainageLimited: false };
  const x = (pSv - DRAIN_ZERO_MMHG) / (DRAIN_FULL_MMHG - DRAIN_ZERO_MMHG);
  const t = x <= 0 ? 0 : x >= 1 ? 1 : x;
  const s = t * t * (3 - 2 * t);
  return { q: (commandLpm / 0.06) * s, drainageLimited: s < 0.97 };
}
