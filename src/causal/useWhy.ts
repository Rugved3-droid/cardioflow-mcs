import { useCallback, useEffect, useRef, useState } from 'react';
import type { BeatMetrics } from '../model/types';
import { derivePath, type CausalPath } from './derive';
import type { CausalNode } from './graph';

/** Total time the highlight takes to walk the chain, ms. Tuned to read on video. */
export const WHY_TOTAL_MS = 1500;
const MIN_STEP_MS = 230;
/** How long the finished chain stays up before it can be dismissed. */
const HOLD_MS = 6000;

export interface WhyState {
  target: string;
  path: CausalPath;
  /** index of the step currently emphasised; equals path.steps.length when finished */
  active: number;
  finished: boolean;
}

export interface WhyApi {
  why: WhyState | null;
  /** null when no consistent chain exists for this target on this diff */
  start: (target: string, pre: BeatMetrics, post: BeatMetrics) => boolean;
  stop: () => void;
  /** node currently emphasised, or null */
  activeNode: CausalNode | null;
  /** every node in the chain, for the persistent ribbon */
  chainNodes: CausalNode[];
}

export function useWhy(): WhyApi {
  const [why, setWhy] = useState<WhyState | null>(null);
  const timers = useRef<number[]>([]);

  const clear = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  }, []);

  const stop = useCallback(() => {
    clear();
    setWhy(null);
  }, [clear]);

  const start = useCallback(
    (target: string, pre: BeatMetrics, post: BeatMetrics) => {
      clear();
      const path = derivePath(target, pre, post);
      if (!path || path.steps.length < 2) {
        setWhy(null);
        return false;
      }
      const n = path.steps.length;
      const stepMs = Math.max(WHY_TOTAL_MS / n, MIN_STEP_MS);
      setWhy({ target, path, active: 0, finished: false });
      for (let i = 1; i < n; i++) {
        timers.current.push(
          window.setTimeout(() => setWhy((w) => (w && w.target === target ? { ...w, active: i } : w)), stepMs * i),
        );
      }
      timers.current.push(
        window.setTimeout(
          () => setWhy((w) => (w && w.target === target ? { ...w, active: n - 1, finished: true } : w)),
          stepMs * n,
        ),
      );
      timers.current.push(window.setTimeout(() => setWhy((w) => (w && w.target === target ? null : w)), stepMs * n + HOLD_MS));
      return true;
    },
    [clear],
  );

  useEffect(() => clear, [clear]);

  return {
    why,
    start,
    stop,
    activeNode: why ? why.path.steps[why.active]?.node ?? null : null,
    chainNodes: why ? why.path.steps.map((s) => s.node) : [],
  };
}
