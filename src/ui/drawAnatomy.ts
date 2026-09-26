/**
 * Device / anatomy co-registration.
 *
 * Every dimension and every moving thing here is a function of the simulator's
 * current state. There is no animation timeline: arrow positions come from the
 * cumulative transported volume the model integrates (`state.cum`), chamber size
 * comes from instantaneous cavity volume, valve leaflets come from instantaneous
 * valve flow, and balloon size comes from instantaneous balloon volume. Stop the
 * simulation and the picture stops with it.
 */

import type { Sample, SimState } from '../model/types';
import { GEO, PATHS, pointAt, type AnatomyPart } from '../anatomy/layout';
import { CSSVAR } from './canvas';

/**
 * Which simulator field drives each animated quantity. Exported so the validation
 * harness can assert the anatomy reads the model and nothing else.
 */
export const ANATOMY_READS = {
  lvChamberSize: 'vLv',
  aorticValveLeaflets: 'qAortic',
  balloonSize: 'vBalloon',
  impellaArrows: 'qImpella',
  ecmoArrows: 'qEcmo',
  mitralArrows: 'qMitral',
  systemicArrows: 'qSvr',
} as const;

/** Arrow count for a given flow. Exported so its monotonicity can be asserted. */
export function arrowCountFor(flowMlS: number): number {
  if (flowMlS <= 0.2) return 0;
  return Math.min(flowMlS / 9, MAX_ARROWS);
}

/** mL of transported volume per arrow. Lower = denser arrows for a given flow. */
const ML_PER_ARROW = 26;
/** flow (mL/s) that saturates arrow count on a path */
const MAX_ARROWS = 7;

export interface AnatomyInput {
  s: Sample;
  st: SimState;
  /** LV volume bounds used to scale the chamber, mL */
  vMin: number;
  vMax: number;
  highlight: AnatomyPart | null;
  /**
   * Twin summons the highlight briefly, so dimming everything else is the right
   * emphasis. Solo shows the chain permanently, so dimming would leave most of the
   * drawing muted all the time; there the highlight is additive (a ring only).
   * Defaults to the twin behaviour, so no existing call site changes.
   */
  dimOthers?: boolean;
}

