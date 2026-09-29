/**
 * Shared pieces for the endovascular interior views.
 *
 * Same rule as the anatomy layer: every moving thing is a function of simulator
 * state. Arrow positions come from integrated transported volume (or, for the
 * coronaries, the integrated diastolic gradient), sizes from instantaneous fields.
 * Nothing here owns a clock, and nothing here writes to a Sim.
 */

import type { PatientParams, Sample } from '../model/types';
import { DIASTOLE_ACTIVATION } from '../model/constants';
import { activation } from '../model/ventricle';
import { TRACE_DECIM, type TraceBuffer } from '../runtime/buffers';
import { pointAt } from '../anatomy/layout';

export type Pt = { x: number; y: number };

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Slow motion, for filming a mistimed beat. Like time compression it changes only how
 * many 1 ms ticks run per rendered frame, never what a tick computes, so the state
 * after K ticks is bit-identical at any rate (E14 across rates; E18 at this one).
 * At 1/8 the 20 ms balloon/open-valve overlap of early inflation or late deflation
 * lasts 160 ms of wall time, about ten frames at 60 fps.
 */
export const SLOW_RATE = 0.125;

/** Fixed palette, matching the CSS tokens in styles.css (read, not redefined, there). */
export const COL = {
  bg: '#06080b',
  text: '#e8eef4',
  dim: '#8a97a5',
  faint: '#4f5d6b',
  ao: '#ff4d5a',
  lv: '#19e39b',
  impella: '#4dd4ff',
  balloon: '#f783ac',
  coronary: '#ffb04a',
  bad: '#fa5252',
  lumen: '#1a0c10',
  wall: '#4a1f28',
  wallHi: '#7a2f3b',
  myo: '#3b1a22',
};

export const FONT = (px: number, weight = 600) => `${weight} ${px}px Inter, 'Segoe UI', system-ui, sans-serif`;
export const MONOF = (px: number, weight = 600) => `${weight} ${px}px 'JetBrains Mono', 'Cascadia Mono', Consolas, monospace`;

/**
 * The instantaneous diastolic coronary driving gradient, mmHg.
 *
 * This is the DPTI integrand exactly as the model computes it (sim.ts, I_DPTI):
 * aortic-minus-LV pressure, positive part, only while LV activation is below the
 * diastole threshold. It is not a second formula: validation E18 integrates it over
 * a beat and requires it to reproduce the BeatMetrics.dpti the tiles report.
 */
export function coronaryGradient(s: Pick<Sample, 'activation' | 'pAo' | 'pLv'>): number {
  return s.activation < DIASTOLE_ACTIVATION && s.pAo > s.pLv ? s.pAo - s.pLv : 0;
}

/** Number of coronary inflow arrows for a gradient. Monotonic, zero at zero (E18). */
export const CORONARY_MMHG_PER_ARROW = 11;
export const CORONARY_MAX_ARROWS = 6;
export function coronaryArrowCount(gradMmHg: number): number {
  if (gradMmHg <= 0.5) return 0;
  return Math.min(gradMmHg / CORONARY_MMHG_PER_ARROW, CORONARY_MAX_ARROWS);
}

/** Generic flow-arrow count, mL/s. Monotonic, zero at zero. */
export const ML_S_PER_ARROW = 9;
export const MAX_ARROWS = 7;
export function flowArrowCount(q: number): number {
  if (q <= 0.2) return 0;
  return Math.min(q / ML_S_PER_ARROW, MAX_ARROWS);
}

/**
 * Integral of the coronary gradient over the current beat so far, mmHg*s, read out
 * of the pane's recorded trace (pAo, pLv at 4 ms) with activation re-evaluated from
 * the model's own activation function at each recorded tick. This is the running
 * DPTI of the beat in progress; arrow position along the coronary is this value
 * modulo a spacing. Pause the sim and it stops; it restarts at each beat, when the
 * gradient is zero (systole) and no coronary arrow is drawn.
 */
