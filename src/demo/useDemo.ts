import { useCallback, useMemo, useRef, useState } from 'react';
import type { TwinEngine } from '../runtime/TwinEngine';
import type { TherapyId } from '../model/therapyStates';
import { DemoRunner } from './runner';

export interface DemoApi {
  /** set when the script wants a displayed chain cleared */
  dismissWhy: number;
  running: boolean;
  index: number;
  caption: string;
  panel: 'plane' | 'anatomy' | 'none';
  start: () => void;
  stop: () => void;
  /** target the script wants explained; consumed once by the host */
  pendingWhy: string | null;
  clearWhy: () => void;
  /** called once per frame by the render loop */
  update: () => void;
}

/**
 * Thin React wrapper around DemoRunner. All sequencing lives in the runner so the
 * harness can drive the same logic headlessly and prove two runs are identical.
 */
export function useDemo(engine: TwinEngine, onTherapy: (id: TherapyId) => void): DemoApi {
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [caption, setCaption] = useState('');
  const [panel, setPanel] = useState<'plane' | 'anatomy' | 'none'>('none');
  const [pendingWhy, setPendingWhy] = useState<string | null>(null);
  const [dismissWhy, setDismissWhy] = useState(0);
  const therapyRef = useRef(onTherapy);
  therapyRef.current = onTherapy;

  const runner = useMemo(
    () =>
      new DemoRunner(engine, {
        onTherapy: (id) => therapyRef.current(id),
        onCaption: setCaption,
        onPanel: setPanel,
        onWhy: setPendingWhy,
        onDismissWhy: () => setDismissWhy((n) => n + 1),
      }),
    [engine],
  );

  const update = useCallback(() => {
    const wasRunning = runner.running;
    runner.update();
    if (runner.running !== wasRunning) setRunning(runner.running);
    setIndex((i) => (i === runner.index ? i : runner.index));
  }, [runner]);

  return {
    running,
    index,
    caption,
    panel,
    pendingWhy,
    dismissWhy,
    clearWhy: useCallback(() => setPendingWhy(null), []),
    update,
    start: useCallback(() => {
      runner.start();
      setRunning(true);
      setIndex(0);
    }, [runner]),
    stop: useCallback(() => {
      runner.stop();
      setRunning(false);
      setIndex(0);
    }, [runner]),
  };
}
