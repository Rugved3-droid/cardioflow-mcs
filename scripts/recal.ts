/**
 * Task D candidate search. Read-only: evaluates candidate parameter sets against
 * the S0 design band and the S3 afterload-response targets. Changes nothing.
 */
import { Sim } from '../src/model/sim';
import { NO_DEVICE, SHOCK_PATIENT } from '../src/model/patient';
import type { BeatMetrics, PatientParams } from '../src/model/types';

function pair(p: PatientParams, ecmo = 4): [BeatMetrics, BeatMetrics] {
  const a = new Sim(p, NO_DEVICE);
  a.run(90_000);
  const b = a.clone();
  b.setSettings({ ecmoFlowLpm: ecmo });
  b.snapActuators();
  b.run(90_000);
  return [a.lastBeat!, b.lastBeat!];
}

const Ea = (m: BeatMetrics) => (m.nativeSv > 0.05 ? m.lvesp / m.nativeSv : NaN);
const f = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a').padStart(6);

interface Cand { ees: number; v0: number; a: number; b: number; v0ed: number; svr: number; vol: number }

function build(c: Cand): PatientParams {
  return {
    ...SHOCK_PATIENT,
    lvEes: c.ees, lvV0: c.v0, lvA: c.a, lvB: c.b, lvV0ed: c.v0ed,
    rSvr: c.svr,
    v0: { ...SHOCK_PATIENT.v0, sv: c.vol },
  };
}

/** S0 design band from the README. */
function s0Ok(m: BeatMetrics) {
  return m.map >= 50 && m.map <= 65 && m.lvedp >= 18 && m.lvedp <= 30 && m.nativeCoLpm >= 2.0 && m.nativeCoLpm <= 3.2
    && m.ef >= 8 && m.ef <= 25 && m.lvedv >= 150 && m.lvedv <= 250 && m.avOpenFraction >= 0.15 && m.avOpenFraction <= 0.45;
}

const grid: Cand[] = [];
for (const ees of [0.58, 0.62, 0.66])
  for (const svr of [0.96, 1.05])
    for (const vol of [1350, 1500, 1650])
      grid.push({ ees, v0: 40, a: 8, b: 0.0093, v0ed: 53, svr, vol });

console.log(`evaluating ${grid.length} candidates\n`);
const stiff = (m: BeatMetrics, c: Cand) => c.b * (m.lvedp + c.a);
console.log('ees  V0   A      B    V0ed  svr | S0:  MAP  LVEDP   EDV    CO    EF  AVop Ea/Ees  dP/dV | S3:  MAP  LVEDP  dLVEDP  SWrat    SV  AVop | S0band');
const keep: { c: Cand; s0: BeatMetrics; s3: BeatMetrics; dl: number; swr: number }[] = [];
for (const c of grid) {
  const [s0, s3] = pair(build(c));
  const dl = s3.lvedp - s0.lvedp;
  const swr = s3.strokeWork / s0.strokeWork;
  const ok = s0Ok(s0);
  const good = ok && dl >= 4 && dl <= 11 && swr >= 0.55 && s3.nativeSv < s0.nativeSv && s3.avOpenFraction < s0.avOpenFraction;
  if (good) keep.push({ c, s0, s3, dl, swr });
  console.log(
    `${c.ees.toFixed(2)} ${f(c.v0,0)} ${f(c.a,0)} ${c.b.toFixed(4)} ${f(c.v0ed,0)} ${c.svr.toFixed(2)} ${c.vol} |`,
    f(s0.map), f(s0.lvedp), f(s0.lvedv, 0), f(s0.nativeCoLpm, 2), f(s0.ef), f(s0.avOpenFraction, 2), f(Ea(s0) / c.ees), f(stiff(s0, c), 2),
    '|', f(s3.map), f(s3.lvedp), f(dl), f(swr, 2), f(s3.nativeSv), f(s3.avOpenFraction, 2),
    '|', ok ? 'OK' : '--', good ? '  <== CANDIDATE' : '',
  );
}
console.log(`\n${keep.length} candidate(s) met every target.`);
for (const k of keep) {
  console.log(`  Ees ${k.c.ees}  A ${k.c.a}  B ${k.c.b}  V0ed ${k.c.v0ed}  Rsvr ${k.c.svr}  vol ${k.c.vol}  ->  dLVEDP ${k.dl.toFixed(1)}  SWratio ${k.swr.toFixed(2)}`);
}
