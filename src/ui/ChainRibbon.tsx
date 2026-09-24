import type { WhyState } from '../causal/useWhy';
import { fmt } from './metrics';

const ARROW: Record<string, string> = { up: '↑', down: '↓', same: '·' };

/**
 * The derived causal chain, revealed one link at a time as the highlight walks it.
 * Every clause comes from the graph edge that was actually traversed and the real
 * before/after numbers — nothing here is a stored sentence.
 */
export function ChainRibbon({ why, onDismiss }: { why: WhyState; onDismiss: () => void }) {
  const { path, active } = why;
  return (
    <div className="chainbar" role="status" aria-live="polite">
      <div className="chain-steps">
        {path.steps.map((s, i) => {
          const shown = i <= active;
          const isActive = i === active;
          return (
            <span key={s.node.id} className={`cstep ${shown ? 'on' : ''} ${isActive ? 'now' : ''} ${s.dir}`}>
              {i > 0 && <em className="carrow">→</em>}
              <span className="cnode">
                <b>{s.node.short}</b>
                <i className="cdir">{ARROW[s.dir]}</i>
                {s.obs ? (
                  <span className="cval">
                    {fmt(s.obs.before, s.node.digits ?? 0)} → {fmt(s.obs.after, s.node.digits ?? 0)}
                    {s.node.unit ? ` ${s.node.unit}` : ''}
                  </span>
                ) : (
                  <span className="cval inferred">not directly measured</span>
                )}
              </span>
            </span>
          );
        })}
      </div>
      <div className="chain-mech">
        {path.steps[active]?.via ? path.steps[active].via!.mechanism : 'the intervention the operator made'}
      </div>
      <button className="btn small" onClick={onDismiss}>Dismiss</button>
    </div>
  );
}
