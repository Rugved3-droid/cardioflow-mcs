import { useEffect, useMemo, useRef, useState } from 'react';
import { TwinEngine } from '../runtime/TwinEngine';
import { THERAPY_ORDER, THERAPY_STATES, type TherapyId } from '../model/therapyStates';
import { Pane } from './Pane';
import { Deltas } from './Deltas';
import { AssessPanel } from './AssessPanel';
import { ExploreBar } from './ExploreBar';
import { useFrameLoop } from './useFrameLoop';
import { STEADY_LABEL } from './labels';
import { PHENOTYPE } from '../model/patient';
import { useWhy } from '../causal/useWhy';
import { WHY_TARGETS } from '../causal/derive';
import { ChainRibbon } from './ChainRibbon';
import { PlanePanel } from './PlanePanel';
import { AnatomyBand } from './AnatomyBand';

type Mode = 'explore' | 'assess';

export function App() {
  const engine = useMemo(() => new TwinEngine('S0', STEADY_LABEL.S0), []);
  const { register, version } = useFrameLoop(engine);
  const [mode, setMode] = useState<Mode>('explore');
  const [active, setActive] = useState<TherapyId | null>('S0');
  const [planeBig, setPlaneBig] = useState(false);
  const [anatBig, setAnatBig] = useState(false);
  const { why, start, stop, activeNode, chainNodes } = useWhy();
  const chainIds = useMemo(() => new Set(chainNodes.map((n) => n.id)), [chainNodes]);

  /** Explain a variable by diffing pane A (before) against pane B (after). */
  const explain = (target: string) => {
    const pre = engine.left.metrics;
    const post = engine.right.metrics;
    if (!pre || !post) return;
    if (!start(target, pre, post)) setNoPath(target);
  };
  const [noPath, setNoPath] = useState<string | null>(null);
  /** W steps through the WHY targets in a fixed order, so a scripted demo repeats exactly. */
  const whyIdx = useRef(0);
  useEffect(() => {
    if (!noPath) return;
    const t = window.setTimeout(() => setNoPath(null), 3500);
    return () => window.clearTimeout(t);
  }, [noPath]);

  const goState = (id: TherapyId) => {
    stop();
    whyIdx.current = 0;
    engine.fork(THERAPY_STATES[id].settings, THERAPY_STATES[id].name);
    setActive(id);
  };

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    engine.speed = 1;
    engine.load('S0', 'S0', STEADY_LABEL.S0, STEADY_LABEL.S0);
    setActive('S0');
    setMode(m);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === ' ') {
        engine.paused = !engine.paused;
        e.preventDefault();
        return;
      }
      if (e.key === 'a' || e.key === 'A') {
        setAnatBig((v) => !v);
        return;
      }
      if (e.key === 'p' || e.key === 'P') {
        setPlaneBig((v) => !v);
        return;
      }
      if (e.key === 'w' || e.key === 'W') {
        const t = WHY_TARGETS[whyIdx.current % WHY_TARGETS.length];
        whyIdx.current += 1;
        explain(t);
        return;
      }
      if (mode !== 'explore') return;
      const n = Number(e.key);
      if (n >= 1 && n <= 5) goState(THERAPY_ORDER[n - 1]);
      else if (n === 6) goState('S5');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const simS = engine.tick / 1000;
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          CARDIOFLOW <span>MCS</span>
        </div>
        <div className="phenotype" title={PHENOTYPE.summary}>
          <span className="ph-dot" aria-hidden="true" />
          {PHENOTYPE.short}
          <span className="ph-nums">Ees {PHENOTYPE.ees} · Ea/Ees ≈ {PHENOTYPE.eaOverEes} · EF ≈ {PHENOTYPE.ef}%</span>
        </div>
        <div className="disclaimer">Educational model · not clinically validated · not for patient care</div>
        <div className="spacer" />
        <div className="clock">
          t <b>{simS.toFixed(1)}</b> s · HR <b>{engine.left.sim.p.hr}</b>
          {engine.speed !== 1 && <> · <b>{engine.speed}×</b></>}
          {engine.paused && <> · <b>PAUSED</b></>}
        </div>
        <div className="seg" role="tablist">
          <button className={mode === 'explore' ? 'on' : ''} onClick={() => switchMode('explore')}>Explore</button>
          <button className={mode === 'assess' ? 'on' : ''} onClick={() => switchMode('assess')}>Resident session</button>
        </div>
      </header>
      <main className="stage">
        <Pane side="left" engine={engine} register={register} version={version} activeNode={activeNode} chainIds={chainIds} />
        <div className="midcol">
          <Deltas engine={engine} version={version} />
          <PlanePanel engine={engine} register={register} version={version} />
        </div>
        <Pane side="right" engine={engine} register={register} version={version} activeNode={activeNode} chainIds={chainIds} onWhy={explain} />
      </main>
      <AnatomyBand engine={engine} register={register} activeNode={activeNode} version={version} />
      {anatBig && (
        <div className="plane-overlay" onClick={() => setAnatBig(false)} role="dialog" aria-label="Device and anatomy schematic">
          <div className="anat-overlay-inner" onClick={(e) => e.stopPropagation()}>
            <AnatomyBand engine={engine} register={register} activeNode={activeNode} version={version} big />
          </div>
        </div>
      )}
      {planeBig && (
        <div className="plane-overlay" onClick={() => setPlaneBig(false)} role="dialog" aria-label="Perfusion versus unloading plane">
          <div onClick={(e) => e.stopPropagation()}>
            <PlanePanel engine={engine} register={register} version={version} big />
          </div>
        </div>
      )}
      {why && engine.left.metrics && engine.right.metrics && (
        <ChainRibbon
          why={why}
          pre={engine.left.metrics}
          post={engine.right.metrics}
          settled={engine.left.settled && engine.right.settled}
          onDismiss={stop}
        />
      )}
      {noPath && (
        <div className="chainbar nopath">
          No chain in the graph links the current intervention to that variable, and it did not move
          measurably. Nothing is being asserted.
        </div>
      )}
      {mode === 'explore' ? (
        <ExploreBar engine={engine} version={version} active={active} onState={goState} />
      ) : (
        <AssessPanel engine={engine} version={version} />
      )}
    </div>
  );
}
