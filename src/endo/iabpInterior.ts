/**
 * IABP, seen from inside the aorta.
 *
 * A longitudinal cut-away with the viewer in the lumen: the aortic valve at the
 * left, the root with both coronary ostia, the arch, and the descending thoracic
 * aorta with the balloon in it. Nothing is placed by a timeline:
 *
 *   balloon radius          <- vBalloon           (instantaneous balloon volume)
 *   root wall position      <- pAo                (proximal aortic pressure)
 *   descending wall         <- pSa                (descending/arterial pressure)
 *   coronary inflow arrows  <- (pAo - pLv)+ in diastole, the DPTI integrand;
 *                              position from its running integral over the beat
 *   valve leaflets          <- qAortic
 *   antegrade arrows        <- qAortic, position from state.cum.aortic
 *   root<->descending flow  <- qRc (negative = pushed back toward the root)
 *
 * The frame is computed by a pure function (`iabpFrame`) so the harness can assert
 * every property without a canvas; `drawIabp` only paints a frame.
 */

import type { BeatMetrics, PatientParams, Sample, SimState } from '../model/types';
import { BALLOON_VOLUME_ML, IABP_TIMINGS, type IabpTimingName } from '../model/devices/iabp';
import { valveOpenFraction } from '../ui/drawAnatomy';
import type { TraceBuffer } from '../runtime/buffers';
import { activation } from '../model/ventricle';
import {
  arrowsAlong,
  clamp01,
  COL,
  coronaryArrowCount,
  coronaryGradient,
  coronaryIntegralThisBeat,
  flowArrowCount,
  label,
  lerp,
  MONOF,
  runs,
  sweepPoints,
  type Pt,
} from './common';

/** Which simulator field drives each animated quantity (asserted by E18). */
export const IABP_INTERIOR_READS = {
  balloonRadius: ['vBalloon'],
  rootWall: ['pAo'],
  descendingWall: ['pSa'],
  coronaryInflow: ['pAo', 'pLv', 'activation'],
  valveLeaflets: ['qAortic'],
  antegradeArrows: ['qAortic'],
  rootFlowChevrons: ['qRc'],
  collisionFlag: ['vBalloon', 'qAortic'],
} as const;
/** Integrated state the arrow POSITIONS come from (asserted by E18). */
export const IABP_INTERIOR_CUM = { antegradeArrows: 'aortic' } as const;

/**
 * Wall position for a pressure, as a fraction of the reference lumen radius.
 * A compliant vessel holds volume in proportion to pressure (V = C*P over its
 * stressed range), and radius goes as the square root of cross-section, so
 * r ~ sqrt(P_OFF + P). P_OFF stands in for the unstressed volume. Fixed constants:
 * the same pressure is the same wall position in every state and every pane.
 */
const P_OFF = 60;
const P_REF = 60;
export function wallRadius(pMmHg: number): number {
  return Math.sqrt((P_OFF + Math.max(pMmHg, 0)) / (P_OFF + P_REF));
}

/** Balloon radius as a fraction of the reference lumen radius; cross-section ~ volume. */
export const BALLOON_R_MAX = 0.6;
export function balloonRadius(vBalloon: number): number {
  return BALLOON_R_MAX * Math.sqrt(clamp01(vBalloon / BALLOON_VOLUME_ML));
}

/** Balloon inflated (in mL) while the valve is ejecting: the mistiming made visible. */
export const COLLISION_ML = 2;

export interface IabpFrame {
  balloonR: number;
  rootR: number;
  descR: number;
  coronaryGrad: number;
  coronaryArrows: number;
  /** 0..1, from the running integral of the coronary gradient */
  coronaryPhase: number;
  valveOpen: number;
  antegradeArrows: number;
  antegradePhase: number;
  qRc: number;
  collision: boolean;
  /** reference wall position at this pane's last systolic peak (per-beat, not animated) */
  sbpR: number | null;
}

/** mmHg*s of integrated coronary gradient per arrow spacing */
const CORONARY_SPACING = 2.4;
/** mL of antegrade volume per arrow spacing */
const ANTEGRADE_SPACING = 26;

export function iabpFrame(s: Sample, st: SimState, last: BeatMetrics | null, coronaryIntegral: number): IabpFrame {
  const g = coronaryGradient(s);
  return {
    balloonR: balloonRadius(s.vBalloon),
    rootR: wallRadius(s.pAo),
    descR: wallRadius(s.pSa),
    coronaryGrad: g,
    coronaryArrows: coronaryArrowCount(g),
    coronaryPhase: (coronaryIntegral / CORONARY_SPACING) % 1,
    valveOpen: valveOpenFraction(s.qAortic),
    antegradeArrows: flowArrowCount(s.qAortic),
    antegradePhase: (st.cum.aortic / ANTEGRADE_SPACING) % 1,
    qRc: s.qRc,
    collision: s.vBalloon > COLLISION_ML && s.qAortic > 0,
    sbpR: last ? wallRadius(last.sbp) : null,
  };
}

