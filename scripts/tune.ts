/** Dev tuning: TUNE='{"cSv":90,...}' npx tsx scripts/tune.ts  — prints S0..S4 plus an Impella/ECMO sweep. */
import { Sim } from '../src/model/sim';
import { SHOCK_PATIENT } from '../src/model/patient';
import type { DeviceSettings, PatientParams } from '../src/model/types';
import { NO_DEVICE } from '../src/model/patient';

const over = JSON.parse(process.env.TUNE ?? '{}');
const p: PatientParams = { ...SHOCK_PATIENT, ...over, v0: { ...SHOCK_PATIENT.v0, ...(over.v0 ?? {}) } };
const base = new Sim(p);
base.run(90000);
const f = (x: number, d = 1) => x.toFixed(d).padStart(6);
console.log('label        MAP   SBP   DBP LVEDP LVEDV  SV    CO   Imp  ECMO Total AVfr   PVA  DPTI   LAP   RAP   PA');
function row(label: string, s: Partial<DeviceSettings>) {
  const sim = base.clone();
  sim.setSettings({ ...NO_DEVICE, ...s });
  sim.snapActuators();
  sim.run(60000);
  const m = sim.lastBeat!;
  console.log(label.padEnd(10), f(m.map), f(m.sbp), f(m.dbp), f(m.lvedp), f(m.lvedv, 0), f(m.nativeSv), f(m.nativeCoLpm, 2), f(m.impellaLpm, 2), f(m.ecmoLpm, 2), f(m.totalFlowLpm, 2), f(m.avOpenFraction, 2), f(m.pva, 0), f(m.dpti, 1), f(m.lapMean), f(m.rapMean), f(m.paMean), m.impellaSuction ? 'SUCT' : '', m.ecmoDrainageLimited ? 'DRAIN' : '');
}
row('S0', {});
row('S1 IABP', { iabpOn: true });
for (const l of [2, 4, 6, 8]) row(`Imp P${l}`, { impellaLevel: l });
for (const q of [1, 2, 3, 4]) row(`ECMO ${q}`, { ecmoFlowLpm: q });
for (const l of [2, 4, 6, 8]) row(`E4+P${l}`, { ecmoFlowLpm: 4, impellaLevel: l });
for (const [e, l] of JSON.parse(process.env.EXTRA ?? '[]')) row(`E${e}+P${l}`, { ecmoFlowLpm: e, impellaLevel: l });
