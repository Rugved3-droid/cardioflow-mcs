import { useEffect, useRef } from 'react';
import type { TwinEngine } from '../runtime/TwinEngine';
import { fitCanvas } from './canvas';
import { drawAnatomy } from './drawAnatomy';
import { NODE_PART } from '../anatomy/layout';
import type { CausalNode } from '../causal/graph';
import type { RegisterDraw } from './useFrameLoop';

/**
 * LV cavity bounds used to scale the drawn chamber. Fixed, not auto-ranged, so the
 * two panes are directly comparable and a chamber has the same size for the same
 * volume in every state.
 */
const V_MIN = 90;
const V_MAX = 240;

function Heart({
  engine,
  side,
  register,
  activeNode,
  big,
}: {
  engine: TwinEngine;
  side: 'left' | 'right';
  register: RegisterDraw;
  activeNode: CausalNode | null;
  big: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(
    () =>
      register(() => {
        if (!ref.current) return;
        const [w, h, ctx] = fitCanvas(ref.current);
        const pane = engine[side];
        drawAnatomy(
          ctx,
          w,
          h,
          {
            s: pane.sim.last,
            st: pane.sim.state,
            vMin: V_MIN,
            vMax: V_MAX,
            highlight: activeNode ? NODE_PART[activeNode.id] ?? null : null,
          },
          big,
        );
      }),
    [engine, register, side, activeNode, big],
  );
  return (
    <div className="heartbox">
      <div className="heart-tag">{side === 'left' ? 'A' : 'B'}</div>
      <div className="canvas-wrap">
        <canvas ref={ref} aria-label={`${side === 'left' ? 'Before' : 'After'} device and anatomy schematic`} />
      </div>
    </div>
  );
}

export function AnatomyBand({
  engine,
  register,
  activeNode,
  big = false,
  version: _v,
}: {
  engine: TwinEngine;
  register: RegisterDraw;
  activeNode: CausalNode | null;
  big?: boolean;
  version: number;
}) {
  return (
    <div className={`anatomy${big ? ' big' : ''}`}>
      <div className="anat-head">
        DEVICE / ANATOMY — every dimension driven by the live model state
        {!big && <span className="plane-hint">A</span>}
      </div>
      <div className="anat-pair">
        <Heart engine={engine} side="left" register={register} activeNode={activeNode} big={big} />
        <Heart engine={engine} side="right" register={register} activeNode={activeNode} big={big} />
      </div>
    </div>
  );
}