/** Which named timing the pane is running, if any. */
export function timingName(st: SimState): IabpTimingName | null {
  const s = st.settings;
  return (Object.keys(IABP_TIMINGS) as IabpTimingName[]).find(
    (k) => IABP_TIMINGS[k].inflate === s.iabpInflateOffsetMs && IABP_TIMINGS[k].deflate === s.iabpDeflateOffsetMs,
  ) ?? null;
}

/* ------------------------------------------------------------------ geometry */

export interface IabpGeom {
  W: number;
  H: number;
  cy: number;
  R: number;
  x0: number;
  xOst: number;
  xArch0: number;
  xArch1: number;
  xb0: number;
  xb1: number;
  x1: number;
}

export function iabpGeom(W: number, H: number): IabpGeom {
  return {
    W,
    H,
    cy: H * 0.345,
    R: Math.min(H * 0.17, W * 0.1),
    x0: W * 0.085,
    xOst: W * 0.15,
    xArch0: W * 0.28,
    xArch1: W * 0.42,
    xb0: W * 0.5,
    xb1: W * 0.93,
    x1: W * 0.985,
  };
}

/** Lumen radius (px) at x: root pressure proximally, descending pressure distally. */
function rAt(g: IabpGeom, f: IabpFrame, x: number): number {
  const t = clamp01((x - g.xArch0) / (g.xArch1 - g.xArch0));
  const ss = t * t * (3 - 2 * t);
  return g.R * lerp(f.rootR, f.descR, ss);
}

/* ------------------------------------------------------------------ drawing */

export interface IabpDrawInput {
  s: Sample;
  st: SimState;
  last: BeatMetrics | null;
  trace: TraceBuffer;
  cycleMs: number;
  p: PatientParams;
}

export function drawIabp(c: CanvasRenderingContext2D, W: number, H: number, inp: IabpDrawInput): IabpFrame {
  const f = iabpFrame(inp.s, inp.st, inp.last, coronaryIntegralThisBeat(inp.trace, inp.s, inp.cycleMs, inp.p));
  const g = iabpGeom(W, H);
  c.clearRect(0, 0, W, H);

  drawVessel(c, g, f);
  drawCoronaries(c, g, f);
  drawValve(c, g, f);
  drawBalloon(c, g, f);
  drawFlow(c, g, f);
  drawLabels(c, g, f);
  drawSweep(c, W, H, inp);
  return f;
}

function drawVessel(c: CanvasRenderingContext2D, g: IabpGeom, f: IabpFrame) {
  const xs: number[] = [];
  for (let x = g.x0; x <= g.x1; x += 6) xs.push(x);
  xs.push(g.x1);
  const wallT = g.R * 0.16;

  // wall (outer band) then lumen
  c.save();
  c.beginPath();
  xs.forEach((x, i) => (i ? c.lineTo(x, g.cy - rAt(g, f, x) - wallT) : c.moveTo(x, g.cy - rAt(g, f, x) - wallT)));
  for (let i = xs.length - 1; i >= 0; i--) c.lineTo(xs[i], g.cy + rAt(g, f, xs[i]) + wallT);
  c.closePath();
  c.fillStyle = COL.wall;
  c.fill();
  c.beginPath();
  xs.forEach((x, i) => (i ? c.lineTo(x, g.cy - rAt(g, f, x)) : c.moveTo(x, g.cy - rAt(g, f, x))));
  for (let i = xs.length - 1; i >= 0; i--) c.lineTo(xs[i], g.cy + rAt(g, f, xs[i]));
  c.closePath();
  c.fillStyle = COL.lumen;
  c.fill();
  c.strokeStyle = COL.wallHi;
  c.lineWidth = 2;
  c.stroke();
  c.restore();

  // the systolic-peak wall position of the last beat: augmentation that pushes the
  // wall past this line is diastolic pressure exceeding systolic pressure
  if (f.sbpR !== null) {
    const r = g.R * f.sbpR;
    c.save();
    c.setLineDash([6, 7]);
    c.strokeStyle = COL.dim;
    c.globalAlpha = 0.75;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(g.xArch1, g.cy - r);
    c.lineTo(g.x1, g.cy - r);
    c.moveTo(g.xArch1, g.cy + r);
    c.lineTo(g.x1, g.cy + r);
    c.stroke();
    c.restore();
  }
}

