import { useMemo } from 'react';
import type { BeatMetrics } from '../model/types';
import { derivePath, liveSteps, WHY_TARGETS } from '../causal/derive';
import { NODES } from '../causal/graph';
import { NODE_TILE, fmt } from './metrics';

const ARROW: Record<string, string> = { up: '↑', down: '↓', same: '·' };

/**
 * The causal chain as a permanent panel, for solo mode.
 *
 * Solo has the room that twin does not, so the chain is always on screen instead of
 * being summoned. Everything else about it is unchanged: the same `derivePath`, the
 * same live re-read of pane metrics through the same formatter the tiles use, and the
 * same settle gate. It explains the untreated baseline against the state currently
 * being shown — which is exactly the comparison solo→twin then makes explicit.
 */
export function SoloChain({
  baseline,
  current,
  settled,
  target,
  onTarget,
  activeId,
}: {
  baseline: BeatMetrics;
  current: BeatMetrics;
  settled: boolean;
  target: string;
  onTarget: (t: string) => void;
  activeId: string | null;
}) {
  const path = useMemo(() => derivePath(target, baseline, current), [target, baseline, current]);
  const live = path ? liveSteps(path, baseline, current) : [];

  return (
    <section className="solochain" aria-label="Causal chain">
      <div className="sc-head">
        <span className="sc-title">WHY</span>
        <div className="sc-tabs" role="tablist">
          {WHY_TARGETS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={t === target}
              className={`sc-tab ${t === target ? 'on' : ''}`}
              onClick={() => onTarget(t)}
            >
              {NODES[t].short}
            </button>
          ))}
        </div>
        {!settled && (
          <span className="settling">
            <i className="pulse" /> still equilibrating
          </span>
        )}
      </div>

      {live.length ? (
        <div className="sc-steps">
          {live.map(({ step, obs, contradicted }, i) => {
            const tile = NODE_TILE[step.node.id];
            const digits = tile ? tile.digits : step.node.digits ?? 0;
            const scale = tile?.scale ?? 1;
            const unit = tile ? tile.unit : step.node.unit ?? '';
            return (
              <div
                key={step.node.id}
                className={`sc-step ${step.dir}${contradicted ? ' contra' : ''}${activeId === step.node.id ? ' now' : ''}`}
              >
                {i > 0 && <span className="sc-arrow">↓</span>}
                <div className="sc-card">
                  <div className="sc-node">
                    <b>{step.node.short}</b>
                    <i className="cdir">{ARROW[step.dir]}</i>
                  </div>
                  {obs ? (
                    <div className="sc-val">
                      {fmt(obs.before * scale, digits)} <em>→</em> {fmt(obs.after * scale, digits)}
                      {unit ? ` ${unit}` : ''}
                    </div>
                  ) : (
                    <div className="sc-val inferred">not directly measured</div>
                  )}
                  {step.via && <div className="sc-mech">{step.via.mechanism}</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="sc-empty">
          No device is running, so there is nothing for the graph to explain. Select a therapy.
        </div>
      )}
    </section>
  );
}
