/**
 * Does the sign of the stroke-work response to VA-ECMO depend on the ventricle's
 * phenotype? PV-loop theory says yes: afterloading a well-coupled ventricle raises
 * end-systolic pressure more than it narrows the loop (SW up), while afterloading a
 * severely uncoupled one collapses ejection (SW down). Ostadal's pigs started at
 * EF 43%; this simulator's patient starts near EF 16%.
 */
import { Sim } from '../src/model/sim';
import { NO_DEVICE, SHOCK_PATIENT } from '../src/model/patient';
import type { BeatMetrics, PatientParams } from '../src/model/types';

const CAND = { lvEes: 0.62, lvV0: 40, lvA: 8, lvB: 0.0093, lvV0ed: 53, rSvr: 0.96, sv: 1500 };
const base: PatientParams = {
  ...SHOCK_PATIENT,
  lvEes: CAND.lvEes, lvV0: CAND.lvV0, lvA: CAND.lvA, lvB: CAND.lvB, lvV0ed: CAND.lvV0ed,
  rSvr: CAND.rSvr, v0: { ...SHOCK_PATIENT.v0, sv: CAND.sv },
};

function pair(p: PatientParams): [BeatMetrics, BeatMetrics] {
  const a = new Sim(p, NO_DEVICE);
  a.run(90_000);
  const b = a.clone();
  b.setSettings({ ecmoFlowLpm: 4 });
  b.snapActuators();
  b.run(90_000);
  return [a.lastBeat!, b.lastBeat!];
}
const Ea = (m: BeatMetrics) => (m.nativeSv > 0.05 ? m.lvesp / m.nativeSv : NaN);
const f = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a').padStart(7);

console.log('Contractility sweep, everything else held. ECMO 0 -> 4 L/min.\n');
console.log('  Ees   EF0  Ea/Ees0 |   SW0    SW3  SWratio |   SV0    SV3 |  LVEDP0 LVEDP3  dLVEDP | AVopen0 AVopen3');
for (const ees of [0.62, 0.9, 1.3, 1.8, 2.4]) {
  const [a, b] = pair({ ...base, lvEes: ees });
  console.log(
    f(ees, 2), f(a.ef), f(Ea(a) / ees, 2), '|', f(a.strokeWork, 0), f(b.strokeWork, 0), f(b.strokeWork / a.strokeWork, 2),
    '|', f(a.nativeSv), f(b.nativeSv), '|', f(a.lvedp), f(b.lvedp), f(b.lvedp - a.lvedp),
    '|', f(a.avOpenFraction, 3), f(b.avOpenFraction, 3),
  );
}
console.log('\nOstadal 2015 (porcine, EF 43% at baseline): SW x1.45, CO -34%, EF 43 -> 32.');
