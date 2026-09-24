/**
 * Task D analysis: ventriculo-arterial coupling and afterload sensitivity.
 * Read-only — reports on the model as configured, changes nothing.
 *
 *   npx tsx scripts/coupling.ts
 */
import { Sim } from '../src/model/sim';
import { NO_DEVICE, SHOCK_PATIENT } from '../src/model/patient';
import type { BeatMetrics, PatientParams } from '../src/model/types';
import { activation } from '../src/model/ventricle';

const SETTLE = 90_000;
const SUPPORT = 90_000;

function run(p: PatientParams, ecmoLpm: number): BeatMetrics {
  const s = new Sim(p, NO_DEVICE);
  s.run(SETTLE);
  if (ecmoLpm > 0) {
    s.setSettings({ ecmoFlowLpm: ecmoLpm });
    s.snapActuators();
    s.run(SUPPORT);
  }
  return s.lastBeat!;
}

/** Effective arterial elastance actually operating on the ventricle. */
const Ea = (m: BeatMetrics) => (m.nativeSv > 0.05 ? m.lvesp / m.nativeSv : NaN);

const f = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '  n/a').padStart(8);

/* ---------------- E(t) description ---------------- */
function etProfile(p: PatientParams, cycleMs: number) {
  let peak = 0;
  let tPeak = 0;
  let t10up = -1;
  let t10down = -1;
  for (let t = 0; t < cycleMs; t++) {
    const a = activation(t, cycleMs, p.actScale);
    if (a > peak) {
      peak = a;
      tPeak = t;
    }
  }
  for (let t = 0; t < cycleMs; t++) {
    const a = activation(t, cycleMs, p.actScale);
    if (t10up < 0 && a >= 0.1) t10up = t;
    if (t10up >= 0 && t > tPeak && a <= 0.1) {
      t10down = t;
      break;
    }
  }
  return { tPeak, t10up, t10down, dur: t10down - t10up };
}

const cyc = Math.round(60000 / SHOCK_PATIENT.hr);
const et = etProfile(SHOCK_PATIENT, cyc);

console.log('=== CURRENT PARAMETERS ===');
console.log(`LV   Ees ${SHOCK_PATIENT.lvEes}  V0 ${SHOCK_PATIENT.lvV0} mL  A ${SHOCK_PATIENT.lvA} mmHg  B ${SHOCK_PATIENT.lvB} /mL`);
console.log(`Art  Rc ${SHOCK_PATIENT.rc}  Csa ${SHOCK_PATIENT.cSa} mL/mmHg  Rsvr ${SHOCK_PATIENT.rSvr} mmHg*s/mL  Cao ${SHOCK_PATIENT.cAo}`);
console.log(`     Rsvr = ${(SHOCK_PATIENT.rSvr * 16.67).toFixed(1)} Wood units = ${(SHOCK_PATIENT.rSvr * 16.67 * 80).toFixed(0)} dyn*s*cm^-5`);
console.log(`E(t) actScale ${SHOCK_PATIENT.actScale}: peak at ${et.tPeak} ms (${((100 * et.tPeak) / cyc).toFixed(0)}% of the ${cyc} ms cycle), activation>0.1 from ${et.t10up} to ${et.t10down} ms (${et.dur} ms)`);
console.log(`Structural Ea (Rsvr/T) = ${(SHOCK_PATIENT.rSvr / (cyc / 1000)).toFixed(2)} mmHg/mL`);

