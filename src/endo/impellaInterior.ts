/**
 * Impella, seen from inside the left ventricle.
 *
 * Left: a long-axis cut-away with the viewer in the cavity. The pump crosses the
 * aortic valve: inlet down in the chamber, outlet up in the ascending aorta. Right:
 * the same aortic valve seen from below, with the cannula passing through it, over
 * a one-cycle sweep. Nothing is placed by a timeline:
 *
 *   endocardial wall        <- vLv                (instantaneous cavity volume)
 *   wall thickness          <- vLv                (constant muscle volume, as E17)
 *   inlet/cannula/outlet    <- qImpella, position from state.cum.impella
 *   native ejection         <- qAortic,  position from state.cum.aortic
 *   mitral inflow           <- qMitral,  position from state.cum.mitral
 *   valve leaflets, en face <- qAortic
 *   ascending aortic wall   <- pAo
 *   pre-change ghost        <- the pane's captured reference PV loop (its EDV)
 *
 * Wall distance from the viewer uses a fixed camera volume: d = cbrt(V) - cbrt(V_CAM).
 * The viewer occupies the middle of the cavity, so the walls are drawn at their
 * distance from the viewer rather than from an empty centre. It is monotonic in V and
 * the constants are fixed, so the same volume is the same picture in every state;
 * what it buys is that unloading reads as the walls closing in around you.
 */

import type { BeatMetrics, PatientParams, Sample, SimState } from '../model/types';
import { valveOpenFraction, MYOCARDIAL_ML } from '../ui/drawAnatomy';
import type { PvBuffer, TraceBuffer } from '../runtime/buffers';
import { arrowsAlong, clamp01, COL, flowArrowCount, label, lerp, MONOF, runs, sweepPoints, type Pt } from './common';
import { wallRadius } from './iabpInterior';

/** Which simulator field drives each animated quantity (asserted by E18). */
export const IMPELLA_INTERIOR_READS = {
  cavityWalls: ['vLv'],
  wallThickness: ['vLv'],
  inletArrows: ['qImpella'],
  cannulaArrows: ['qImpella'],
  outletArrows: ['qImpella'],
  nativeEjectionArrows: ['qAortic'],
  mitralArrows: ['qMitral'],
  valveLeaflets: ['qAortic'],
  valveFromBelow: ['qAortic'],
  ascendingWall: ['pAo'],
} as const;
export const IMPELLA_INTERIOR_CUM = {
  inletArrows: 'impella',
  cannulaArrows: 'impella',
  outletArrows: 'impella',
  nativeEjectionArrows: 'aortic',
  mitralArrows: 'mitral',
} as const;

/** Volume the viewer occupies, mL. Fixed. */
export const V_CAM = 60;
/** Volume at which the walls sit at their full drawn distance, mL (same bound as the anatomy band). */
export const V_FULL = 240;
const D_FULL = Math.cbrt(V_FULL) - Math.cbrt(V_CAM);

/** Endocardial distance from the viewer as a fraction of full; strictly monotonic in V above V_CAM. */
export function wallDistance(vLv: number): number {
  return Math.max(Math.cbrt(Math.max(vLv, 0)) - Math.cbrt(V_CAM), 0) / D_FULL;
}
/** Epicardial distance: cavity plus constant muscle, on the same camera. */
export function epiDistance(vLv: number): number {
  return (Math.cbrt(Math.max(vLv, 0) + MYOCARDIAL_ML) - Math.cbrt(V_CAM)) / D_FULL;
}

/** Inlet arrow count for a pump flow, mL/s. Monotonic, zero at zero (E18). */
export function inletArrowCount(qImpella: number): number {
  return flowArrowCount(qImpella);
}

export interface ImpellaFrame {
  wall: number;
  epi: number;
  pumpArrows: number;
  /** 0..1 along the inlet -> outlet path, from cumulative pumped volume */
  pumpPhase: number;
  nativeArrows: number;
  nativePhase: number;
  mitralArrows: number;
  mitralPhase: number;
  valveOpen: number;
  aoR: number;
  /** wall distance at the end-diastolic volume of the pane's pre-change reference loop */
  ghost: number | null;
}

