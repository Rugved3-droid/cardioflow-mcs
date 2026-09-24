import { useEffect, useRef } from 'react';
import type { Side, TwinEngine } from '../runtime/TwinEngine';
import { fitCanvas } from './canvas';
import { drawWave } from './drawWave';
import { drawPv } from './drawPv';
import { fmt, M, val, type MetricDef } from './metrics';
import type { RegisterDraw } from './useFrameLoop';

interface Props {
  side: Side;
  engine: TwinEngine;
  register: RegisterDraw;
  /** bumps on every beat so numerics re-render */
  version: number;
}

function Num({ d, v, cls = '' }: { d: MetricDef; v: number; cls?: string }) {
  return (
    <div className={`num ${cls}`}>
      <span className="k">{d.label}</span>
      <span className="v">
        {fmt(v, d.digits)}
        <small>{d.unit}</small>
      </span>
    </div>
  );
}

export function Pane({ side, engine, register, version: _v }: Props) {
  const wave = useRef<HTMLCanvasElement>(null);
  const pv = useRef<HTMLCanvasElement>(null);

  useEffect(
    () =>
      register(() => {
        const pane = engine[side];
        if (wave.current) {
          const [w, h, ctx] = fitCanvas(wave.current);
          drawWave(ctx, w, h, pane.trace, engine.tick);
        }
        if (pv.current) {
          const [w, h, ctx] = fitCanvas(pv.current);
          drawPv(ctx, w, h, pane.pv, pane.sim.p);
        }
      }),
    [engine, register, side],
  );

  const pane = engine[side];
  const m = pane.metrics;
  const set = pane.sim.state.settings;
  const act = pane.sim.state.act;
  const flags: string[] = [];
  if (m?.impellaSuction) flags.push('SUCTION');
  if (m?.ecmoDrainageLimited) flags.push('DRAINAGE LIMIT');
  if (m && m.avOpenFraction < 0.005) flags.push('AV CLOSED');

  return (
    <section className="pane" aria-label={`${side} pane`}>
      <div className="pane-head">
        <span className="pane-side">{side === 'left' ? 'A · BEFORE' : 'B · AFTER'}</span>
        <span className="pane-title">{pane.label}</span>
        <span className="chips">
          {(set.iabpOn || act.iabpFill > 0) && (
            <span className="chip" style={{ color: 'var(--balloon)' }}>
              IABP {set.iabpRatio === 2 ? '1:2' : '1:1'}
            </span>
          )}
          {act.impellaLevel > 0.05 && (
            <span className="chip" style={{ color: 'var(--impella)' }}>
              IMPELLA P{fmt(act.impellaLevel, act.impellaLevel % 1 ? 1 : 0)}
            </span>
          )}
          {act.ecmoFlowLpm > 0.05 && (
            <span className="chip" style={{ color: 'var(--ecmo)' }}>
              ECMO {fmt(act.ecmoFlowLpm, 1)}
            </span>
          )}
          {flags.map((f) => (
            <span key={f} className={f === 'AV CLOSED' ? 'chip' : 'chip flag'} style={f === 'AV CLOSED' ? { color: 'var(--rise)' } : undefined}>
              {f}
            </span>
          ))}
        </span>
      </div>
      <div className="canvas-wrap">
        <canvas ref={wave} aria-label="Pressure waveforms" />
      </div>
      <div className="pane-bottom">
        <div className="canvas-wrap">
          <canvas ref={pv} aria-label="LV pressure-volume loop" />
        </div>
        <div className="nums">
          <Num d={M.map} v={val(m, M.map)} cls="big ao" />
          <Num d={M.lvedp} v={val(m, M.lvedp)} cls="big lv" />
          <div className="num">
            <span className="k">SBP / DBP</span>
            <span className="v">
              {fmt(val(m, M.sbp), 0)}/{fmt(val(m, M.dbp), 0)}
              <small>mmHg</small>
            </span>
          </div>
          <Num d={M.lvedv} v={val(m, M.lvedv)} />
          <Num d={M.nativeSv} v={val(m, M.nativeSv)} />
          <Num d={M.total} v={val(m, M.total)} />
          <Num d={M.av} v={val(m, M.av)} />
          <Num d={M.pva} v={val(m, M.pva)} />
          <Num d={M.dpti} v={val(m, M.dpti)} />
          <Num d={M.svr} v={val(m, M.svr)} />
        </div>
      </div>
    </section>
  );
}
