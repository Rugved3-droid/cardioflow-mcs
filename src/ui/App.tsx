import { useEffect, useMemo, useState } from 'react';
import { TwinEngine } from '../runtime/TwinEngine';
import { THERAPY_ORDER, THERAPY_STATES, type TherapyId } from '../model/therapyStates';
import { Pane } from './Pane';
import { Deltas } from './Deltas';
import { AssessPanel } from './AssessPanel';
import { ExploreBar } from './ExploreBar';
import { useFrameLoop } from './useFrameLoop';
import { STEADY_LABEL } from './labels';
import { PHENOTYPE } from '../model/patient';

type Mode = 'explore' | 'assess';

export function App() {
  const engine = useMemo(() => new TwinEngine('S0', STEADY_LABEL.S0), []);
  const { register, version } = useFrameLoop(engine);
  const [mode, setMode] = useState<Mode>('explore');
  const [active, setActive] = useState<TherapyId | null>('S0');

  const goState = (id: TherapyId) => {
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
      if (mode !== 'explore') return;
      const n = Number(e.key);
      if (n >= 1 && n <= 5) goState(THERAPY_ORDER[n - 1]);
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
        <Pane side="left" engine={engine} register={register} version={version} />
        <Deltas engine={engine} version={version} />
        <Pane side="right" engine={engine} register={register} version={version} />
      </main>
      {mode === 'explore' ? (
        <ExploreBar engine={engine} version={version} active={active} onState={goState} />
      ) : (
        <AssessPanel engine={engine} version={version} />
      )}
    </div>
  );
}