const PUMP_SPACING = 14;
const NATIVE_SPACING = 20;
const MITRAL_SPACING = 26;

/** End-diastolic volume of the reference loop captured at the last therapy change. */
export function referenceEdv(pv: PvBuffer): number | null {
  const ref = pv.reference;
  if (!ref || ref.length < 4) return null;
  let v = -Infinity;
  for (let i = 0; i < ref.length; i += 2) v = Math.max(v, ref[i]);
  return Number.isFinite(v) ? v : null;
}

export function impellaFrame(s: Sample, st: SimState, refEdv: number | null): ImpellaFrame {
  return {
    wall: wallDistance(s.vLv),
    epi: epiDistance(s.vLv),
    pumpArrows: inletArrowCount(s.qImpella),
    pumpPhase: (st.cum.impella / PUMP_SPACING) % 1,
    nativeArrows: flowArrowCount(s.qAortic),
    nativePhase: (st.cum.aortic / NATIVE_SPACING) % 1,
    mitralArrows: flowArrowCount(s.qMitral) * 0.6,
    mitralPhase: (st.cum.mitral / MITRAL_SPACING) % 1,
    valveOpen: valveOpenFraction(s.qAortic),
    aoR: wallRadius(s.pAo),
    ghost: refEdv !== null ? wallDistance(refEdv) : null,
  };
}

/* ------------------------------------------------------------------ geometry */

export interface ImpellaGeom {
  W: number;
  H: number;
  xc: number;
  /** valve plane */
  yV: number;
  /** annulus half-width */
  rV: number;
  /** full-volume endocardial half-width and depth below the valve plane */
  A: number;
  D: number;
  yIn: number;
  yOut: number;
  aoR0: number;
}

export function impellaGeom(W: number, H: number): ImpellaGeom {
  const mainW = W * 0.6;
  return {
    W,
    H,
    xc: mainW * 0.5,
    yV: H * 0.27,
    rV: Math.min(H * 0.085, mainW * 0.07),
    A: mainW * 0.5,
    D: H * 0.98,
    yIn: H * 0.27 + H * 0.34,
    yOut: H * 0.27 - H * 0.15,
    aoR0: Math.min(H * 0.1, mainW * 0.08),
  };
}

/** Cavity outline for walls at distance k: valve plane fixed at the top, apex below. */
function cavityPath(c: CanvasRenderingContext2D, g: ImpellaGeom, k: number) {
  const a = g.A * k;
  const depth = g.D * k;
  const base = Math.max(g.rV * 1.25, a * 0.55);
  const apexY = g.yV + depth;
  c.beginPath();
  c.moveTo(g.xc - base, g.yV);
  c.lineTo(g.xc + base, g.yV);
  c.bezierCurveTo(g.xc + a * 1.02, g.yV + depth * 0.02, g.xc + a * 1.08, g.yV + depth * 0.45, g.xc + a * 0.62, g.yV + depth * 0.8);
  c.quadraticCurveTo(g.xc + a * 0.3, apexY, g.xc, apexY);
  c.quadraticCurveTo(g.xc - a * 0.3, apexY, g.xc - a * 0.62, g.yV + depth * 0.8);
  c.bezierCurveTo(g.xc - a * 1.08, g.yV + depth * 0.45, g.xc - a * 1.02, g.yV + depth * 0.02, g.xc - base, g.yV);
  c.closePath();
}

/* ------------------------------------------------------------------ drawing */

export interface ImpellaDrawInput {
  s: Sample;
  st: SimState;
  last: BeatMetrics | null;
  trace: TraceBuffer;
  pv: PvBuffer;
  cycleMs: number;
  p: PatientParams;
}

export function drawImpella(c: CanvasRenderingContext2D, W: number, H: number, inp: ImpellaDrawInput): ImpellaFrame {
  const f = impellaFrame(inp.s, inp.st, referenceEdv(inp.pv));
  const g = impellaGeom(W, H);
  c.clearRect(0, 0, W, H);

  c.save();
  c.beginPath();
  c.rect(0, 0, W * 0.6, H);
  c.clip();
  drawChamber(c, g, f);
  drawAorta(c, g, f);
  drawPump(c, g, f);
  drawChamberLabels(c, g, f);
  c.restore();

  drawValveFromBelow(c, W, H, f);
  drawSweep(c, W, H, inp);
  return f;
}

