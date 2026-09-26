/**
 * Schematic layout for the device / anatomy co-registration band.
 *
 * Deliberately schematic, not anatomical. The target is legibility at 1080p after
 * video compression: chambers are simple shapes, vessels are wide strokes, and every
 * device sits in a fixed position. Nothing here can be placed, advanced or
 * repositioned by the learner — only device SETTINGS change.
 *
 * Coordinates are normalised 0..1 on both axes and scaled to whatever box the
 * renderer is given, so the same layout works in the band and in the overlay.
 */

export type AnatomyPart =
  | 'lv'
  | 'la'
  | 'av'
  | 'mitral'
  | 'aortaAsc'
  | 'aortaDesc'
  | 'impella'
  | 'ecmo'
  | 'balloon'
  | 'venous';

export interface Pt {
  x: number;
  y: number;
}

/** Centres and sizes of the fixed structures. */
export const GEO = {
  la: { x: 0.265, y: 0.180, rx: 0.072, ry: 0.052 },
  /** LV centre; its radii are computed live from cavity volume. */
  lv: { x: 0.265, y: 0.560, rxMin: 0.058, rxMax: 0.118, ryMin: 0.090, ryMax: 0.170 },
  mitral: { x: 0.265, y: 0.300, w: 0.050 },
  /** aortic valve sits at the top of the LV outflow tract */
  av: { x: 0.421, y: 0.286, w: 0.060, angle: -0.70 },
  /** LV outflow tract: a tapering neck from the LV cavity up to the aortic valve */
  lvot: { from: { x: 0.318, y: 0.432 }, to: { x: 0.400, y: 0.310 }, w: 0.052 },
  venous: { x: 0.072, y: 0.315, w: 0.082, h: 0.255 },
  ecmoPump: { x: 0.105, y: 0.885, r: 0.038 },
  balloon: { x: 0.737, y: 0.560, maxRx: 0.029, maxRy: 0.082 },
} as const;

/** Vessel and circuit centre-lines. Arrows are animated along these. */
export const PATHS: Record<string, Pt[]> = {
  /** LV outflow -> ascending aorta -> arch -> top of descending aorta */
  aorta: [
    { x: 0.418, y: 0.285 },
    { x: 0.492, y: 0.196 },
    { x: 0.556, y: 0.126 },
    { x: 0.648, y: 0.104 },
    { x: 0.722, y: 0.150 },
    { x: 0.737, y: 0.248 },
  ],
  /** descending aorta, antegrade (downward) */
  descending: [
    { x: 0.737, y: 0.250 },
    { x: 0.737, y: 0.500 },
    { x: 0.737, y: 0.760 },
    { x: 0.737, y: 0.935 },
  ],
  /** Impella: inlet inside the LV, across the valve, outlet in the ascending aorta */
  impella: [
    { x: 0.288, y: 0.512 },
    { x: 0.352, y: 0.398 },
    { x: 0.408, y: 0.298 },
    { x: 0.470, y: 0.216 },
    { x: 0.520, y: 0.158 },
  ],
  /** ECMO venous drainage: venous reservoir -> pump */
  ecmoDrain: [
    { x: 0.072, y: 0.500 },
    { x: 0.075, y: 0.700 },
    { x: 0.088, y: 0.845 },
  ],
  /** ECMO arterial return: pump -> along the floor -> up into the descending aorta.
   *  The final segment runs UPWARD, against antegrade flow: this is the retrograde
   *  return, and it is the reason aortic pressure (and therefore LV afterload) rises. */
  ecmoReturn: [
    { x: 0.145, y: 0.905 },
    { x: 0.360, y: 0.955 },
    { x: 0.600, y: 0.955 },
    { x: 0.716, y: 0.935 },
    { x: 0.737, y: 0.840 },
    { x: 0.737, y: 0.690 },
  ],
  /** pulmonary venous return into the LA — present only to close the loop */
  pulmonary: [
    { x: 0.112, y: 0.128 },
    { x: 0.162, y: 0.122 },
    { x: 0.203, y: 0.148 },
  ],
  /** LA -> LV across the mitral valve */
  mitral: [
    { x: 0.265, y: 0.242 },
    { x: 0.265, y: 0.300 },
    { x: 0.265, y: 0.382 },
  ],
};

/** Catmull-Rom style sampling so arrows travel smoothly along a polyline. */
export function pointAt(path: Pt[], u: number): { p: Pt; angle: number } {
  const n = path.length - 1;
  const t = Math.min(Math.max(u, 0), 0.9999) * n;
  const i = Math.floor(t);
  const f = t - i;
  const a = path[i];
  const b = path[Math.min(i + 1, n)];
  return {
    p: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f },
    angle: Math.atan2(b.y - a.y, b.x - a.x),
  };
}

/** Which structure each causal node lights up. */
export const NODE_PART: Record<string, AnatomyPart> = {
  ecmoFlow: 'ecmo',
  impellaFlow: 'impella',
  balloon: 'balloon',
  avOpen: 'av',
  nativeSv: 'av',
  lvedv: 'lv',
  lvVolume: 'lv',
  lap: 'la',
  arterialVolume: 'aortaDesc',
  map: 'aortaDesc',
  afterload: 'aortaAsc',
  totalFlow: 'aortaDesc',
  lvedp: 'lv',
  pva: 'lv',
};
