/**
 * Derive the causal path that was ACTUALLY traversed on this occasion.
 *
 * The graph says what *can* influence what. This module looks at the real
 * before/after beat, works out which way each variable actually moved, and then
 * walks the graph accepting only edges whose predicted direction matches the
 * observed one. The chain the learner sees is therefore assembled from this run's
 * numbers; it is not a stored paragraph keyed to the intervention.
 *
 * If no consistent path exists, that is reported honestly rather than papered
 * over with a plausible-sounding story.
 */

import type { BeatMetrics } from '../model/types';
import { EDGES, NODES, OUT, type CausalEdge, type CausalNode } from './graph';

export type Dir = 'up' | 'down' | 'same';

/** Change band per node: |delta| at or below this counts as unchanged. */
const BAND: Record<string, number> = {
  map: 1, lvedp: 0.8, lvedv: 2, nativeSv: 0.8, avOpen: 0.01, pva: 60, dpti: 0.3,
  totalFlow: 0.1, ecmoFlow: 0.1, impellaFlow: 0.1, balloon: 0.05, lap: 0.8,
  peakDiastolicP: 1, afterload: 1, svr: 0.2, lvVolume: 2,
};
const DEFAULT_BAND = 0.5;

export interface Observation {
  dir: Dir;
  before: number;
  after: number;
  delta: number;
  /** false when the node has no metric and its direction had to be inferred */
  observed: boolean;
}

export function observe(node: CausalNode, pre: BeatMetrics, post: BeatMetrics): Observation | null {
  if (!node.metric) return null;
  const a = pre[node.metric] as number;
  const b = post[node.metric] as number;
  if (typeof a !== 'number' || typeof b !== 'number') return null;
  const d = b - a;
  const band = BAND[node.id] ?? DEFAULT_BAND;
  return { dir: Math.abs(d) <= band ? 'same' : d > 0 ? 'up' : 'down', before: a, after: b, delta: d, observed: true };
}

export function observeAll(pre: BeatMetrics, post: BeatMetrics): Record<string, Observation> {
  const out: Record<string, Observation> = {};
  for (const n of Object.values(NODES)) {
    const o = observe(n, pre, post);
    if (o) out[n.id] = o;
  }
  return out;
}

const flip = (d: Dir, sign: 1 | -1): Dir => (d === 'same' ? 'same' : sign === 1 ? d : d === 'up' ? 'down' : 'up');

export interface PathStep {
  node: CausalNode;
  dir: Dir;
  obs: Observation | null;
  /** the edge that led here; null for the first step */
  via: CausalEdge | null;
}

export interface CausalPath {
  steps: PathStep[];
  /** true when every intermediate node's direction was measured, not inferred */
  fullyObserved: boolean;
}

/**
 * Find the traversed path from a changed device root to `targetId`.
 *
 * Breadth-first, so the shortest consistent chain wins. An edge is traversable
 * only if the direction it predicts for its target matches what the target
 * actually did (nodes with no metric are unobservable and are accepted on the
 * predicted direction).
 */
export function derivePath(targetId: string, pre: BeatMetrics, post: BeatMetrics): CausalPath | null {
  const obs = observeAll(pre, post);
  const roots = Object.values(NODES).filter((n) => n.root && obs[n.id] && obs[n.id].dir !== 'same');
  if (!roots.length) return null;

  type QItem = { id: string; dir: Dir; path: PathStep[]; seen: Set<string> };
  const queue: QItem[] = roots.map((r) => ({
    id: r.id,
    dir: obs[r.id].dir,
    path: [{ node: r, dir: obs[r.id].dir, obs: obs[r.id], via: null }],
    seen: new Set([r.id]),
  }));

  let best: CausalPath | null = null;
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.id === targetId) {
      const fully = cur.path.every((s) => s.obs !== null);
      if (!best || (fully && !best.fullyObserved)) best = { steps: cur.path, fullyObserved: fully };
      if (fully) return best; // shortest fully-observed path wins outright
      continue;
    }
    for (const e of OUT[cur.id] ?? []) {
      if (cur.seen.has(e.to)) continue;
      if (e.when && !e.when(post)) continue;
      const predicted = flip(cur.dir, e.sign);
      if (predicted === 'same') continue;
      const o = obs[e.to] ?? null;
      // an observable node must actually have moved the predicted way
      if (o && o.dir !== predicted) continue;
      const node = NODES[e.to];
      if (!node) continue;
      queue.push({
        id: e.to,
        dir: predicted,
        path: [...cur.path, { node, dir: predicted, obs: o, via: e }],
        seen: new Set(cur.seen).add(e.to),
      });
    }
  }
  return best;
}

/**
 * Re-read every step of an already-derived path against the CURRENT pane metrics.
 *
 * The path structure is fixed when the chain is derived; the numbers are not. The
 * ribbon renders from this, and the numeric tiles render from the same BeatMetrics
 * objects, so the two cannot disagree in a single frame. `contradicted` flags a step
 * whose live direction no longer matches the direction the chain claims, which can
 * happen while an intervention is still equilibrating.
 */
export interface LiveStep {
  step: PathStep;
  obs: Observation | null;
  contradicted: boolean;
}

export function liveSteps(path: CausalPath, pre: BeatMetrics, post: BeatMetrics): LiveStep[] {
  return path.steps.map((step) => {
    const obs = observe(step.node, pre, post);
    return { step, obs, contradicted: !!obs && obs.dir !== step.dir };
  });
}

/**
 * Nodes permitted to have no metric of their own. Anything not listed here must be
 * measurable, so a new unobservable node fails the build rather than quietly using
 * up the one allowance E10 grants per chain.
 */
export const UNOBSERVABLE_ALLOWED: ReadonlySet<string> = new Set(['arterialVolume']);

/** Targets offered as a "WHY?" control. */
export const WHY_TARGETS = ['map', 'lvedp', 'nativeSv', 'avOpen'] as const;
export type WhyTarget = (typeof WHY_TARGETS)[number];

/** Sanity: every edge references nodes that exist, and no node is silently unmeasurable. */
export function graphIntegrity(): string[] {
  const problems: string[] = [];
  for (const e of EDGES) {
    if (!NODES[e.from]) problems.push(`edge from unknown node "${e.from}"`);
    if (!NODES[e.to]) problems.push(`edge to unknown node "${e.to}"`);
    if (!e.mechanism.trim()) problems.push(`edge ${e.from}->${e.to} has no mechanism string`);
  }
  for (const n of Object.values(NODES)) {
    if (!n.metric && !UNOBSERVABLE_ALLOWED.has(n.id)) {
      problems.push(`node "${n.id}" has no metric and is not on the unobservable whitelist`);
    }
    if (n.metric && UNOBSERVABLE_ALLOWED.has(n.id)) {
      problems.push(`node "${n.id}" is on the unobservable whitelist but now has a metric - remove it`);
    }
  }
  for (const id of UNOBSERVABLE_ALLOWED) {
    if (!NODES[id]) problems.push(`unobservable whitelist names "${id}", which is not a node`);
  }
  return problems;
}
