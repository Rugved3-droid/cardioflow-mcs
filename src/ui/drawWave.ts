/**
 * Monitor-style sweep of pressures (top) and device signals (bottom strip).
 * Both panes use the shared engine tick, so their write heads are always aligned.
 */

import { SWEEP_MS, TRACE_DECIM, TRACE_SLOTS, type TraceBuffer, type TraceChannel } from '../runtime/buffers';
import { CSSVAR, MONO } from './canvas';

const P_MAX = 130;
const ERASE_MS = 90;

function strokeChannel(
  ctx: CanvasRenderingContext2D,
  tb: TraceBuffer,
  ch: TraceChannel,
  tick: number,
  w: number,
  y0: number,
  y1: number,
  vMax: number,
  scale = 1,
) {
  const d = tb.data[ch];
  const minValid = tick - SWEEP_MS + ERASE_MS;
  let pen = false;
  ctx.beginPath();
  for (let i = 0; i < TRACE_SLOTS; i++) {
    const st = tb.stamp[i];
    if (st < 0 || st < minValid || st > tick) {
      pen = false;
      continue;
    }
    const x = (i / TRACE_SLOTS) * w;
    const v = Math.min(Math.max(d[i] * scale, 0), vMax);
    const y = y1 - (v / vMax) * (y1 - y0);
    if (!pen) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    pen = true;
  }
  ctx.stroke();
}

function anyNonZero(tb: TraceBuffer, ch: TraceChannel): boolean {
  const d = tb.data[ch];
  for (let i = 0; i < TRACE_SLOTS; i += 8) if (tb.stamp[i] >= 0 && Math.abs(d[i]) > 0.5) return true;
  return false;
}

export function drawWave(ctx: CanvasRenderingContext2D, w: number, h: number, tb: TraceBuffer, tick: number) {
  ctx.clearRect(0, 0, w, h);
  const strip = Math.round(h * 0.22);
  const pTop = 8;
  const pBot = h - strip - 6;
  const grid = CSSVAR('--grid');
  const faint = CSSVAR('--faint');

  // pressure grid
  ctx.lineWidth = 1;
  ctx.font = MONO;
  ctx.textBaseline = 'middle';
  for (let p = 0; p <= 120; p += 20) {
    const y = pBot - (p / P_MAX) * (pBot - pTop);
    ctx.strokeStyle = grid;
    ctx.beginPath();
    ctx.moveTo(26, Math.round(y) + 0.5);
    ctx.lineTo(w, Math.round(y) + 0.5);
    ctx.stroke();
    if (p % 40 === 0) {
      ctx.fillStyle = faint;
      ctx.fillText(String(p), 2, y);
    }
  }
  // device strip separator
  ctx.strokeStyle = grid;
  ctx.beginPath();
  ctx.moveTo(0, h - strip + 0.5);
  ctx.lineTo(w, h - strip + 0.5);
  ctx.stroke();

  ctx.lineJoin = 'round';
  ctx.save();
  ctx.beginPath();
  ctx.rect(26, 0, w - 26, h);
  ctx.clip();
  const x0 = 26;
  ctx.translate(x0, 0);
  const ww = w - x0;

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = CSSVAR('--la');
  ctx.globalAlpha = 0.8;
  strokeChannel(ctx, tb, 'pPv', tick, ww, pTop, pBot, P_MAX);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = CSSVAR('--lv');
  strokeChannel(ctx, tb, 'pLv', tick, ww, pTop, pBot, P_MAX);
  ctx.strokeStyle = CSSVAR('--ao');
  strokeChannel(ctx, tb, 'pAo', tick, ww, pTop, pBot, P_MAX);

  // device strip: flows in L/min (0-6), balloon volume (0-40 mL)
  const s0 = h - strip + 4;
  const s1 = h - 3;
  ctx.lineWidth = 1.8;
  if (anyNonZero(tb, 'qImpella')) {
    ctx.strokeStyle = CSSVAR('--impella');
    strokeChannel(ctx, tb, 'qImpella', tick, ww, s0, s1, 7, 0.06);
  }
  if (anyNonZero(tb, 'qEcmo')) {
    ctx.strokeStyle = CSSVAR('--ecmo');
    strokeChannel(ctx, tb, 'qEcmo', tick, ww, s0, s1, 7, 0.06);
  }
  if (anyNonZero(tb, 'vBalloon')) {
    ctx.strokeStyle = CSSVAR('--balloon');
    strokeChannel(ctx, tb, 'vBalloon', tick, ww, s0, s1, 45);
  }

  // write head
  const head = (((tick % SWEEP_MS) / TRACE_DECIM) / TRACE_SLOTS) * ww;
  ctx.fillStyle = CSSVAR('--panel');
  ctx.fillRect(head + 1, 0, (ERASE_MS / SWEEP_MS) * ww, h);
  ctx.restore();

  // legend
  ctx.font = MONO;
  ctx.textBaseline = 'top';
  const items: [string, string][] = [['AO', '--ao'], ['LV', '--lv'], ['LA', '--la']];
  let lx = w - 8;
  for (let i = items.length - 1; i >= 0; i--) {
    const [t, c] = items[i];
    const tw = ctx.measureText(t).width;
    lx -= tw;
    ctx.fillStyle = CSSVAR(c);
    ctx.fillText(t, lx, 4);
    lx -= 12;
  }
  const dev: [string, string, TraceChannel][] = [['IMPELLA L/min', '--impella', 'qImpella'], ['ECMO L/min', '--ecmo', 'qEcmo'], ['BALLOON', '--balloon', 'vBalloon']];
  let dx = x0 + 4;
  for (const [t, c, ch] of dev) {
    if (!anyNonZero(tb, ch)) continue;
    ctx.fillStyle = CSSVAR(c);
    ctx.fillText(t, dx, h - strip + 4);
    dx += ctx.measureText(t).width + 14;
  }
}
