import { useEffect, useRef, useState } from 'react';
import type { TwinEngine } from '../runtime/TwinEngine';
import { ITEM_BANK, type Direction, type PredictionItem } from '../assessment/itemBank';
import {
  aggregateCsv,
  allSessions,
  APP_VERSION,
  clearAllSessions,
  download,
  importSessions,
  newSessionId,
  saveSession,
  type ItemResponse,
  type Session,
} from '../assessment/sessionStore';
import { score } from '../assessment/scoring';
import { STEADY_LABEL } from './labels';
import { fmt } from './metrics';

/** Simulated time the intervention runs before the reveal, and how fast it is shown. */
const RUN_TICKS = 20_000;
const RUN_SPEED = 3;

type Phase = 'setup' | 'question' | 'running' | 'revealed' | 'mechRevealed' | 'done';

const DEFAULT_LABELS: Record<Direction, string> = { rise: 'Rise', fall: 'Fall', unchanged: 'Unchanged' };
const ORDER: Direction[] = ['rise', 'fall', 'unchanged'];

function labelsFor(item: PredictionItem) {
  return item.optionLabels ?? DEFAULT_LABELS;
}

export function AssessPanel({ engine, version }: { engine: TwinEngine; version: number }) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [session, setSession] = useState<Session | null>(null);
  const [idx, setIdx] = useState(0);
  const [pick, setPick] = useState<Direction | null>(null);
  const [mech, setMech] = useState<number | null>(null);
  const [cohort, setCohort] = useState('');
  const [stored, setStored] = useState(() => allSessions().length);
  const [note, setNote] = useState('');
  const t = useRef({ shown: 0, shownAt: '', locked: 0, lockedAt: '', mechShown: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const item = ITEM_BANK[idx];

  const startItem = (i: number) => {
    const it = ITEM_BANK[i];
    engine.speed = 1;
    engine.load(it.from, it.from, STEADY_LABEL[it.from], STEADY_LABEL[it.from]);
    setIdx(i);
    setPick(null);
    setMech(null);
    setPhase('question');
    t.current.shown = performance.now();
    t.current.shownAt = new Date().toISOString();
  };

  const start = () => {
    const s: Session = {
      sessionId: newSessionId(),
      cohort: cohort.trim(),
      startedAt: new Date().toISOString(),
      finishedAt: null,
      appVersion: APP_VERSION,
      responses: [],
    };
    setSession(s);
    saveSession(s);
    startItem(0);
  };

  const lock = () => {
    if (!pick) return;
    t.current.locked = performance.now();
    t.current.lockedAt = new Date().toISOString();
    engine.applyRight(item.to, item.intervention);
    engine.speed = RUN_SPEED;
    setPhase('running');
  };

  // advance from "running" to "revealed" once enough simulated time has passed
  useEffect(() => {
    if (phase === 'running' && engine.ticksSinceIntervention >= RUN_TICKS) {
      engine.speed = 1;
      setPhase('revealed');
      t.current.mechShown = performance.now();
    }
  }, [version, phase, engine]);

  const lockMech = () => {
    if (mech === null || !pick || !session) return;
    const r: ItemResponse = {
      itemId: item.id,
      construct: item.construct,
      competencyItem: item.competency,
      stem: `${item.intervention}. ${item.variable} will:`,
      prediction: pick,
      predictionLabel: labelsFor(item)[pick],
      correctAnswer: item.correct,
      predictionCorrect: pick === item.correct,
      latencyMs: t.current.locked - t.current.shown,
      mechanismChoice: mech,
      mechanismCorrectIndex: item.mechanism.correctIndex,
      mechanismCorrect: mech === item.mechanism.correctIndex,
      mechanismLatencyMs: performance.now() - t.current.mechShown,
      shownAt: t.current.shownAt,
      lockedAt: t.current.lockedAt,
    };
    const next = { ...session, responses: [...session.responses, r] };
    setSession(next);
    if (!saveSession(next)) setNote('Warning: browser storage unavailable — export the session JSON before closing.');
    setStored(allSessions().length);
    setPhase('mechRevealed');
  };

  const nextItem = () => {
    if (idx + 1 < ITEM_BANK.length) startItem(idx + 1);
    else if (session) {
      const done = { ...session, finishedAt: new Date().toISOString() };
      setSession(done);
      saveSession(done);
      setStored(allSessions().length);
      setPhase('done');
    }
  };

  const onImport = async (files: FileList | null) => {
    if (!files) return;
    let n = 0;
    for (const f of Array.from(files)) {
      try {
        n += importSessions(JSON.parse(await f.text()));
      } catch {
        setNote(`Could not read ${f.name}`);
      }
    }
    setStored(allSessions().length);
    setNote(`Imported ${n} session(s).`);
  };

  const dataTools = (
    <div className="row small muted">
      <span className="mono">{stored} session(s) stored on this machine</span>
      <button className="btn" onClick={() => download(`cardioflow-sessions-${new Date().toISOString().slice(0, 10)}.csv`, aggregateCsv(allSessions()), 'text/csv')}>
        Export all sessions (CSV)
      </button>
      <button className="btn" onClick={() => fileRef.current?.click()}>Import session JSON…</button>
      <input ref={fileRef} type="file" accept=".json,application/json" multiple hidden onChange={(e) => onImport(e.target.files)} />
      <button
        className="btn"
        onClick={() => {
          if (confirm('Delete every stored session on this machine? Export first if you need them.')) {
            clearAllSessions();
            setStored(0);
          }
        }}
      >
        Clear stored data
      </button>
      {note && <span>{note}</span>}
    </div>
  );

  if (phase === 'setup') {
    return (
      <div className="drawer">
        <div className="row" style={{ marginBottom: 10 }}>
          <span className="q-stem" style={{ margin: 0 }}>Resident session</span>
          <span className="muted">{ITEM_BANK.length} prediction items · anonymous · about 10 minutes</span>
        </div>
        <div className="row" style={{ marginBottom: 10 }}>
          <label className="ctl">
            Group tag (optional, no names)
            <input type="text" value={cohort} onChange={(e) => setCohort(e.target.value)} placeholder="e.g. PGY2-Oct" />
          </label>
          <button className="btn primary" onClick={start}>Start session</button>
        </div>
        {dataTools}
      </div>
    );
  }

  if (phase === 'done' && session) {
    const sc = score(session);
    return (
      <div className="drawer">
        <div className="row" style={{ alignItems: 'flex-start', gap: 32 }}>
          <div>
            <div className="muted small mono">SESSION {session.sessionId}</div>
            <div className="small muted">{sc.headline.label}</div>
            <div className="headline">
              {fmt(sc.headline.pct, 0)}% <span className="muted small">({sc.headline.correct}/{sc.headline.n} items)</span>
            </div>
            <div className="small">
              Key dissociation (VA-ECMO: MAP ↑ and LVEDP ↑):{' '}
              <b className={sc.headline.keyPair === 'both-correct' ? 'verdict ok' : 'verdict no'}>
                {sc.headline.keyPair === 'both-correct' ? 'demonstrated' : sc.headline.keyPair === 'missed' ? 'not demonstrated' : 'not attempted'}
              </b>
            </div>
            <div className="small muted" style={{ marginTop: 6 }}>
              Predictions {fmt(sc.predictionPct, 0)}% · mechanisms {fmt(sc.mechanismPct, 0)}% · median time to answer {fmt(sc.medianLatencyMs / 1000, 1)} s
            </div>
          </div>
          <table className="score">
            <thead>
              <tr><th>Construct</th><th>Prediction</th><th>Mechanism</th></tr>
            </thead>
            <tbody>
              {sc.byConstruct.map((c) => (
                <tr key={c.construct}>
                  <td>{c.label}</td>
                  <td>{c.predictionCorrect}/{c.n}</td>
                  <td>{c.mechanismCorrect}/{c.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <button className="btn primary" onClick={() => download(`cardioflow-session-${session.sessionId}.json`, JSON.stringify(session, null, 2), 'application/json')}>
              Download this session (JSON)
            </button>
            <button className="btn" onClick={() => { setSession(null); setPhase('setup'); }}>New session</button>
          </div>
        </div>
        <div className="small muted" style={{ marginTop: 8 }}>Educational formative feedback only — not a validated assessment instrument.</div>
        <div style={{ marginTop: 8 }}>{dataTools}</div>
      </div>
    );
  }

  const labels = labelsFor(item);
  const revealed = phase === 'revealed' || phase === 'mechRevealed';
  const ma = engine.left.metrics;
  const mb = engine.right.metrics;
  const k = item.observe.metric;
  const oa = ma ? (ma[k] as number) : NaN;
  const ob = mb ? (mb[k] as number) : NaN;
  const obsDigits = item.observe.unit === 'of cycle' ? 2 : 0;
  const progress = Math.min(engine.ticksSinceIntervention / RUN_TICKS, 1);

  return (
    <div className="drawer">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="q-intervention">
          ITEM {idx + 1}/{ITEM_BANK.length} · INTERVENTION ON B: {item.intervention.toUpperCase()}
        </span>
        <span className="mono small muted">SESSION {session?.sessionId}</span>
      </div>
      <div className="q-stem">{item.variable} will:</div>
      <div className="row">
        {ORDER.map((d) => {
          const cls = revealed ? (d === item.correct ? 'right' : d === pick ? 'wrong' : '') : d === pick ? 'sel' : '';
          return (
            <button key={d} className={`btn opt ${cls}`} disabled={phase !== 'question'} onClick={() => setPick(d)} aria-pressed={pick === d}>
              {labels[d]}
            </button>
          );
        })}
        {phase === 'question' && (
          <button className="btn primary" disabled={!pick} onClick={lock}>Lock answer & run</button>
        )}
        {phase === 'running' && (
          <span className="row">
            <span className="mono small muted">RUNNING ⏩ {RUN_SPEED}×</span>
            <span className="progress"><i style={{ width: `${progress * 100}%` }} /></span>
          </span>
        )}
        {revealed && (
          <span className={`verdict ${pick === item.correct ? 'ok' : 'no'}`}>
            {pick === item.correct ? '✓ Correct' : `✗ Expected: ${labels[item.correct]}`}
            <span className="mono small muted" style={{ marginLeft: 12 }}>
              simulator: A {fmt(oa, obsDigits)} → B {fmt(ob, obsDigits)} {item.observe.unit}
            </span>
          </span>
        )}
      </div>
      {revealed && (
        <div style={{ marginTop: 10 }}>
          <div className="small muted" style={{ marginBottom: 6 }}>{item.mechanism.stem}</div>
          <div className="row" style={{ alignItems: 'stretch' }}>
            <div className="mechgrid">
              {item.mechanism.options.map((o, i) => {
                const cls =
                  phase === 'mechRevealed' ? (i === item.mechanism.correctIndex ? 'right' : i === mech ? 'wrong' : '') : i === mech ? 'sel' : '';
                return (
                  <button key={i} className={`btn opt mech ${cls}`} disabled={phase !== 'revealed'} onClick={() => setMech(i)}>
                    {o}
                  </button>
                );
              })}
            </div>
            {phase === 'revealed' && (
              <button className="btn primary" disabled={mech === null} onClick={lockMech}>Lock</button>
            )}
          </div>
        </div>
      )}
      {phase === 'mechRevealed' && (
        <div className="row" style={{ marginTop: 10, alignItems: 'flex-end' }}>
          <div>
            <div className="chain">{item.explanation}</div>
            <div className="source">Key source: {item.source}</div>
          </div>
          <button className="btn primary" onClick={nextItem}>{idx + 1 < ITEM_BANK.length ? 'Next item →' : 'Finish & see scorecard'}</button>
        </div>
      )}
      {note && <div className="small muted">{note}</div>}
    </div>
  );
}
