import type { TwinEngine } from '../runtime/TwinEngine';
import { DELTA_KEYS, fmt, M, val, type MetricDef } from './metrics';
import { useTween } from './useFrameLoop';

function DeltaRow({ d, delta }: { d: MetricDef; delta: number }) {
  const t = useTween(delta);
  const dir = !Number.isFinite(delta) || Math.abs(delta) < d.same ? 'same' : delta > 0 ? 'rise' : 'fall';
  const frac = Number.isFinite(t) ? Math.max(-1, Math.min(1, t / d.span)) : 0;
  const arrow = dir === 'rise' ? '▲' : dir === 'fall' ? '▼' : '·';
  return (
    <div className="drow">
      <span className="k">{d.label}</span>
      <span className={`v ${dir}`}>
        {arrow} {dir === 'same' ? '0' : (t > 0 ? '+' : '') + fmt(t, d.digits)}
      </span>
      <span className="bar">
        <i
          style={{
            width: `${Math.abs(frac) * 50}%`,
            left: frac >= 0 ? '50%' : `${50 - Math.abs(frac) * 50}%`,
            background: `var(--${dir})`,
          }}
        />
      </span>
    </div>
  );
}

/** Right minus left, live. Color = direction of change only (never "good"/"bad"). */
export function Deltas({ engine, version: _v }: { engine: TwinEngine; version: number }) {
  const a = engine.left.metrics;
  const b = engine.right.metrics;
  return (
    <aside className="deltas" aria-label="Differences between panes">
      <h3>Δ  B − A</h3>
      {DELTA_KEYS.map((k) => (
        <DeltaRow key={k} d={M[k]} delta={val(b, M[k]) - val(a, M[k])} />
      ))}
    </aside>
  );
}
