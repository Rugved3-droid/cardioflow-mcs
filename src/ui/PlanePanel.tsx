import { useEffect, useRef } from 'react';
import type { TwinEngine } from '../runtime/TwinEngine';
import { fitCanvas } from './canvas';
import { drawPlane, type PlaneRef } from './drawPlane';
import { PLANE_DISCLAIMER } from '../plane/plane';
import type { RegisterDraw } from './useFrameLoop';
import steadyStates from '../model/steadyStates.json';
import type { SimSnapshot } from '../model/sim';
import type { SteadyKey } from '../model/steadyStates';

const SNAPSHOTS = steadyStates as unknown as Record<SteadyKey, SimSnapshot>;
const REF_IDS: SteadyKey[] = ['S0', 'S1', 'S2', 'S3', 'S4'];

/** Reference markers come from the shipped steady states, so they never move. */
const REFS: PlaneRef[] = REF_IDS.filter((k) => SNAPSHOTS[k]?.lastBeat).map((k) => ({ id: k, m: SNAPSHOTS[k].lastBeat! }));

export function PlanePanel({
  engine,
  register,
  big = false,
  version: _v,
}: {
  engine: TwinEngine;
  register: RegisterDraw;
  big?: boolean;
  version: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(
    () =>
      register(() => {
        if (!ref.current) return;
        const [w, h, ctx] = fitCanvas(ref.current);
        drawPlane(
          ctx,
          w,
          h,
          REFS,
          [
            { beats: engine.left.beats, color: '--dim', label: 'A', primary: false },
            { beats: engine.right.beats, color: '--lv', label: 'B', primary: true },
          ],
          big,
        );
      }),
    [engine, register, big],
  );

  return (
    <div className={`planebox${big ? ' big' : ''}`}>
      <div className="plane-head">
        PERFUSION vs UNLOADING
        {!big && <span className="plane-hint">P</span>}
      </div>
      <div className="canvas-wrap">
        <canvas ref={ref} aria-label="Perfusion versus ventricular unloading plane" />
      </div>
      <div className="plane-foot">{PLANE_DISCLAIMER}</div>
    </div>
  );
}
