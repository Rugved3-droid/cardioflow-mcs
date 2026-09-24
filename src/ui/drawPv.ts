/**
 * Pressure-volume loop on fixed axes (identical in both panes, so loops compare
 * by position). The ESPVR and EDPVR of this patient are drawn as the boundaries
 * every loop must live between.
 */

import type { PvBuffer } from '../runtime/buffers';
import type { PatientParams } from '../model/types';
import { edpvr } from '../model/ventricle';
import { CSSVAR, MONO } from './canvas';

export const PV_AXES = { vMin: 0, vMax: 260, pMin: 0, pMax: 130 };

export function drawPv(ctx: CanvasRenderingContext2D, w: number, h: number, pv: PvBuffer, p: PatientParams) {
  ctx.clearRect(0, 0, w, h);
  const L = 30, R = 8, T = 8, B = 20;
  const X = (v: number) => L + ((v - PV_AXES.vMin) / (PV_AXES.vMax - PV_AXES.vMin)) * (w - L - R);
  const Y = (pp: number) => h - B - ((pp - PV_AXES.pMin) / (PV_AXES.pMax - PV_AXES.pMin)) * (h - T - B);
  const grid = CSSVAR('--grid');
  const faint = CSSVAR('--faint');

  ctx.lineWidth = 1;
  ctx.font = MONO;
  ctx.fillStyle = faint;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (let pp = 0; pp <= 120; pp += 40) {
    ctx.strokeStyle = grid;
    ctx.beginPath();
    ctx.moveTo(L, Math.round(Y(pp)) + 0.5);
    ctx.lineTo(w - R, Math.round(Y(pp)) + 0.5);
    ctx.stroke();
    ctx.fillText(String(pp), L - 4, Y(pp));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let v = 0; v <= 250; v += 50) {
    ctx.strokeStyle = grid;
    ctx.beginPath();
    ctx.moveTo(Math.round(X(v)) + 0.5, T);
    ctx.lineTo(Math.round(X(v)) + 0.5, h - B);
    ctx.stroke();
    ctx.fillText(String(v), X(v), h - B + 4);
  }
  ctx.textAlign = 'left';
  ctx.fillText('mL', w - R - 16, h - B - 14);
  ctx.textBaseline = 'top';
  ctx.fillText('mmHg', L + 4, T);

  // ESPVR and EDPVR boundaries
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = faint;
  ctx.beginPath();
  ctx.moveTo(X(p.lvV0), Y(0));
  const vTop = p.lvV0 + PV_AXES.pMax / p.lvEes;
  ctx.lineTo(X(Math.min(vTop, PV_AXES.vMax)), Y(p.lvEes * (Math.min(vTop, PV_AXES.vMax) - p.lvV0)));
  ctx.stroke();
  ctx.beginPath();
  for (let v = p.lvV0ed; v <= PV_AXES.vMax; v += 2) {
    const pp = edpvr(v, p.lvA, p.lvB, p.lvV0ed);
    if (pp > PV_AXES.pMax) break;
    if (v === p.lvV0ed) ctx.moveTo(X(v), Y(pp));
    else ctx.lineTo(X(v), Y(pp));
  }
  ctx.stroke();
  ctx.fillStyle = faint;
  ctx.fillText('ESPVR', X(p.lvV0 + 55 / p.lvEes) + 6, Y(55));
  ctx.fillText('EDPVR', X(232), Y(edpvr(232, p.lvA, p.lvB, p.lvV0ed)) - 16);

  const path = (a: Float32Array, n: number) => {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = X(a[i * 2]);
      const y = Y(Math.max(a[i * 2 + 1], PV_AXES.pMin - 5));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };

  // reference loop (the moment the realities split)
  if (pv.reference) {
    ctx.setLineDash([3, 5]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = CSSVAR('--dim');
    path(pv.reference, pv.reference.length / 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const lv = CSSVAR('--lv');
  ctx.strokeStyle = lv;
  ctx.lineJoin = 'round';
  for (let k = pv.history.length - 1; k >= 1; k--) {
    ctx.globalAlpha = 0.1 + 0.08 * (pv.history.length - k);
    ctx.lineWidth = 1.5;
    path(pv.history[k], pv.history[k].length / 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (pv.history[0]) {
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    path(pv.history[0], pv.history[0].length / 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (pv.currentLen > 1) {
    ctx.lineWidth = 2.6;
    path(pv.current, pv.currentLen);
    ctx.stroke();
    const i = pv.currentLen - 1;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(X(pv.current[i * 2]), Y(pv.current[i * 2 + 1]), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