export function coronaryIntegralThisBeat(trace: TraceBuffer, now: Pick<Sample, 'tick' | 'tickInBeat'>, cycleMs: number, p: PatientParams): number {
  const beatStart = now.tick - now.tickInBeat;
  const pAo = trace.data.pAo;
  const pLv = trace.data.pLv;
  let sum = 0;
  for (let i = 0; i < trace.stamp.length; i++) {
    const t = trace.stamp[i];
    if (t < beatStart || t > now.tick) continue;
    const act = activation(t - beatStart, cycleMs, p.actScale);
    sum += coronaryGradient({ activation: act, pAo: pAo[i], pLv: pLv[i] }) * (TRACE_DECIM / 1000);
  }
  return sum;
}

/** Cumulative length along a polyline, px. */
export function pathLength(path: Pt[]): number {
  let L = 0;
  for (let i = 1; i < path.length; i++) L += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  return L;
}

/**
 * Arrows along a pixel-space path. Count from `count` (fractional: the last arrow
 * fades in), position from `phase` (0..1, supplied by an integral of the flow).
 */
export function arrowsAlong(
  c: CanvasRenderingContext2D,
  path: Pt[],
  phase: number,
  count: number,
  color: string,
  size: number,
  alphaMul = 1,
) {
  if (count <= 0) return;
  const whole = Math.floor(count);
  const frac = count - whole;
  const n = whole + (frac > 0 ? 1 : 0);
  const spacing = 1 / Math.max(whole || 1, 1);
  for (let i = 0; i < n; i++) {
    const u = (((phase + i * spacing) % 1) + 1) % 1;
    const { p, angle } = pointAt(path, u);
    // fade in at the start of the path and out at the end, so arrows never pop
    const edge = Math.min(u / 0.08, (1 - u) / 0.08, 1);
    c.save();
    c.globalAlpha = alphaMul * edge * (i === whole && frac > 0 ? frac : 1);
    c.translate(p.x, p.y);
    c.rotate(angle);
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

export function label(c: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, px = 17, align: CanvasTextAlign = 'left', weight = 600) {
  c.save();
  c.font = FONT(px, weight);
  c.fillStyle = color;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillText(text, x, y);
  c.restore();
}

/** One recorded trace slot, placed in the cardiac cycle. */
export interface SweepPoint {
  /** 0..1 position in the beat */
  phase: number;
  /** true = the beat in progress; false = the previous beat (drawn ahead of the cursor) */
  current: boolean;
  tickInBeat: number;
  i: number;
}

/**
 * Trace slots from the beat in progress (up to now) and the part of the previous
 * beat that lies ahead of the cursor, ordered by phase. Monitor-sweep style: the
 * strip always shows one full cycle, the live part solid and the old part dim.
 */
export function sweepPoints(trace: TraceBuffer, now: Pick<Sample, 'tick' | 'tickInBeat'>, cycleMs: number): SweepPoint[] {
  const beatStart = now.tick - now.tickInBeat;
  const out: SweepPoint[] = [];
  for (let i = 0; i < trace.stamp.length; i++) {
    const t = trace.stamp[i];
    if (t < 0 || t > now.tick) continue;
    if (t >= beatStart) out.push({ phase: (t - beatStart) / cycleMs, current: true, tickInBeat: t - beatStart, i });
    else if (t >= beatStart - cycleMs) {
      const tib = t - (beatStart - cycleMs);
      if (tib > now.tickInBeat) out.push({ phase: tib / cycleMs, current: false, tickInBeat: tib, i });
    }
  }
  out.sort((a, b) => a.phase - b.phase);
  return out;
}

/** Contiguous [phase0, phase1, current] runs where `pred` holds. */
export function runs(points: SweepPoint[], pred: (p: SweepPoint) => boolean): [number, number, boolean][] {
  const r: [number, number, boolean][] = [];
  let start: SweepPoint | null = null;
  let last: SweepPoint | null = null;
  for (const p of points) {
    const on = pred(p);
    if (on && (!start || p.current !== start.current)) {
      if (start && last) r.push([start.phase, last.phase, start.current]);
      start = p;
    } else if (!on && start && last) {
      r.push([start.phase, last.phase, start.current]);
      start = null;
    }
    last = p;
  }
  if (start && last) r.push([start.phase, last.phase, start.current]);
  return r;
}
