import { useEffect, useMemo, useRef, useState } from 'react';
import type { TwinEngine } from '../runtime/TwinEngine';
import { fitCanvas } from './canvas';
import { drawWave } from './drawWave';
import { drawPv } from './drawPv';
import { drawAnatomy } from './drawAnatomy';
import { NODE_PART } from '../anatomy/layout';
import { derivePath } from '../causal/derive';
import { NODES } from '../causal/graph';
import { fmt, M, val, type MetricDef } from './metrics';
import { SoloChain } from './SoloChain';
import type { RegisterDraw } from './useFrameLoop';
import steadyStates from '../model/steadyStates.json';
import type { SimSnapshot } from '../model/sim';
import type { SteadyKey } from '../model/steadyStates';

const SNAPSHOTS = steadyStates as unknown as Record<SteadyKey, SimSnapshot>;
/** The untreated patient, used as the reference the chain explains against. */
const BASELINE = SNAPSHOTS.S0.lastBeat!;

/** Same fixed bounds the twin anatomy uses, so a chamber means the same thing in both. */
const V_MIN = 90;
const V_MAX = 240;

/**
 * Which causal node each solo tile shows, and through which twin tile definition.
 * Exported so the harness can assert solo and twin read the same field at the same
 * precision — solo is a view over one engine, not a second set of numbers.
 */
export const SOLO_READS = {
  map: M.map,
  lvedp: M.lvedp,
  nativeSv: M.nativeSv,
  totalFlow: M.total,
  avOpen: M.av,
  lvedv: M.lvedv,
  pva: M.pva,
  svr: M.svr,
} as const;

function Tile({ d, v, big, lit }: { d: MetricDef; v: number; big?: boolean; lit?: boolean }) {
  return (
    <div className={`num${big ? ' big' : ''}${lit ? ' lit' : ''}`}>
      <span className="k">{d.label}</span>
      <span className="v">
        {fmt(v, d.digits)}
        <small>{d.unit}</small>
      </span>
    </div>
  );
}

/**
 * Solo: one patient, full stage.
 *
 * Renders the SAME pane the twin view uses as B (`engine.right`), reading the same
 * Sample and BeatMetrics objects through the same draw functions and the same
 * formatter. Nothing is recomputed here; this is a second view over one engine.
 */
export function SoloView({
  engine,
  register,
  version: _v,
}: {
  engine: TwinEngine;
  register: RegisterDraw;
  version: number;
}) {
  const anat = useRef<HTMLCanvasElement>(null);
  const wave = useRef<HTMLCanvasElement>(null);
  const pv = useRef<HTMLCanvasElement>(null);
  const [target, setTarget] = useState<string>('lvedp');

  const pane = engine.right;
  const m = pane.metrics;

  // which structure the chain's current step points at, so the anatomy can light it
  const activeId = useMemo(() => {
    if (!m) return null;
    const p = derivePath(target, BASELINE, m);
    return p ? p.steps[p.steps.length - 1].node.id : null;
  }, [target, m]);
  const highlight = activeId ? NODE_PART[activeId] ?? null : null;

  useEffect(
    () =>
      register(() => {
        if (anat.current) {
          const [w, h, ctx] = fitCanvas(anat.current);
          drawAnatomy(ctx, w, h, { s: pane.sim.last, st: pane.sim.state, vMin: V_MIN, vMax: V_MAX, highlight, dimOthers: false }, true);
        }
        if (wave.current) {
          const [w, h, ctx] = fitCanvas(wave.current);
          // no trace dimming in solo: the chain is permanently up, so dimming would
          // permanently hide the aortic trace — and the LV/aortic crossing is the
          // single most informative thing on this plot
          drawWave(ctx, w, h, pane.trace, engine.tick, null);
        }
        if (pv.current) {
          const [w, h, ctx] = fitCanvas(pv.current);
          drawPv(ctx, w, h, pane.pv, pane.sim.p, activeId ? NODES[activeId]?.pv ?? null : null);
        }
      }),
    [engine, register, pane, highlight, activeId],
  );

  const set = pane.sim.state.settings;
  const act = pane.sim.state.act;

  return (
    <main className="solo">
      <section className="solo-anat">
        <div className="solo-head">
          <span className="solo-title">{pane.label}</span>
          <span className="chips">
            {(set.iabpOn || act.iabpFill > 0) && (
              <span className="chip" style={{ color: 'var(--balloon)' }}>IABP {set.iabpRatio === 2 ? '1:2' : '1:1'}</span>
            )}
            {act.impellaLevel > 0.05 && (
              <span className="chip" style={{ color: 'var(--impella)' }}>IMPELLA P{fmt(act.impellaLevel, act.impellaLevel % 1 ? 1 : 0)}</span>
            )}
            {act.ecmoFlowLpm > 0.05 && (
              <span className="chip" style={{ color: 'var(--ecmo)' }}>ECMO {fmt(act.ecmoFlowLpm, 1)}</span>
            )}
            {m && m.impellaSuction && <span className="chip flag">SUCTION</span>}
            {m && m.avOpenFraction < 0.005 && (
              <span className="chip" style={{ color: 'var(--rise)' }}>AV CLOSED</span>
            )}
          </span>
        </div>
        <div className="canvas-wrap">
          <canvas ref={anat} aria-label="Device and anatomy" />
        </div>
      </section>

      <section className="solo-right">
        <div className="canvas-wrap solo-wave">
          <canvas ref={wave} aria-label="Pressure waveforms" />
        </div>
        <div className="solo-lower">
          <div className="canvas-wrap">
            <canvas ref={pv} aria-label="LV pressure-volume loop" />
          </div>
          <div className="nums solo-nums">
            <Tile d={M.map} v={val(m, M.map)} big lit={activeId === 'map'} />
            <Tile d={M.lvedp} v={val(m, M.lvedp)} big lit={activeId === 'lvedp'} />
            <Tile d={M.nativeSv} v={val(m, M.nativeSv)} lit={activeId === 'nativeSv'} />
            <Tile d={M.total} v={val(m, M.total)} lit={activeId === 'totalFlow'} />
            <Tile d={M.av} v={val(m, M.av)} lit={activeId === 'avOpen'} />
            <Tile d={M.lvedv} v={val(m, M.lvedv)} lit={activeId === 'lvedv'} />
            <Tile d={M.pva} v={val(m, M.pva)} lit={activeId === 'pva'} />
            <Tile d={M.svr} v={val(m, M.svr)} lit={activeId === 'svr'} />
          </div>
        </div>
      </section>

      {m && (
        <SoloChain
          baseline={BASELINE}
          current={m}
          settled={engine.right.settled}
          target={target}
          onTarget={setTarget}
          activeId={activeId}
        />
      )}
    </main>
  );
}
