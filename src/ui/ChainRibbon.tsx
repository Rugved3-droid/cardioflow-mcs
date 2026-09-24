import type { BeatMetrics } from '../model/types';
import { liveSteps } from '../causal/derive';
import type { WhyState } from '../causal/useWhy';
import { NODE_TILE } from './metrics';
import { fmt } from './metrics';

const ARROW: Record<string, string> = { up: '↑', down: '↓', same: '·' };

/**
 * The derived causal chain, revealed one link at a time as the highlight walks it.
 *
 * The path structure is fixed when the chain is derived; the NUMBERS are re-read from
 * the live pane metrics on every render, using the same BeatMetrics objects and the
 * same formatting the numeric tiles use. The ribbon and the tiles therefore cannot
 * quote different values for the same variable in the same frame.
 */
export function ChainRibbon({
  why,
  pre,
  post,
  settled,
  onDismiss,
}: {
  why: WhyState;
  pre: BeatMetrics;
  post: BeatMetrics;
  settled: boolean;
  onDismiss: () => void;
}) {
  const { path, active } = why;
  const live = liveSteps(path, pre, post);

  return (
    <div className="chainbar" role="status" aria-live="polite">
      <div className="chain-steps">
        {live.map(({ step, obs, contradicted }, i) => {
          const shown = i <= active;
          const tile = NODE_TILE[step.node.id];
          const digits = tile ? tile.digits : step.node.digits ?? 0;
          const scale = tile?.scale ?? 1;
          const unit = tile ? tile.unit : step.node.unit ?? '';
          return (
            <span
              key={step.node.id}
              className={`cstep ${shown ? 'on' : ''} ${i === active ? 'now' : ''} ${step.dir}${contradicted ? ' contra' : ''}`}
            >
              {i > 0 && <em className="carrow">→</em>}
              <span className="cnode">
                <b>{step.node.short}</b>
                <i className="cdir">{ARROW[step.dir]}</i>
                {obs ? (
                  <span className="cval">
                    {fmt(obs.before * scale, digits)} → {fmt(obs.after * scale, digits)}
                    {unit ? ` ${unit}` : ''}
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
        {!settled && (
          <span className="settling" title="The intervention is still equilibrating: the baroreflex and the device ramp have not finished. These numbers are a transient, not the steady state.">
            <i className="pulse" /> still equilibrating — values are changing
          </span>
        )}
        {live.some((l) => l.contradicted) && (
          <span className="contra-note">
            a link marked ⚠ has momentarily reversed while the system equilibrates
          </span>
        )}
      </div>
      <button className="btn small" onClick={onDismiss}>Dismiss</button>
    </div>
  );
}