function drawChamber(c: CanvasRenderingContext2D, g: ImpellaGeom, f: ImpellaFrame) {
  // myocardium: everything between the epicardium and the cavity
  c.save();
  cavityPath(c, g, f.epi);
  c.fillStyle = COL.myo;
  c.fill();
  c.restore();

  // cavity
  c.save();
  cavityPath(c, g, f.wall);
  c.fillStyle = COL.lumen;
  c.fill();
  c.strokeStyle = COL.lv;
  c.lineWidth = 4;
  c.stroke();
  c.restore();

  // where the walls were at end-diastole before the last therapy change
  if (f.ghost !== null && Math.abs(f.ghost - f.wall) > 0.004) {
    c.save();
    cavityPath(c, g, f.ghost);
    c.setLineDash([10, 9]);
    c.strokeStyle = COL.text;
    c.globalAlpha = 0.55;
    c.lineWidth = 2;
    c.stroke();
    c.restore();
  }

  // mitral inflow, entering beside the aortic valve from the left atrium
  const mit: Pt[] = [
    { x: g.xc - g.rV * 3.1, y: g.yV - g.H * 0.02 },
    { x: g.xc - g.rV * 2.6, y: g.yV + g.H * 0.12 },
    { x: g.xc - g.rV * 2.0, y: g.yV + g.H * 0.26 },
  ];
  arrowsAlong(c, mit, f.mitralPhase, f.mitralArrows, '#ffd43b', g.rV * 0.26, 0.8);
}

function drawAorta(c: CanvasRenderingContext2D, g: ImpellaGeom, f: ImpellaFrame) {
  const r = g.aoR0 * f.aoR;
  c.save();
  c.fillStyle = COL.wall;
  c.fillRect(g.xc - r - 12, 0, 2 * r + 24, g.yV);
  c.fillStyle = COL.lumen;
  c.fillRect(g.xc - r, 0, 2 * r, g.yV);
  c.restore();

  // annulus and leaflets, hinged at the annulus, opening upward with native ejection
  const ang = (Math.PI / 2) * 0.8 * f.valveOpen;
  const len = g.rV * 0.95;
  c.save();
  c.lineCap = 'round';
  c.strokeStyle = COL.ao;
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(g.xc - g.rV, g.yV);
  c.lineTo(g.xc - g.rV + Math.cos(ang) * len, g.yV - Math.sin(ang) * len);
  c.moveTo(g.xc + g.rV, g.yV);
  c.lineTo(g.xc + g.rV - Math.cos(ang) * len, g.yV - Math.sin(ang) * len);
  c.stroke();
  c.restore();

  // native ejection through the valve, beside the cannula
  for (const side of [-1, 1]) {
    const path: Pt[] = [
      { x: g.xc + side * g.rV * 0.55, y: g.yV + g.H * 0.1 },
      { x: g.xc + side * g.rV * 0.55, y: 0 },
    ];
    arrowsAlong(c, path, f.nativePhase, f.nativeArrows * 0.5, COL.ao, g.rV * 0.26);
  }
}

