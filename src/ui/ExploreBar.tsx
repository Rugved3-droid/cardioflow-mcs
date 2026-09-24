import type { TwinEngine } from '../runtime/TwinEngine';
import { THERAPY_ORDER, THERAPY_STATES, type TherapyId } from '../model/therapyStates';
import { IABP_TIMINGS, type IabpTimingName } from '../model/devices/iabp';
import { fmt } from './metrics';
import { describeSettings } from './labels';

interface Props {
  engine: TwinEngine;
  version: number;
  active: TherapyId | null;
  onState: (id: TherapyId) => void;
}

/** Free exploration: states fork reality (A keeps going, B gets the change); controls tweak B only. */
export function ExploreBar({ engine, active, onState }: Props) {
  const s = engine.right.sim.state.settings;
  const set = (next: Parameters<TwinEngine['applyRight']>[0], _hint: string) =>
    engine.applyRight(next, describeSettings({ ...s, ...next }));
  const timing = (Object.keys(IABP_TIMINGS) as IabpTimingName[]).find(
    (k) => IABP_TIMINGS[k].inflate === s.iabpInflateOffsetMs && IABP_TIMINGS[k].deflate === s.iabpDeflateOffsetMs,
  );
  return (
    <div className="drawer">
      <div className="row" style={{ marginBottom: 8 }}>
        {THERAPY_ORDER.map((id, i) => (
          <button key={id} className={`btn state ${active === id ? 'on' : ''}`} onClick={() => onState(id)} title={THERAPY_STATES[id].name}>
            <kbd>{i + 1}</kbd>
            {id} {THERAPY_STATES[id].short}
          </button>
        ))}
        <button className={`btn state ${active === 'S5' ? 'on' : ''}`} onClick={() => onState('S5')} title={THERAPY_STATES.S5.name}>
          <kbd>6</kbd>S5 WEANED
        </button>
        <span className="muted small">Press 1–5: B takes the new therapy, A continues the previous one. S4 differs from S3 by the pump alone.</span>
      </div>
      <div className="row">
        <span className="small muted mono">B CONTROLS</span>
        <label className="ctl">
          ECMO
          <input type="range" min={0} max={5} step={0.5} value={s.ecmoFlowLpm} onChange={(e) => set({ ecmoFlowLpm: +e.target.value }, 'Custom')} />
          <b>{fmt(s.ecmoFlowLpm, 1)} L/min</b>
        </label>
        <label className="ctl">
          Impella
          <input type="range" min={0} max={9} step={1} value={s.impellaLevel} onChange={(e) => set({ impellaLevel: +e.target.value }, 'Custom')} />
          <b>{s.impellaLevel ? `P${s.impellaLevel}` : 'off'}</b>
        </label>
        <label className="ctl">
          <input type="checkbox" checked={s.iabpOn} onChange={(e) => set({ iabpOn: e.target.checked }, 'Custom')} />
          IABP
        </label>
        <label className="ctl">
          Timing
          <select
            value={timing ?? 'correct'}
            disabled={!s.iabpOn}
            onChange={(e) => {
              const t = IABP_TIMINGS[e.target.value as IabpTimingName];
              set({ iabpInflateOffsetMs: t.inflate, iabpDeflateOffsetMs: t.deflate }, `IABP — ${t.label}`);
            }}
          >
            {(Object.keys(IABP_TIMINGS) as IabpTimingName[]).map((k) => (
              <option key={k} value={k}>{IABP_TIMINGS[k].label}</option>
            ))}
          </select>
        </label>
        <label className="ctl">
          Ratio
          <select value={s.iabpRatio} disabled={!s.iabpOn} onChange={(e) => set({ iabpRatio: +e.target.value as 1 | 2 }, 'Custom')}>
            <option value={1}>1:1</option>
            <option value={2}>1:2</option>
          </select>
        </label>
      </div>
    </div>
  );
}
