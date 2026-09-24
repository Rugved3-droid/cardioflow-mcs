import { useEffect, useRef } from 'react';
import type { Side, TwinEngine } from '../runtime/TwinEngine';
import { fitCanvas } from './canvas';
import { drawWave } from './drawWave';
import { drawPv } from './drawPv';
import { fmt, M, val, type MetricDef } from './metrics';
import type { CausalNode } from '../causal/graph';
import type { RegisterDraw } from './useFrameLoop';

interface Props {
  side: Side;
  engine: TwinEngine;
  register: RegisterDraw;
  /** bumps on every beat so numerics re-render */
  version: number;
  /** node currently emphasised by the causal highlight, if any */
  activeNode: CausalNode | null;
  /** every node in the active chain, so all of them stay marked */
  chainIds: Set<string>;
  onWhy?: (target: string) => void;
}

function Num({
  d, v, cls = '', node, active, inChain, onWhy,
}: {
  d: MetricDef; v: number; cls?: string; node?: string; active?: boolean; inChain?: boolean; onWhy?: (t: string) => void;
}) {
  return (
    <div className={`num ${cls}${active ? ' lit' : ''}${inChain && !active ? ' chained' : ''}`}>
      <span className="k">
        {d.label}
        {node && onWhy && (
          <button className="why" onClick={() => onWhy(node)} title={`Why did ${d.label} change?`} aria-label={`Why did ${d.label} change?`}>
            WHY?
          </button>
        )}
      </span>
      <span className="v">
        {fmt(v, d.digits)}
        <small>{d.unit}</small>
      </span>
    </div>
  );
}

export function Pane({ side, engine, register, version: _v, activeNode, chainIds, onWhy }: Props) {
  const wave = useRef<HTMLCanvasElement>(null);
  const pv = useRef<HTMLCanvasElement>(null);

  useEffect(
    () =>
      register(() => {
        const pane = engine[side];
        if (wave.current) {
          const [w, h, ctx] = fitCanvas(wave.current);
          drawWave(ctx, w, h, pane.trace, engine.tick, activeNode?.traces ?? null);
        }
        if (pv.current) {
          const [w, h, ctx] = fitCanvas(pv.current);
          drawPv(ctx, w, h, pane.pv, pane.sim.p, activeNode?.pv ?? null);
        }
      }),
    [engine, register, side, activeNode],
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
            <span className={`chip${activeNode?.id === 'balloon' ? ' lit' : ''}`} style={{ color: 'var(--balloon)' }}>
              IABP {set.iabpRatio === 2 ? '1:2' : '1:1'}
            </span>
          )}
          {act.impellaLevel > 0.05 && (
            <span className={`chip${activeNode?.id === 'impellaFlow' ? ' lit' : ''}`} style={{ color: 'var(--impella)' }}>
              IMPELLA P{fmt(act.impellaLevel, act.impellaLevel % 1 ? 1 : 0)}
            </span>
          )}
          {act.ecmoFlowLpm > 0.05 && (
            <span className={`chip${activeNode?.id === 'ecmoFlow' ? ' lit' : ''}`} style={{ color: 'var(--ecmo)' }}>
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
          <Num d={M.map} v={val(m, M.map)} cls="big ao" node="map" active={activeNode?.id === 'map'} inChain={chainIds.has('map')} onWhy={onWhy} />
          <Num d={M.lvedp} v={val(m, M.lvedp)} cls="big lv" node="lvedp" active={activeNode?.id === 'lvedp'} inChain={chainIds.has('lvedp')} onWhy={onWhy} />
          <div className="num">
            <span className="k">SBP / DBP</span>
            <span className="v">
              {fmt(val(m, M.sbp), 0)}/{fmt(val(m, M.dbp), 0)}
              <small>mmHg</small>
            </span>
          </div>
          <Num d={M.lvedv} v={val(m, M.lvedv)} active={activeNode?.id === 'lvedv'} inChain={chainIds.has('lvedv')} />
          <Num d={M.nativeSv} v={val(m, M.nativeSv)} node="nativeSv" active={activeNode?.id === 'nativeSv'} inChain={chainIds.has('nativeSv')} onWhy={onWhy} />
          <Num d={M.total} v={val(m, M.total)} active={activeNode?.id === 'totalFlow'} inChain={chainIds.has('totalFlow')} />
          <Num d={M.av} v={val(m, M.av)} node="avOpen" active={activeNode?.id === 'avOpen'} inChain={chainIds.has('avOpen')} onWhy={onWhy} />
          <Num d={M.pva} v={val(m, M.pva)} active={activeNode?.id === 'pva'} inChain={chainIds.has('pva')} />
          <Num d={M.dpti} v={val(m, M.dpti)} active={activeNode?.id === 'dpti'} inChain={chainIds.has('dpti')} />
          <Num d={M.svr} v={val(m, M.svr)} active={activeNode?.id === 'svr'} inChain={chainIds.has('svr')} />
        </div>
      </div>
    </section>
  );
}