function drawPump(c: CanvasRenderingContext2D, g: ImpellaGeom, f: ImpellaFrame) {
  const cw = g.rV * 0.36; // cannula half-width
  const x = g.xc;
  c.save();
  // cannula body: inlet (bottom) to outlet (top)
  c.fillStyle = '#233845';
  c.strokeStyle = COL.impella;
  c.lineWidth = 3;
  c.beginPath();
  c.rect(x - cw, g.yOut, 2 * cw, g.yIn - g.yOut);
  c.fill();
  c.stroke();
  // pigtail below the inlet
  c.beginPath();
  c.moveTo(x, g.yIn);
  c.lineTo(x, g.yIn + g.H * 0.08);
  c.arc(x + g.H * 0.03, g.yIn + g.H * 0.08, g.H * 0.03, Math.PI, Math.PI * 2.7);
  c.stroke();
  // inlet window and outlet window
  c.fillStyle = COL.lumen;
  c.fillRect(x - cw - 2, g.yIn - g.H * 0.05, 2 * cw + 4, g.H * 0.035);
  c.fillRect(x - cw - 2, g.yOut + g.H * 0.012, 2 * cw + 4, g.H * 0.035);
  // motor housing above the outlet, with the rotor between outlet and motor
  c.fillStyle = '#2e4756';
  c.fillRect(x - cw * 1.05, g.yOut - g.H * 0.09, 2 * cw * 1.05, g.H * 0.09);
  c.strokeRect(x - cw * 1.05, g.yOut - g.H * 0.09, 2 * cw * 1.05, g.H * 0.09);
  c.restore();

  // blood: into the inlet from the chamber, up the cannula, out into the aorta.
  // One path, one integral: the same pumped volume moves every arrow on it.
  const yInW = g.yIn - g.H * 0.033;
  const yOutW = g.yOut + g.H * 0.03;
  const through: Pt[] = [
    { x, y: yInW },
    { x, y: yOutW },
  ];
  arrowsAlong(c, through, f.pumpPhase, f.pumpArrows * 0.9, COL.impella, cw * 0.8);
  for (const side of [-1, 1]) {
    const inflow: Pt[] = [
      { x: x + side * g.rV * 2.3, y: yInW + g.H * 0.09 },
      { x: x + side * (cw + 6), y: yInW },
    ];
    arrowsAlong(c, inflow, f.pumpPhase, f.pumpArrows * 0.5, COL.impella, g.rV * 0.26);
    const outflow: Pt[] = [
      { x: x + side * (cw + 6), y: yOutW },
      { x: x + side * g.aoR0 * 0.62, y: yOutW - g.H * 0.05 },
      { x: x + side * g.aoR0 * 0.62, y: 0 },
    ];
    arrowsAlong(c, outflow, f.pumpPhase, f.pumpArrows * 0.5, COL.impella, g.rV * 0.26);
  }
}

function drawChamberLabels(c: CanvasRenderingContext2D, g: ImpellaGeom, f: ImpellaFrame) {
  label(c, 'ascending aorta', g.xc + g.aoR0 * 1.6, g.H * 0.05, COL.faint, 16);
  label(c, 'outlet', g.xc + g.rV * 0.75, g.yOut + g.H * 0.03, COL.impella, 16);
  label(c, 'aortic valve', g.xc + g.rV * 1.25, g.yV + 14, COL.ao, 16);
  label(c, 'inlet', g.xc + g.rV * 0.75, g.yIn - g.H * 0.035, COL.impella, 16);
  label(c, 'mitral inflow', g.xc - g.rV * 3.4, g.yV - g.H * 0.05, '#ffd43b', 15, 'center');
  const apexY = g.yV + g.D * f.wall;
  if (apexY < g.H - 24) label(c, 'apex', g.xc, apexY + 18, COL.lv, 16, 'center');
  if (f.ghost !== null && Math.abs(f.ghost - f.wall) > 0.004) {
    label(c, '- - -  wall at end-diastole before the last change', g.W * 0.015, g.H * 0.975, COL.text, 15, 'left');
  }
  label(c, 'LV CAVITY', g.xc - g.A * f.wall * 0.55, g.yV + g.D * f.wall * 0.42, COL.lv, 20, 'center', 700);
}

/* ---------------- the aortic valve, looking up at it from inside the LV ---------------- */

/** Cannula cross-section radius, as a fraction of the annulus radius. */
export const CANNULA_R = 0.15;

/**
 * Orifice vertex radius (fraction of annulus) for a valve opening 0..1. Zero when
 * shut; otherwise it starts at the cannula edge and grows as sqrt(opening), so the
 * partial opening at P5 (0.44) is drawn clear of the cannula rather than hidden
 * behind it. Schematic magnitude, exaggerated for legibility; the opening TIME is
 * exact (E18 matches it to the AV-open tile). Monotonic, zero at zero (E18).
 */
export function orificeRadius(valveOpen: number): number {
  if (valveOpen <= 0) return 0;
  return CANNULA_R + (0.95 - CANNULA_R) * Math.sqrt(Math.min(valveOpen, 1));
}

