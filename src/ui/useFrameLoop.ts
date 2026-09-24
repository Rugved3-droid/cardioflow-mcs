import { useCallback, useEffect, useRef, useState } from 'react';
import type { TwinEngine } from '../runtime/TwinEngine';

export type DrawFn = () => void;
export type RegisterDraw = (fn: DrawFn) => () => void;

/**
 * One requestAnimationFrame loop for the whole app: advance the engine by the
 * elapsed wall time (the engine converts that into whole 1 ms ticks), then run
 * every registered canvas draw. React re-renders only on beat boundaries.
 */
export function useFrameLoop(engine: TwinEngine): { register: RegisterDraw; version: number } {
  const draws = useRef(new Set<DrawFn>());
  const [version, setVersion] = useState(0);

  const register = useCallback<RegisterDraw>((fn) => {
    draws.current.add(fn);
    return () => draws.current.delete(fn);
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      engine.frame(now - last);
      last = now;
      for (const d of draws.current) d();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const off = engine.on(() => setVersion((v) => v + 1));
    return () => {
      cancelAnimationFrame(raf);
      off();
    };
  }, [engine]);

  return { register, version };
}

/** Animate a displayed number toward its target (visual only). */
export function useTween(target: number, ms = 450): number {
  const [v, setV] = useState(target);
  const from = useRef(target);
  const cur = useRef(target);
  useEffect(() => {
    if (!Number.isFinite(target)) {
      setV(target);
      cur.current = target;
      return;
    }
    from.current = Number.isFinite(cur.current) ? cur.current : target;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min((now - t0) / ms, 1);
      const e = 1 - Math.pow(1 - k, 3);
      const x = from.current + (target - from.current) * e;
      cur.current = x;
      setV(x);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