function coronaryPaths(g: IabpGeom, f: IabpFrame): { lm: Pt[]; rca: Pt[] } {
  const rTop = rAt(g, f, g.xOst);
  const x = g.xOst;
  const reach = g.R * 0.78;
  // paths run from the lumen, through the ostium in the wall, then out along the
  // artery, which curves back over the root the way the coronaries do
  const lm: Pt[] = [];
  const rca: Pt[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const u = Math.max(0, (t - 0.33) / 0.67);
    const dx = -Math.sin(u * Math.PI * 0.5) * g.R * 0.55;
    const depth = t < 0.33 ? lerp(rTop * 0.45, rTop, t / 0.33) : rTop + u * reach;
    lm.push({ x: x + dx, y: g.cy - depth });
    rca.push({ x: x + dx, y: g.cy + depth });
  }
  return { lm, rca };
}

function drawCoronaries(c: CanvasRenderingContext2D, g: IabpGeom, f: IabpFrame) {
  const { lm, rca } = coronaryPaths(g, f);
  const w = g.R * 0.26;
  for (const path of [lm, rca]) {
    // the artery segment outside the aortic wall (fixed calibre: not a modelled compartment)
    const outside = path.slice(4);
    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = COL.wall;
    c.lineWidth = w + 8;
    c.beginPath();
    outside.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.stroke();
    c.strokeStyle = COL.lumen;
    c.lineWidth = w;
    c.stroke();
    // inflow glow: brightness from the instantaneous gradient
    const k = clamp01(f.coronaryGrad / 60);
    if (k > 0) {
      c.globalAlpha = 0.18 + 0.5 * k;
      c.strokeStyle = COL.coronary;
      c.lineWidth = w * (0.35 + 0.55 * k);
      c.stroke();
    }
    c.restore();
    arrowsAlong(c, path, f.coronaryPhase, f.coronaryArrows, COL.coronary, g.R * 0.11);
  }
}

function drawValve(c: CanvasRenderingContext2D, g: IabpGeom, f: IabpFrame) {
  const r = rAt(g, f, g.x0);
  const len = r * 0.98;
  // leaflets hinge at the wall and swing downstream as flow crosses them
  const ang = (Math.PI / 2) * 0.82 * f.valveOpen;
  c.save();
  c.lineCap = 'round';
  c.strokeStyle = f.collision ? COL.bad : COL.ao;
  c.lineWidth = Math.max(4, g.R * 0.05);
  c.beginPath();
  c.moveTo(g.x0, g.cy - r);
  c.lineTo(g.x0 + Math.sin(ang) * len, g.cy - r + Math.cos(ang) * len);
  c.moveTo(g.x0, g.cy + r);
  c.lineTo(g.x0 + Math.sin(ang) * len, g.cy + r - Math.cos(ang) * len);
  c.stroke();
  c.restore();
}

function balloonOutline(c: CanvasRenderingContext2D, g: IabpGeom, rb: number) {
  const L = g.xb1 - g.xb0;
  const cap = Math.min(rb * 1.4, L * 0.12);
  c.beginPath();
  c.moveTo(g.xb0 + cap, g.cy - rb);
  c.lineTo(g.xb1 - cap, g.cy - rb);
  c.quadraticCurveTo(g.xb1, g.cy - rb, g.xb1, g.cy);
  c.quadraticCurveTo(g.xb1, g.cy + rb, g.xb1 - cap, g.cy + rb);
  c.lineTo(g.xb0 + cap, g.cy + rb);
  c.quadraticCurveTo(g.xb0, g.cy + rb, g.xb0, g.cy);
  c.quadraticCurveTo(g.xb0, g.cy - rb, g.xb0 + cap, g.cy - rb);
  c.closePath();
}

function drawBalloon(c: CanvasRenderingContext2D, g: IabpGeom, f: IabpFrame) {
  // the catheter shaft runs the whole length (it is there whether or not the balloon is full)
  c.save();
  c.strokeStyle = COL.dim;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(g.xb0 - g.R * 0.25, g.cy);
  c.lineTo(g.x1, g.cy);
  c.stroke();
  c.restore();

  const rb = g.R * f.balloonR;
  // the fully inflated outline, dashed, so the degree of fill reads at a glance
  c.save();
  balloonOutline(c, g, g.R * BALLOON_R_MAX);
  c.setLineDash([4, 6]);
  c.strokeStyle = COL.balloon;
  c.globalAlpha = 0.35;
  c.lineWidth = 1.5;
  c.stroke();
  c.restore();

  if (rb > 1) {
    c.save();
    balloonOutline(c, g, rb);
    c.fillStyle = f.collision ? 'rgba(250,82,82,0.30)' : 'rgba(247,131,172,0.30)';
    c.fill();
    c.strokeStyle = f.collision ? COL.bad : COL.balloon;
    c.lineWidth = 3;
    c.stroke();
    c.restore();
  }
}