/* ---------------- coupling at S0 and S3 ---------------- */
const s0 = run(SHOCK_PATIENT, 0);
const s3 = run(SHOCK_PATIENT, 4);
console.log('\n=== COUPLING ===');
console.log('state      ESP     ESV     EDV      SV    LVEDP      Ea   Ea/Ees      EF      SW      PE     PVA   AVopen');
for (const [n, m] of [['S0', s0], ['S3', s3]] as const) {
  console.log(
    n.padEnd(6),
    f(m.lvesp, 1), f(m.lvesv, 1), f(m.lvedv, 1), f(m.nativeSv, 1), f(m.lvedp, 1),
    f(Ea(m)), f(Ea(m) / SHOCK_PATIENT.lvEes, 1), f(m.ef, 1), f(m.strokeWork, 0), f(m.pe, 0), f(m.pva, 0), f(m.avOpenFraction, 3),
  );
}
console.log(`\nS0->S3 deltas:  MAP ${(s3.map - s0.map).toFixed(1)}   LVEDP ${(s3.lvedp - s0.lvedp).toFixed(1)}   SV ${(s3.nativeSv - s0.nativeSv).toFixed(1)}   SW x${(s3.strokeWork / s0.strokeWork).toFixed(2)}   EDV ${((100 * (s3.lvedv - s0.lvedv)) / s0.lvedv).toFixed(1)}%`);
console.log('ANCHORS:  Ostadal 2015 (porcine, EBF 1->5): SW 2096->3031 (x1.45), CO 2.8->1.86, EF 43->32');
console.log('          Donker 2019 (simulation, 4 L/min): PCWP +5 mmHg, EDV +10%');

/* ---------------- one-at-a-time sensitivity ---------------- */
type Knob = { name: string; get: (p: PatientParams) => number; set: (p: PatientParams, v: number) => PatientParams };
const knobs: Knob[] = [
  { name: 'Ees', get: (p) => p.lvEes, set: (p, v) => ({ ...p, lvEes: v }) },
  { name: 'B (EDPVR)', get: (p) => p.lvB, set: (p, v) => ({ ...p, lvB: v }) },
  { name: 'Rc', get: (p) => p.rc, set: (p, v) => ({ ...p, rc: v }) },
  { name: 'actScale', get: (p) => p.actScale, set: (p, v) => ({ ...p, actScale: v }) },
  { name: 'Csa', get: (p) => p.cSa, set: (p, v) => ({ ...p, cSa: v }) },
  { name: 'Rsvr', get: (p) => p.rSvr, set: (p, v) => ({ ...p, rSvr: v }) },
];

console.log('\n=== ONE-AT-A-TIME SENSITIVITY AT S3 (ECMO 4 L/min), +/-20% ===');
console.log('Elasticity = % change in output per % change in parameter (dimensionless; |e|>1 = amplifying).');
console.log('\nknob          base    -20%    +20%   dLVEDP/dp  elast   dSW/dp      elast   SV@+20  AVopen@+20');
for (const k of knobs) {
  const base = k.get(SHOCK_PATIENT);
  const lo = run(k.set(SHOCK_PATIENT, base * 0.8), 4);
  const hi = run(k.set(SHOCK_PATIENT, base * 1.2), 4);
  const dP = base * 0.4;
  const dLvedp = (hi.lvedp - lo.lvedp) / dP;
  const dSw = (hi.strokeWork - lo.strokeWork) / dP;
  const eL = ((hi.lvedp - lo.lvedp) / s3.lvedp) / 0.4;
  const eS = ((hi.strokeWork - lo.strokeWork) / s3.strokeWork) / 0.4;
  console.log(
    k.name.padEnd(12), f(base, 3), f(lo.lvedp, 1), f(hi.lvedp, 1), f(dLvedp, 1), f(eL, 2), f(dSw, 0), f(eS, 2), f(hi.nativeSv, 1), f(hi.avOpenFraction, 3),
  );
}

/* ---------------- what the S0->S3 excursion is most sensitive to ---------------- */
console.log('\n=== EFFECT ON THE S0->S3 EXCURSION ITSELF (what the learner sees) ===');
console.log('knob         value   dLVEDP   dMAP    SW ratio    SV S0->S3      AVopen S0->S3');
for (const k of knobs) {
  const base = k.get(SHOCK_PATIENT);
  for (const mult of [0.8, 1.2]) {
    const p = k.set(SHOCK_PATIENT, base * mult);
    const a = run(p, 0);
    const b = run(p, 4);
    console.log(
      `${k.name} x${mult}`.padEnd(13), f(base * mult, 3), f(b.lvedp - a.lvedp, 1), f(b.map - a.map, 1), f(b.strokeWork / a.strokeWork, 2),
      `${a.nativeSv.toFixed(1)} -> ${b.nativeSv.toFixed(1)}`.padStart(16), `${a.avOpenFraction.toFixed(3)} -> ${b.avOpenFraction.toFixed(3)}`.padStart(20),
    );
  }
}
