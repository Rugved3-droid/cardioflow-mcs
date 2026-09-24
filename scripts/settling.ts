/**
 * How long does S0 -> S3 actually take to settle, and what does a chain derived
 * at time t narrate compared with the settled truth?
 */
import { Sim } from '../src/model/sim';
import { SHOCK_PATIENT } from '../src/model/patient';
import { THERAPY_STATES } from '../src/model/therapyStates';
import { computeAllSteadyStates } from '../src/model/steadyStates';
import { WOOD_PER_MMHG_S_ML } from '../src/model/baroreflex';

const fresh = computeAllSteadyStates();
const settled = Sim.fromSnapshot(SHOCK_PATIENT, fresh.S3).lastBeat!;

const sim = Sim.fromSnapshot(SHOCK_PATIENT, fresh.S0);
sim.setSettings(THERAPY_STATES.S3.settings);

const f = (x: number, d = 1) => x.toFixed(d).padStart(7);
console.log('S0 -> S3, watching the approach to steady state.');
console.log('  t(s) |     MAP   LVEDP   LVEDV      SV  AVopen  SVR_WU | ECMO cmd  reflex SVR');
const marks = [2, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 90, 120, 150];
let last = 0;
for (const t of marks) {
  sim.run((t - last) * 1000);
  last = t;
  const m = sim.lastBeat!;
  console.log(
    `${String(t).padStart(6)} |`, f(m.map), f(m.lvedp), f(m.lvedv, 0), f(m.nativeSv), f(m.avOpenFraction, 3), f(m.svrWood),
    '|', f(sim.state.act.ecmoFlowLpm, 2), f(sim.state.svr * WOOD_PER_MMHG_S_ML),
  );
}
console.log('\nsettled |', f(settled.map), f(settled.lvedp), f(settled.lvedv, 0), f(settled.nativeSv), f(settled.avOpenFraction, 3), f(settled.svrWood));

console.log('\nError vs settled, as a percentage, at each time:');
console.log('  t(s) |    MAP  LVEDP  LVEDV     SV  AVopen');
const sim2 = Sim.fromSnapshot(SHOCK_PATIENT, fresh.S0);
sim2.setSettings(THERAPY_STATES.S3.settings);
let last2 = 0;
for (const t of marks) {
  sim2.run((t - last2) * 1000);
  last2 = t;
  const m = sim2.lastBeat!;
  const e = (a: number, b: number) => (100 * (a - b)) / Math.abs(b);
  console.log(
    `${String(t).padStart(6)} |`, f(e(m.map, settled.map)), f(e(m.lvedp, settled.lvedp)), f(e(m.lvedv, settled.lvedv)),
    f(e(m.nativeSv, settled.nativeSv)), f(e(m.avOpenFraction, settled.avOpenFraction)),
  );
}
