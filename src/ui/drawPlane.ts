/**
 * Perfusion / unloading plane renderer.
 *
 * Every point drawn is computed from a BeatMetrics the simulator produced. The
 * trail is not an animation buffer — it is the pane's own beat history mapped
 * through the same normalisation, so it cannot drift from the numbers.
 */

import type { BeatMetrics } from '../model/types';
import { AXIS_LABEL, planePoint } from '../plane/plane';
import { CSSVAR } from './canvas';

export interface PlaneSeries {
  beats: BeatMetrics[];
  color: string;
  label: string;
  /** brightest point; false for the "before" pane */
  primary: boolean;
}

export interface PlaneRef {
  id: string;
  m: BeatMetrics;
}

/** Beats of history drawn as the fading trail. 120 beats = 72 s, long enough to
 *  show a complete transition including the baroreflex settling out. */
const TRAIL = 120;

export function drawPlane(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  refs: PlaneRef[],
  series: PlaneSeries[],
  big: boolean,
) {
  ctx.clearRect(0, 0, w, h);
  const L = big ? 62 : 34;
  const R = big ? 22 : 12;
  const T = big ? 26 : 16;
  const B = big ? 52 : 34;
  const X = (v: number) => L + v * (w - L - R);
  const Y = (v: number) => h - B - v * (h - T - B);
  const grid = CSSVAR('--grid');
  const faint = CSSVAR('--faint');
  const dim = CSSVAR('--dim');
  const mono = (px: number, weight = 600) => `${weight} ${px}px 'JetBrains Mono', 'Cascadia Mono', Consolas, monospace`;

  /* grid */
  ctx.lineWidth = 1;
  ctx.strokeStyle = grid;
  for (let i = 0; i <= 4; i++) {
    const g = i / 4;
    ctx.beginPath();
    ctx.moveTo(Math.round(X(g)) + 0.5, T);
    ctx.lineTo(Math.round(X(g)) + 0.5, h - B);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(L, Math.round(Y(g)) + 0.5);
    ctx.lineTo(w - R, Math.round(Y(g)) + 0.5);
    ctx.stroke();
  }

  /* axes */
  ctx.font = mono(big ? 12 : 9);
  ctx.fillStyle = dim;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(AXIS_LABEL.x, (L + w - R) / 2, h - B + (big ? 16 : 11));
  if (big) {
    ctx.font = mono(10, 400);
    ctx.fillStyle = faint;
    ctx.fillText(AXIS_LABEL.xSub, (L + w - R) / 2, h - B + 32);
  }
  ctx.save();
  ctx.translate(big ? 16 : 10, (T + h - B) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.font = mono(big ? 12 : 9);
  ctx.fillStyle = dim;
  ctx.textBaseline = 'middle';
  ctx.fillText(AXIS_LABEL.y, 0, 0);
  if (big) {
    ctx.font = mono(10, 400);
    ctx.fillStyle = faint;
    ctx.fillText(AXIS_LABEL.ySub, 0, 16);
  }
  ctx.restore();

  /* direction hints at the corners */
  if (big) {
    ctx.font = mono(10, 400);
    ctx.fillStyle = faint;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('perfused, ventricle spared →', w - R - 4, T + 4);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('perfused, ventricle loaded', w - R - 4, h - B - 4);
  }

  /* reference states */
  ctx.textAlign = 'center';
  for (const r of refs) {
    const p = planePoint(r.m);
    const x = X(p.x);
    const y = Y(p.y);
    ctx.beginPath();
    ctx.arc(x, y, big ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = CSSVAR('--panel');
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = faint;
    ctx.stroke();
    ctx.font = mono(big ? 12 : 9);
    ctx.fillStyle = dim;
    ctx.textBaseline = 'bottom';
    ctx.fillText(r.id, x, y - (big ? 9 : 6));
  }

  /* the A->B gap IS the comparison the app exists to make: draw it explicitly */
  if (series.length === 2 && series[0].beats.length && series[1].beats.length) {
    const a = planePoint(series[0].beats[series[0].beats.length - 1]);
    const b = planePoint(series[1].beats[series[1].beats.length - 1]);
    const gap = Math.hypot(b.x - a.x, b.y - a.y);
    if (gap > 0.02) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = faint;
      ctx.beginPath();
      ctx.moveTo(X(a.x), Y(a.y));
      ctx.lineTo(X(b.x), Y(b.y));
      ctx.stroke();
      ctx.setLineDash([]);
      // arrowhead pointing at B
      const ang = Math.atan2(Y(b.y) - Y(a.y), X(b.x) - X(a.x));
      const hx = X(b.x) - Math.cos(ang) * (big ? 14 : 10);
      const hy = Y(b.y) - Math.sin(ang) * (big ? 14 : 10);
      const s1 = big ? 7 : 5;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx - Math.cos(ang - 0.45) * s1, hy - Math.sin(ang - 0.45) * s1);
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx - Math.cos(ang + 0.45) * s1, hy - Math.sin(ang + 0.45) * s1);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* live series */
  for (const s of series) {
    const pts = s.beats.slice(-TRAIL).map((m) => planePoint(m));
    if (!pts.length) continue;
    const col = CSSVAR(s.color);
    ctx.lineWidth = s.primary ? (big ? 3 : 2) : big ? 2 : 1.4;
    ctx.lineJoin = 'round';
    for (let i = 1; i < pts.length; i++) {
      const a = (i / pts.length) * (s.primary ? 0.85 : 0.4);
      ctx.globalAlpha = a;
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.moveTo(X(pts[i - 1].x), Y(pts[i - 1].y));
      ctx.lineTo(X(pts[i].x), Y(pts[i].y));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const last = pts[pts.length - 1];
    const x = X(last.x);
    const y = Y(last.y);
    ctx.beginPath();
    ctx.arc(x, y, s.primary ? (big ? 8 : 5.5) : big ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.globalAlpha = s.primary ? 1 : 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (s.primary) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = CSSVAR('--bg');
      ctx.stroke();
    }
    ctx.font = mono(big ? 13 : 10);
    ctx.fillStyle = col;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.label, x + (big ? 13 : 9), y);
  }
}
