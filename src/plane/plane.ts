/**
 * The perfusion / unloading plane.
 *
 * Two axes that a single number cannot express, plotted against each other so the
 * divergence between them is visible as geometry:
 *
 *   X  systemic support   — is the body being perfused?
 *   Y  ventricular unloading — is the ventricle being spared?
 *
 * VA-ECMO moves a patient RIGHT and DOWN: perfusion bought at the ventricle's
 * expense. Adding a vent moves them back UP without giving up the X. No single
 * number on a monitor shows that, which is the reason this view exists.
 *
 * NORMALISATION. Both axes are 0..1 against FIXED anchors chosen from clinical
 * reference points, never from the data being plotted. Fixed anchors mean a point
 * has the same position in every session and between any two states, so positions
 * are comparable. Values outside the anchors clamp, and each axis is the unweighted
 * mean of its two components, so neither dominates.
 *
 * THIS IS NOT A VALIDATED CLINICAL SCORE. The axes are a teaching construction.
 * No threshold on this plane has any established meaning, and nothing here should
 * be read as a target, a risk score, or a treatment indication.
 */

import type { BeatMetrics } from '../model/types';

/** Anchors: [value mapping to 0, value mapping to 1]. */
export const ANCHORS = {
  /** MAP 50 = profound shock; 90 = comfortably adequate perfusion pressure. */
  map: [50, 90] as const,
  /** Total systemic flow 2.0 L/min ≈ CI 1.1 at BSA 1.8; 7.0 ≈ CI 3.9 (over-supported). */
  flow: [2.0, 7.0] as const,
  /** LVEDP 35 mmHg = severe congestion (Y=0); 8 mmHg = normal filling pressure (Y=1). */
  lvedp: [35, 8] as const,
  /** PVA 9000 mmHg·mL = high myocardial O2 demand (Y=0); 3000 = low (Y=1). */
  pva: [9000, 3000] as const,
} as const;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const norm = (v: number, [lo, hi]: readonly [number, number]) => clamp01((v - lo) / (hi - lo));

export interface PlanePoint {
  /** systemic support, 0..1 */
  x: number;
  /** ventricular unloading, 0..1 */
  y: number;
  /** components, so the UI can show what moved */
  xMap: number;
  xFlow: number;
  yLvedp: number;
  yPva: number;
}

export function planePoint(m: BeatMetrics): PlanePoint {
  const xMap = norm(m.map, ANCHORS.map);
  const xFlow = norm(m.totalFlowLpm, ANCHORS.flow);
  const yLvedp = norm(m.lvedp, ANCHORS.lvedp);
  const yPva = norm(m.pva, ANCHORS.pva);
  return { x: (xMap + xFlow) / 2, y: (yLvedp + yPva) / 2, xMap, xFlow, yLvedp, yPva };
}

export const AXIS_LABEL = {
  x: 'SYSTEMIC SUPPORT',
  xSub: 'MAP + total flow',
  y: 'VENTRICULAR UNLOADING',
  ySub: 'inverse LVEDP + inverse PVA',
} as const;

export const PLANE_DISCLAIMER =
  'Educational visualisation. Not a validated clinical score — no threshold here has established meaning.';