function drawFlow(c: CanvasRenderingContext2D, g: IabpGeom, f: IabpFrame) {
  // antegrade ejection through the root; position = volume actually ejected
  const path: Pt[] = [
    { x: g.x0 + 6, y: g.cy },
    { x: g.xArch1, y: g.cy },
  ];
  arrowsAlong(c, path, f.antegradePhase, f.antegradeArrows, COL.ao, g.R * 0.13);

  // flow between root and descending aorta. Negative qRc is blood pushed BACK toward
  // the root and the coronary ostia - which is what an inflating balloon does.
  const mag = Math.abs(f.qRc);
  if (mag > 5) {
    const dir = Math.sign(f.qRc);
    const k = clamp01(mag / 120);
    const col = dir < 0 ? COL.balloon : COL.ao;
    const xm = (g.xArch1 + g.xb0) / 2;
    const size = g.R * (0.07 + 0.1 * k);
    c.save();
    c.strokeStyle = col;
    c.lineWidth = 3 + 3 * k;
    c.lineCap = 'round';
    c.globalAlpha = 0.35 + 0.6 * k;
    for (const dy of [-0.42, 0, 0.42]) {
      const y = g.cy + dy * g.R * 0.7;
      for (const dx of [-1, 1]) {
        const x = xm + dx * size * 1.6;
        c.beginPath();
        c.moveTo(x - dir * size * 0.6, y - size);
        c.lineTo(x + dir * size * 0.6, y);
        c.lineTo(x - dir * size * 0.6, y + size);
        c.stroke();
      }
    }
    c.restore();
  }
}

function drawLabels(c: CanvasRenderingContext2D, g: IabpGeom, f: IabpFrame) {
  label(c, 'LV', g.x0 - g.R * 0.35, g.cy, COL.lv, 22, 'center', 700);
  label(c, 'aortic valve', g.x0 - g.R * 0.35, g.cy + g.R * 0.55, COL.dim, 16, 'center');
  const { lm, rca } = coronaryPaths(g, f);
  const lmEnd = lm[lm.length - 1];
  const rcaEnd = rca[rca.length - 1];
  label(c, 'left main', lmEnd.x - g.R * 0.25, lmEnd.y, COL.coronary, 17, 'right');
  label(c, 'right coronary', rcaEnd.x - g.R * 0.25, rcaEnd.y, COL.coronary, 17, 'right');
  label(c, 'arch', (g.xArch0 + g.xArch1) / 2, g.cy - g.R * 1.45, COL.faint, 16, 'center');
  label(c, 'descending thoracic aorta', (g.xb0 + g.xb1) / 2, g.cy - g.R * 1.45, COL.faint, 16, 'center');
  if (f.sbpR !== null) label(c, 'wall at last systolic peak', g.x1 - 4, g.cy + g.R * f.sbpR + 16, COL.dim, 14, 'right');
  label(c, 'balloon', g.xb0 + 12, g.cy + g.R * 0.08 + g.R * Math.max(f.balloonR, 0.12) + 18, COL.balloon, 17);
  if (f.collision) {
    label(c, 'BALLOON INFLATED WHILE THE VALVE IS OPEN — the LV is ejecting into it', (g.x0 + g.xb1) / 2, g.cy + g.R * 1.62, COL.bad, 19, 'center', 700);
  }
}

/* ------------------------------------------------------------------ timing strip */

