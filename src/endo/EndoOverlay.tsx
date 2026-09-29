import { useEffect, useRef, useState } from 'react';
import type { TwinEngine } from '../runtime/TwinEngine';
import type { RegisterDraw } from '../ui/useFrameLoop';
import { fitCanvas } from '../ui/canvas';
import { describeSettings } from '../ui/labels';
import { IABP_TIMINGS, type IabpTimingName } from '../model/devices/iabp';
import type { SimState } from '../model/types';
import { drawIabp, timingName } from './iabpInterior';
import { drawImpella } from './impellaInterior';
import { SLOW_RATE } from './common';
import './endo.css';

export type EndoKind = 'iabp' | 'impella' | 'none';

/**
 * Which interior view the pane's current device calls for. Reads state only.
 * With both an Impella and a balloon running (no shipped state does this), the
 * Impella wins; ECMO has no interior view.
 */
export function endoKind(st: SimState): EndoKind {
  if (st.settings.impellaLevel > 0 || st.act.impellaLevel > 0) return 'impella';
  if (st.settings.iabpOn || st.act.iabpFill > 0) return 'iabp';
  return 'none';
}

const TITLE: Record<EndoKind, string> = {
  iabp: 'INSIDE THE AORTA — IABP',
  impella: 'INSIDE THE LEFT VENTRICLE — IMPELLA',
  none: 'INTERIOR VIEW',
};

/**
 * Endovascular interior view, full screen, over pane B (the pane solo shows).
 *
 * Opened with I from Explore; never part of a default view. Draws from the live
 * pane every frame through the app's single frame loop, so it runs, pauses and
 * time-compresses with everything else. S toggles slow motion while it is open;
 * a therapy change still compresses time until it settles, and slow motion resumes
 * after that. Closing the view always returns the engine to real time.
 */
export function EndoOverlay({
  engine,
  register,
  version: _v,
  onClose,
}: {
  engine: TwinEngine;
  register: RegisterDraw;
  version: number;
  onClose: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [slow, setSlow] = useState(false);
  const slowRef = useRef(false);
  slowRef.current = slow;

  useEffect(
    () =>
      register(() => {
        // hold slow motion, but never override compression while an intervention settles
        if (slowRef.current && engine.speed <= 1 && engine.speed !== SLOW_RATE) engine.speed = SLOW_RATE;
        if (!ref.current) return;
        const [w, h, ctx] = fitCanvas(ref.current);
        const pane = engine.right;
        const sim = pane.sim;
        const kind = endoKind(sim.state);
        if (kind === 'iabp') {
          drawIabp(ctx, w, h, { s: sim.last, st: sim.state, last: sim.lastBeat, trace: pane.trace, cycleMs: sim.cycleMs, p: sim.p });
        } else if (kind === 'impella') {
          drawImpella(ctx, w, h, { s: sim.last, st: sim.state, last: sim.lastBeat, trace: pane.trace, pv: pane.pv, cycleMs: sim.cycleMs, p: sim.p });
        } else ctx.clearRect(0, 0, w, h);
      }),
    [engine, register],
  );

  const toggleSlow = () => {
    setSlow((v) => {
      if (v && engine.speed === SLOW_RATE) engine.speed = 1;
      return !v;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 's' || e.key === 'S') toggleSlow();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // leaving the view always returns to real time
  useEffect(
    () => () => {
      if (engine.speed === SLOW_RATE) engine.speed = 1;
    },
    [engine],
  );

  const st = engine.right.sim.state;
  const kind = endoKind(st);
  const s = st.settings;
  const tn = timingName(st);
  const setTiming = (k: IabpTimingName) => {
    const t = IABP_TIMINGS[k];
    const next = { iabpInflateOffsetMs: t.inflate, iabpDeflateOffsetMs: t.deflate };
    engine.applyRight(next, describeSettings({ ...s, ...next }));
  };

  return (
    <div className="endo-overlay" onClick={onClose} role="dialog" aria-label="Endovascular interior view">
      <div className="endo-inner" onClick={(e) => e.stopPropagation()}>
        <div className="endo-head">
          <span className="endo-title">{TITLE[kind]}</span>
          <span className="endo-sub">{engine.right.label} · every dimension driven by the live model state</span>
          <span className="endo-spacer" />
          {kind === 'iabp' && (
            <label className="endo-ctl">
              Timing
              <select value={tn ?? 'correct'} onChange={(e) => setTiming(e.target.value as IabpTimingName)}>
                {(Object.keys(IABP_TIMINGS) as IabpTimingName[]).map((k) => (
                  <option key={k} value={k}>{IABP_TIMINGS[k].label}</option>
                ))}
              </select>
            </label>
          )}
          <button className={slow ? 'endo-slow on' : 'endo-slow'} onClick={toggleSlow} title="Fewer 1 ms ticks per frame. The tick, the physiology and every time constant are unchanged.">
            {slow ? (engine.compressing ? 'SLOW MOTION · resumes when settled' : '⅛× SLOW MOTION · physiology unchanged') : 'S · slow motion ⅛×'}
          </button>
          <span className="endo-key">I / Esc to close</span>
        </div>
        <div className="endo-canvas">
          <canvas ref={ref} aria-label="Interior schematic" />
          {kind === 'none' && (
            <div className="endo-empty">
              No IABP or Impella on pane B. Select S1 (IABP) to see the balloon from inside the aorta, or
              S2, S4 or S5 (Impella) to see the pump from inside the left ventricle.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