interface Ctx2 {
  c: CanvasRenderingContext2D;
  W: number;
  H: number;
  X: (u: number) => number;
  Y: (v: number) => number;
  S: (u: number) => number;
  big: boolean;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function strokePath(g: Ctx2, path: { x: number; y: number }[], width: number, color: string, alpha = 1) {
  const { c } = g;
  c.save();
  c.globalAlpha = alpha;
  c.strokeStyle = color;
  c.lineWidth = g.S(width);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(g.X(path[0].x), g.Y(path[0].y));
  for (let i = 1; i < path.length; i++) c.lineTo(g.X(path[i].x), g.Y(path[i].y));
  c.stroke();
  c.restore();
}

/**
 * Arrows along a path. Count scales with flow (density) and position comes from
 * cumulative transported volume (speed). `reverse` walks the path backwards, which
 * is how retrograde ECMO return is drawn.
 */
function flowArrows(
  g: Ctx2,
  path: { x: number; y: number }[],
  cumMl: number,
  flowMlS: number,
  color: string,
  reverse = false,
  sizeMul = 1,
  /** perpendicular offset in normalised units; lets two opposing streams share a vessel */
  offset = 0,
) {
  if (flowMlS <= 0.2) return;
  const exact = Math.min(flowMlS / 9, MAX_ARROWS);
  const whole = Math.floor(exact);
  const frac = exact - whole;
  const n = whole + (frac > 0 ? 1 : 0);
  if (n <= 0) return;
  const phase = (cumMl / ML_PER_ARROW) % 1;
  const { c } = g;
  const size = g.S(0.018) * sizeMul;
  for (let i = 0; i < n; i++) {
    let u = (phase + i / Math.max(whole || 1, 1)) % 1;
    if (reverse) u = 1 - u;
    const { p, angle } = pointAt(path, u);
    const a = angle + (reverse ? Math.PI : 0);
    const px = p.x + Math.cos(angle + Math.PI / 2) * offset;
    const py = p.y + Math.sin(angle + Math.PI / 2) * offset;
    const alpha = i === whole && frac > 0 ? frac : 1;
    c.save();
    c.globalAlpha = alpha;
    c.translate(g.X(px), g.Y(py));
    c.rotate(a);
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(size, 0);
    c.lineTo(-size * 0.62, size * 0.62);
    c.lineTo(-size * 0.28, 0);
    c.lineTo(-size * 0.62, -size * 0.62);
    c.closePath();
    c.fill();
    c.restore();
  }
}

function label(g: Ctx2, text: string, x: number, y: number, color: string, align: CanvasTextAlign = 'center') {
  const { c } = g;
  // floor the label size: the band can get short on a laptop and unreadable labels
  // are worse than no labels
  const px = Math.max(9, Math.round(g.S(g.big ? 0.026 : 0.038)));
  c.font = `600 ${px}px 'JetBrains Mono', Consolas, monospace`;
  c.fillStyle = color;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillText(text, g.X(x), g.Y(y));
}

export function drawAnatomy(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  input: AnatomyInput,
  big: boolean,
) {
  ctx.clearRect(0, 0, W, H);
  // keep the schematic square-ish and centred, so proportions never distort
  const side = Math.min(W, H);
  const ox = (W - side) / 2;
  const oy = (H - side) / 2;
  const g: Ctx2 = {
    c: ctx,
    W,
    H,
    X: (u) => ox + u * side,
    Y: (v) => oy + v * side,
    S: (u) => u * side,
    big,
  };
  const { s, st, highlight } = input;

  const COL = {
    wall: CSSVAR('--faint'),
    blood: CSSVAR('--lv'),
    ao: CSSVAR('--ao'),
    la: CSSVAR('--la'),
    imp: CSSVAR('--impella'),
    ecmo: CSSVAR('--ecmo'),
    balloon: CSSVAR('--balloon'),
    dim: CSSVAR('--dim'),
    focus: CSSVAR('--focus'),
    panel: CSSVAR('--panel'),
  };
  const hi = (p: AnatomyPart) => highlight === p;
  const dimOthers = input.dimOthers ?? true;
  const emphasise = (p: AnatomyPart) => {
    if (!highlight || !dimOthers) return 1;
    return hi(p) ? 1 : 0.28;
  };

  const ring = (cx: number, cy: number, rx: number, ry: number) => {
    ctx.save();
    ctx.strokeStyle = COL.focus;
    ctx.lineWidth = g.S(0.009);
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.ellipse(g.X(cx), g.Y(cy), g.S(rx), g.S(ry), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  const vFracPre = clamp01((s.vLv - input.vMin) / Math.max(input.vMax - input.vMin, 1));
  const lvRyPre = lerp(GEO.lv.ryMin, GEO.lv.ryMax, vFracPre);

  /* ---------------- vessels (drawn first, as background) ---------------- */
  ctx.globalAlpha = emphasise('aortaAsc');
  strokePath(g, PATHS.aorta, 0.052, COL.panel);
  strokePath(g, PATHS.aorta, 0.044, COL.ao, 0.30);
  ctx.globalAlpha = emphasise('aortaDesc');
  strokePath(g, PATHS.descending, 0.052, COL.panel);
  strokePath(g, PATHS.descending, 0.044, COL.ao, 0.30);
  ctx.globalAlpha = 1;

  /* pulmonary return, present only to close the loop */
  ctx.globalAlpha = emphasise('la') * 0.75;
  strokePath(g, PATHS.pulmonary, 0.030, COL.la, 0.35);
  ctx.globalAlpha = 1;

  /* ---------------- venous reservoir ---------------- */
  {
    const v = GEO.venous;
    ctx.save();
    ctx.globalAlpha = emphasise('venous');
    ctx.fillStyle = COL.panel;
    ctx.strokeStyle = COL.dim;
    ctx.lineWidth = g.S(0.006);
    ctx.beginPath();
    ctx.roundRect(g.X(v.x - v.w / 2), g.Y(v.y), g.S(v.w), g.S(v.h), g.S(0.02));
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    label(g, 'VENOUS', v.x, v.y - 0.042, COL.dim);
  }

  /* ---------------- LV outflow tract and the LA->LV neck ---------------- */
  {
    const o = GEO.lvot;
    ctx.save();
    ctx.globalAlpha = emphasise('lv');
    ctx.strokeStyle = COL.blood;
    ctx.globalAlpha *= 0.42;
    ctx.lineWidth = g.S(o.w);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(g.X(o.from.x), g.Y(o.from.y));
    ctx.lineTo(g.X(o.to.x), g.Y(o.to.y));
    ctx.stroke();
    // LA -> LV neck
    ctx.globalAlpha = emphasise('mitral') * 0.38;
    ctx.strokeStyle = COL.la;
    ctx.lineWidth = g.S(0.044);
    ctx.beginPath();
    ctx.moveTo(g.X(GEO.la.x), g.Y(GEO.la.y + GEO.la.ry * 0.6));
    ctx.lineTo(g.X(GEO.lv.x), g.Y(GEO.lv.y - lvRyPre * 0.55));
    ctx.stroke();
    ctx.restore();
  }

  /* ---------------- left atrium ---------------- */
  {
    const a = GEO.la;
    ctx.save();
    ctx.globalAlpha = emphasise('la');
    ctx.fillStyle = COL.panel;
    ctx.strokeStyle = COL.la;
    ctx.lineWidth = g.S(0.007);
    ctx.beginPath();
    ctx.ellipse(g.X(a.x), g.Y(a.y), g.S(a.rx), g.S(a.ry), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    label(g, 'LA', a.x, a.y, COL.la);
    if (hi('la')) ring(a.x, a.y, a.rx + 0.018, a.ry + 0.018);
  }

  /* ---------------- left ventricle: size tracks cavity volume live ---------------- */
  const vFrac = vFracPre;
  const lvRx = lerp(GEO.lv.rxMin, GEO.lv.rxMax, vFrac);
  const lvRy = lvRyPre;
  {
    ctx.save();
    ctx.globalAlpha = emphasise('lv');
    ctx.fillStyle = COL.panel;
    ctx.strokeStyle = COL.blood;
    ctx.lineWidth = g.S(0.010);
    ctx.beginPath();
    ctx.ellipse(g.X(GEO.lv.x), g.Y(GEO.lv.y), g.S(lvRx), g.S(lvRy), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // cavity fill opacity tracks how full it is, so systole reads as emptying
    ctx.globalAlpha = emphasise('lv') * (0.12 + 0.30 * vFrac);
    ctx.fillStyle = COL.blood;
    ctx.fill();
    ctx.restore();
    label(g, 'LV', GEO.lv.x, GEO.lv.y + lvRy * 0.42, COL.blood);
    if (hi('lv')) ring(GEO.lv.x, GEO.lv.y, lvRx + 0.022, lvRy + 0.022);
  }

  /* ---------------- mitral inflow ---------------- */
  ctx.globalAlpha = emphasise('mitral');
  flowArrows(g, PATHS.mitral, st.cum.mitral, s.qMitral, COL.la, false, 0.8);
  ctx.globalAlpha = 1;

  /* ---------------- aortic valve leaflets ---------------- */
  {
    const a = GEO.av;
    // leaflet opening is driven by instantaneous transvalvular flow — the same
    // quantity the AV-open metric integrates
    const open = clamp01(s.qAortic / 260);
    ctx.save();
    ctx.globalAlpha = emphasise('av');
    ctx.translate(g.X(a.x), g.Y(a.y));
    ctx.rotate(a.angle);
    const halfW = g.S(a.w);
    const leafLen = g.S(0.042);
    ctx.strokeStyle = s.avOpen ? COL.blood : COL.dim;
    ctx.lineWidth = g.S(0.011);
    ctx.lineCap = 'round';
    for (const sign of [-1, 1]) {
      const spread = lerp(0.12, 1.0, open);
      ctx.beginPath();
      ctx.moveTo(0, sign * halfW);
      ctx.lineTo(leafLen * 0.85, sign * halfW * spread + sign * leafLen * 0.55 * spread);
      ctx.stroke();
    }
    ctx.restore();
    if (hi('av')) ring(a.x + 0.02, a.y - 0.012, 0.055, 0.055);
    label(g, 'AV', a.x + 0.052, a.y + 0.052, s.avOpen ? COL.blood : COL.dim);
  }

  /* ---------------- native ejection + antegrade aortic flow ---------------- */
  ctx.globalAlpha = emphasise('aortaAsc');
  flowArrows(g, PATHS.aorta, st.cum.aortic, s.qAortic, COL.ao);
  // antegrade flow runs down the LEFT side of the descending aorta so the retrograde
  // ECMO return can share the vessel on the right and still be told apart
  ctx.globalAlpha = emphasise('aortaDesc');
  flowArrows(g, PATHS.descending, st.cum.systemic, s.qSvr, COL.ao, false, 0.85, -0.011);
  ctx.globalAlpha = 1;
  label(g, 'AO', 0.660, 0.060, COL.ao);

  /* ---------------- IABP balloon ---------------- */
  if (s.vBalloon > 0.05 || st.act.iabpFill > 0.01) {
    const b = GEO.balloon;
    const f = clamp01(s.vBalloon / 40);
    ctx.save();
    ctx.globalAlpha = emphasise('balloon');
    ctx.fillStyle = COL.balloon;
    ctx.globalAlpha *= 0.30 + 0.60 * f;
    ctx.beginPath();
    ctx.ellipse(g.X(b.x), g.Y(b.y), g.S(b.maxRx * (0.25 + 0.75 * f)), g.S(b.maxRy * (0.25 + 0.75 * f)), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = emphasise('balloon');
    ctx.strokeStyle = COL.balloon;
    ctx.lineWidth = g.S(0.005);
    ctx.stroke();
    ctx.restore();
    label(g, 'IABP', b.x + 0.062, b.y, COL.balloon, 'left');
    if (hi('balloon')) ring(b.x, b.y, b.maxRx + 0.03, b.maxRy + 0.02);
  }

  /* ---------------- Impella ---------------- */
  if (st.act.impellaLevel > 0.02) {
    ctx.save();
    ctx.globalAlpha = emphasise('impella');
    strokePath(g, PATHS.impella, 0.020, COL.panel);
    strokePath(g, PATHS.impella, 0.013, COL.imp, 0.85);
    // inlet marker in the LV, outlet marker in the ascending aorta
    const inlet = PATHS.impella[0];
    const outlet = PATHS.impella[PATHS.impella.length - 1];
    ctx.fillStyle = COL.imp;
    ctx.beginPath();
    ctx.arc(g.X(inlet.x), g.Y(inlet.y), g.S(0.013), 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(g.X(outlet.x), g.Y(outlet.y), g.S(0.011), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = emphasise('impella');
    flowArrows(g, PATHS.impella, st.cum.impella, s.qImpella, COL.imp, false, 0.85);
    ctx.globalAlpha = 1;
    label(g, `IMPELLA P${Math.round(st.act.impellaLevel)}`, 0.500, 0.128, COL.imp, 'left');
    if (hi('impella')) {
      ctx.save();
      ctx.strokeStyle = COL.focus;
      ctx.lineWidth = g.S(0.006);
      strokePath(g, PATHS.impella, 0.026, COL.focus, 0.5);
      ctx.restore();
    }
  }

  /* ---------------- VA-ECMO ---------------- */
  if (st.act.ecmoFlowLpm > 0.02) {
    const p = GEO.ecmoPump;
    ctx.save();
    ctx.globalAlpha = emphasise('ecmo');
    strokePath(g, PATHS.ecmoDrain, 0.026, COL.panel);
    strokePath(g, PATHS.ecmoDrain, 0.018, COL.ecmo, 0.8);
    strokePath(g, PATHS.ecmoReturn, 0.026, COL.panel);
    strokePath(g, PATHS.ecmoReturn, 0.018, COL.ecmo, 0.8);
    ctx.fillStyle = COL.panel;
    ctx.strokeStyle = COL.ecmo;
    ctx.lineWidth = g.S(0.006);
    ctx.beginPath();
    ctx.arc(g.X(p.x), g.Y(p.y), g.S(p.r), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = emphasise('ecmo');
    flowArrows(g, PATHS.ecmoDrain, st.cum.ecmo, s.qEcmo, COL.ecmo, false, 0.8);
    flowArrows(g, PATHS.ecmoReturn, st.cum.ecmo, s.qEcmo, COL.ecmo, false, 1.25, 0.011);
    ctx.globalAlpha = 1;
    label(g, `VA-ECMO ${st.act.ecmoFlowLpm.toFixed(1)}`, 0.105, 0.955, COL.ecmo);
    // the retrograde segment is the whole reason afterload rises: say so
    ctx.save();
    ctx.globalAlpha = emphasise('ecmo');
    label(g, 'RETROGRADE ↑', 0.698, 0.775, COL.ecmo, 'right');
    ctx.restore();
    if (hi('ecmo')) {
      strokePath(g, PATHS.ecmoReturn, 0.030, COL.focus, 0.45);
      strokePath(g, PATHS.ecmoDrain, 0.030, COL.focus, 0.45);
    }
  }
}
