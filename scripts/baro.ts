/**
 * Task C calibration: pick the baroreflex setpoint that reproduces the open-loop
 * S0 operating point, then report what the reflex does to S3 and S4.
 * Read-only.
 */
import { Sim } from '../src/model/sim';
import { NO_DEVICE, SHOCK_PATIENT } from '../src/model/patient';
import type { BeatMetrics, DeviceSettings, PatientParams } from '../src/model/types';

function run(p: PatientParams, set: Partial<DeviceSettings>): BeatMetrics {
  const s = new Sim(p, NO_DEVICE);
  s.run(120_000);
  if (Object.keys(set).length) {
    s.setSettings(set);
    s.snapActuators();
    s.run(120_000);
  }
  return s.lastBeat!;
}
const f = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a').padStart(7);

const openLoop: PatientParams = { ...SHOCK_PATIENT, baroEnabled: false };
const ol0 = run(openLoop, {});
const ol3 = run(openLoop, { ecmoFlowLpm: 4 });
console.log('OPEN LOOP (reflex off), for reference');
console.log(`  S0  MAP ${f(ol0.map)}  LVEDP ${f(ol0.lvedp)}  SV ${f(ol0.nativeSv)}  AVopen ${f(ol0.avOpenFraction, 3)}  SVR ${f(ol0.svrWood)} WU`);
console.log(`  S3  MAP ${f(ol3.map)}  LVEDP ${f(ol3.lvedp)}  SV ${f(ol3.nativeSv)}  AVopen ${f(ol3.avOpenFraction, 3)}  SVR ${f(ol3.svrWood)} WU`);
console.log(`  dMAP ${f(ol3.map - ol0.map)}  dLVEDP ${f(ol3.lvedp - ol0.lvedp)}\n`);

console.log('SETPOINT SWEEP (reflex on). Target: S0 back on its open-loop operating point.');
console.log('setpt |  S0: MAP  LVEDP    SV  AVopen   SVR_WU |  S3: MAP  LVEDP    SV  AVopen  SVR_WU | dMAP  dLVEDP  ratio');
for (const sp of [66, 68, 70, 72, 74, 76, 78]) {
  const p: PatientParams = { ...SHOCK_PATIENT, baroSetpoint: sp };
  const a = run(p, {});
  const b = run(p, { ecmoFlowLpm: 4 });
  const dM = b.map - a.map;
  const dL = b.lvedp - a.lvedp;
  console.log(
    `${String(sp).padStart(5)} |`, f(a.map), f(a.lvedp), f(a.nativeSv), f(a.avOpenFraction, 3), f(a.svrWood),
    '|', f(b.map), f(b.lvedp), f(b.nativeSv), f(b.avOpenFraction, 3), f(b.svrWood),
    '|', f(dM), f(dL), f(dL / dM, 3),
  );
}