function drawValveFromBelow(c: CanvasRenderingContext2D, W: number, H: number, f: ImpellaFrame) {
  const cx = W * 0.8;
  const cy = H * 0.3;
  const R = Math.min(H * 0.2, W * 0.1);
  label(c, 'AORTIC VALVE — looking up from inside the LV', cx, cy - R - 34, COL.text, 17, 'center', 700);

  c.save();
  // annulus
  c.beginPath();
  c.arc(cx, cy, R, 0, Math.PI * 2);
  c.fillStyle = '#2a1318';
  c.fill();
  c.strokeStyle = COL.wallHi;
  c.lineWidth = 6;
  c.stroke();

  // the orifice: a triangle that grows outward from the cannula as the cusps swing apart
  const o = f.valveOpen;
  const ro = orificeRadius(o);
  if (ro > 0) {
    c.beginPath();
    for (let i = 0; i <= 3; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
      const px = cx + Math.cos(a) * R * ro;
      const py = cy + Math.sin(a) * R * ro;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fillStyle = 'rgba(255,77,90,0.85)';
    c.fill();
    c.strokeStyle = '#ffd0d4';
    c.lineWidth = 3;
    c.stroke();
  }
  // coaptation lines: the three cusp edges, shortened by the opening
  c.strokeStyle = COL.ao;
  c.lineWidth = 4;
  c.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / 3;
    c.beginPath();
    // coaptation lines point at the orifice's edge midpoints, half the vertex radius
    c.moveTo(cx + Math.cos(a) * R * 0.5 * ro, cy + Math.sin(a) * R * 0.5 * ro);
    c.lineTo(cx + Math.cos(a) * R * 0.98, cy + Math.sin(a) * R * 0.98);
    c.stroke();
  }
  // the cannula passes through the centre of the valve
  c.beginPath();
  c.arc(cx, cy, R * CANNULA_R, 0, Math.PI * 2);
  c.fillStyle = '#233845';
  c.fill();
  c.strokeStyle = COL.impella;
  c.lineWidth = 3;
  c.stroke();
  c.restore();

  label(c, 'Impella cannula', cx + R * 0.1, cy + R * 0.78, COL.impella, 14);
  label(c, o > 0 ? 'OPEN — the LV is ejecting past the pump' : 'SHUT — the pump is carrying the output', cx, cy + R + 32, o > 0 ? COL.ao : COL.dim, 17, 'center', 700);
}

/* ------------------------------------------------------------------ timing strip */

function drawSweep(c: CanvasRenderingContext2D, W: number, H: number, inp: ImpellaDrawInput) {
  const x0 = W * 0.69;
  const x1 = W * 0.985;
  const top = H * 0.66;
  const bot = H * 0.955;
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
    ['pump flow', COL.impella],
    ['LV volume', COL.lv],
  ];
  rows.forEach(([name, col], k) => label(c, name, x0 - 10, top + rowH * (k + 0.5), col, 15, 'right'));

  for (const [a, b, cur] of runs(pts, (p) => d.pLv[p.i] > d.pAo[p.i])) {
    c.fillStyle = COL.ao;
    c.globalAlpha = cur ? 0.9 : 0.3;
    c.fillRect(X(a), top + rowH * 0.22, Math.max(X(b) - X(a), 2), rowH * 0.56);
  }
  c.globalAlpha = 1;

  const curve = (row: number, val: (i: number) => number, col: string) => {
    const base = top + rowH * (row + 0.9);
    const h = rowH * 0.8;
    for (const cur of [false, true]) {
      const seg = pts.filter((p) => p.current === cur);
      if (seg.length < 2) continue;
      c.beginPath();
      c.moveTo(X(seg[0].phase), base);
      for (const p of seg) c.lineTo(X(p.phase), base - h * clamp01(val(p.i)));
      c.lineTo(X(seg[seg.length - 1].phase), base);
      c.closePath();
      c.fillStyle = col;
      c.globalAlpha = cur ? 0.55 : 0.18;
      c.fill();
    }
    c.globalAlpha = 1;
  };
  curve(1, (i) => d.qImpella[i] / 100, COL.impella);
  curve(2, (i) => (d.vLv[i] - 90) / (V_FULL - 90), COL.lv);

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
  c.fillText('ONE CARDIAC CYCLE · live sweep', x0, bot + 16);
  c.restore();
}
