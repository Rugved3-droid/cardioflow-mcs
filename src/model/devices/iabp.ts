/**
 * Intra-aortic balloon pump.
 *
 * The balloon occupies volume inside the descending-aorta compartment. It does
 * not add or remove blood: it changes the space blood is squeezed into, so
 *
 *     P_sa = (V_blood_sa + V_balloon(t)) / C_sa
 *
 * Diastolic augmentation, the pre-systolic pressure drop on deflation, and every
 * mistiming consequence fall out of that one line plus the balloon schedule.
 *
 * Schedule (ms from beat start = LV activation onset = end-diastole):
 *   inflation begins at the dicrotic-notch reference + inflate offset
 *   deflation completes DEFLATE_LEAD_MS before the NEXT beat's aortic-valve opening
 *   (i.e. during isovolumic contraction), shifted by the deflate offset.
 * Both references are captured from an unassisted beat. Because the balloon
 * deflates inside the following beat, each beat evaluates its own pulse plus
 * the previous beat's tail.
 */

export const BALLOON_VOLUME_ML = 40;
const INFLATE_MS = 60;
const DEFLATE_MS = 50;
const DEFLATE_LEAD_MS = 20;
/** Used only if the valve never opened on the reference beat. */
export const FALLBACK_NOTCH_FRACTION = 0.4;
export const FALLBACK_OPEN_FRACTION = 0.1;

/** Named mistimings. Offsets in ms; these are the only values the UI/assessment use. */
export const IABP_TIMINGS = {
  correct: { inflate: 0, deflate: 0, label: 'Correct timing' },
  earlyInflation: { inflate: -70, deflate: 0, label: 'Early inflation' },
  lateInflation: { inflate: 90, deflate: 0, label: 'Late inflation' },
  earlyDeflation: { inflate: 0, deflate: -170, label: 'Early deflation' },
  lateDeflation: { inflate: 0, deflate: 70, label: 'Late deflation' },
} as const;
export type IabpTimingName = keyof typeof IABP_TIMINGS;

function smoothstep(x: number): number {
  const t = x <= 0 ? 0 : x >= 1 ? 1 : x;
  return t * t * (3 - 2 * t);
}

/** Balloon volume fraction 0..1 for a pulse whose beat started at 0, evaluated at u ms. */
function pulse(u: number, inflateStart: number, deflateStart: number): number {
  const rise = smoothstep((u - inflateStart) / INFLATE_MS);
  if (rise <= 0) return 0;
  return rise * (1 - smoothstep((u - deflateStart) / DEFLATE_MS));
}

export function balloonVolume(
  tInBeatMs: number,
  cycleMs: number,
  notchMs: number,
  openMs: number,
  inflateOffsetMs: number,
  deflateOffsetMs: number,
  fill: number,
  /** is the balloon pulse that starts in this beat enabled / the one from the previous beat? */
  thisBeatAssisted = true,
  prevBeatAssisted = true,
): number {
  if (fill <= 0) return 0;
  const inflateStart = notchMs + inflateOffsetMs;
  // deflation may not begin before the balloon has finished inflating
  const deflateStart = Math.max(
    cycleMs + openMs - DEFLATE_LEAD_MS - DEFLATE_MS + deflateOffsetMs,
    inflateStart + INFLATE_MS,
  );
  const f =
    (thisBeatAssisted ? pulse(tInBeatMs, inflateStart, deflateStart) : 0) +
    (prevBeatAssisted ? pulse(tInBeatMs + cycleMs, inflateStart, deflateStart) : 0);
  return BALLOON_VOLUME_ML * fill * Math.min(f, 1);
}