function drawSweep(c: CanvasRenderingContext2D, W: number, H: number, inp: IabpDrawInput) {
  const x0 = W * 0.085;
  const x1 = W * 0.86;
  const top = H * 0.72;
  const bot = H * 0.965;
  const rowH = (bot - top) / 3;
  const X = (ph: number) => lerp(x0, x1, ph);
  const pts = sweepPoints(inp.trace, inp.s, inp.cycleMs);
  const d = inp.trace.data;

  c.save();
  c.fillStyle = 'rgba(255,255,255,0.025)';
  c.fillRect(x0, top, x1 - x0, bot - top);
  c.restore();

  const rows: [string, string][] = [
    ['valve open', COL.ao],
    ['balloon', COL.balloon],
    ['coronary drive', COL.coronary],
  ];
  rows.forEach(([name, col], k) => label(c, name, x0 - 12, top + rowH * (k + 0.5), col, 15, 'right'));

  // row 1: aortic valve open (ideal diode: open iff P_LV > P_Ao)
  const valve = runs(pts, (p) => d.pLv[p.i] > d.pAo[p.i]);
  for (const [a, b, cur] of valve) {
    c.fillStyle = COL.ao;
    c.globalAlpha = cur ? 0.9 : 0.3;
    c.fillRect(X(a), top + rowH * 0.22, Math.max(X(b) - X(a), 2), rowH * 0.56);
  }
  c.globalAlpha = 1;

  // collision: balloon inflated while the valve is open
  const coll = runs(pts, (p) => d.pLv[p.i] > d.pAo[p.i] && d.vBalloon[p.i] > COLLISION_ML);
  for (const [a, b, cur] of coll) {
    c.fillStyle = COL.bad;
    c.globalAlpha = cur ? 0.35 : 0.15;
    c.fillRect(X(a), top, Math.max(X(b) - X(a), 3), rowH * 2);
  }
  c.globalAlpha = 1;

  // rows 2 and 3: balloon volume and coronary gradient as filled curves
  const curve = (row: number, val: (i: number, p: (typeof pts)[number]) => number, col: string) => {
    const base = top + rowH * (row + 0.9);
    const h = rowH * 0.8;
    for (const cur of [false, true]) {
      const seg = pts.filter((p) => p.current === cur);
      if (seg.length < 2) continue;
      c.beginPath();
      c.moveTo(X(seg[0].phase), base);
      for (const p of seg) c.lineTo(X(p.phase), base - h * clamp01(val(p.i, p)));
      c.lineTo(X(seg[seg.length - 1].phase), base);
      c.closePath();
      c.fillStyle = col;
      c.globalAlpha = cur ? 0.55 : 0.18;
      c.fill();
    }
    c.globalAlpha = 1;
  };
  curve(1, (i) => d.vBalloon[i] / BALLOON_VOLUME_ML, COL.balloon);
  curve(2, (i, p) => coronaryGradient({ activation: activation(p.tickInBeat, inp.cycleMs, inp.p.actScale), pAo: d.pAo[i], pLv: d.pLv[i] }) / 70, COL.coronary);

  // console timing references: where inflation should start and deflation should be done
  const marks: [number | null, string][] = [
    [inp.st.iabpNotchMs, 'inflation reference (dicrotic notch)'],
    [inp.st.iabpOpenMs, 'deflation reference (unassisted AV opening)'],
  ];
  c.save();
  for (const [ms, text] of marks) {
    if (ms === null) continue;
    const x = X(ms / inp.cycleMs);
    c.setLineDash([5, 5]);
    c.strokeStyle = COL.text;
    c.globalAlpha = 0.6;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(x, top - 4);
    c.lineTo(x, bot);
    c.stroke();
    c.setLineDash([]);
    c.globalAlpha = 1;
    label(c, text, x + 6, top - 12, COL.text, 14);
  }
  c.restore();

  // the cursor: where in the cycle the picture above is
  const xc = X(inp.s.tickInBeat / inp.cycleMs);
  c.save();
  c.strokeStyle = COL.text;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(xc, top - 2);
  c.lineTo(xc, bot + 2);
  c.stroke();
  c.restore();

  c.save();
  c.font = MONOF(13);
  c.fillStyle = COL.faint;
  c.textAlign = 'left';
  c.fillText('ONE CARDIAC CYCLE · live sweep, same clock as the view above', x0, bot + 16);
  c.restore();

  // what is happening right now, in words, from state alone
  const now = inp.s;
  const g = coronaryGradient(now);
  const lines: [string, string][] = [];
  if (now.vBalloon > COLLISION_ML && now.qAortic > 0) lines.push(['balloon full, valve open', COL.bad]);
  else if (now.qAortic > 0) lines.push(['LV ejecting', COL.ao]);
  else if (now.vBalloon > COLLISION_ML) lines.push(['balloon inflated', COL.balloon]);
  else lines.push(['balloon empty', COL.dim]);
  lines.push([g > 0.5 ? 'coronaries filling' : 'no coronary drive', g > 0.5 ? COL.coronary : COL.faint]);
  lines.forEach(([t, col], k) => label(c, t, x1 + 24, top + rowH * (k + 0.6), col, 17, 'left', 700));
}
