/**
 * Flow-budget reconciliation at S3. Confirms that reported total systemic flow
 * is the sum of its parts and that it is consistent with the reflex-driven SVR
 * and the measured pressure drop. Read-only.
 */
import { Sim } from '../src/model/sim';
import { NO_DEVICE, SHOCK_PATIENT } from '../src/model/patient';
import { THERAPY_STATES, type TherapyId } from '../src/model/therapyStates';
import { WOOD_PER_MMHG_S_ML } from '../src/model/baroreflex';

const BSA = 1.8; // m^2, assumed for cardiac index only
const LPM = 0.06;

function measure(id: TherapyId) {
  const s = new Sim(SHOCK_PATIENT, NO_DEVICE);
  s.run(120_000);
  s.setSettings(THERAPY_STATES[id].settings);
  s.snapActuators();
  s.run(120_000);

  // integrate one further beat by hand to get mean branch flows and pressures
  const T = s.cycleMs;
  const acc = { qAo: 0, qImp: 0, qEcmo: 0, qSvr: 0, qBron: 0, qRc: 0, pAo: 0, pSa: 0, pSv: 0, pPv: 0 };
  for (let i = 0; i < T; i++) {
    const m = s.last;
    acc.qAo += m.qAortic; acc.qImp += m.qImpella; acc.qEcmo += m.qEcmo;
    acc.qSvr += m.qSvr; acc.qBron += m.qBronchial; acc.qRc += m.qRc;
    acc.pAo += m.pAo; acc.pSa += m.pSa; acc.pSv += m.pSv; acc.pPv += m.pPv;
    s.tick();
  }
  for (const k of Object.keys(acc) as (keyof typeof acc)[]) acc[k] /= T;
  return { m: s.lastBeat!, acc, svr: s.state.svr };
}

const f = (x: number, d = 2) => x.toFixed(d).padStart(7);

for (const id of ['S0', 'S3', 'S4'] as TherapyId[]) {
  const { m, acc, svr } = measure(id);
  const nativeCo = acc.qAo * LPM;
  const impCo = acc.qImp * LPM;
  const ecmoCo = acc.qEcmo * LPM;
  const sumParts = nativeCo + impCo + ecmoCo;
  const svrFlow = acc.qSvr * LPM;
  const bronFlow = acc.qBron * LPM;

  console.log(`\n=== ${id}: ${THERAPY_STATES[id].name} ===`);
  console.log(`  native ejection (across aortic valve)   ${f(nativeCo)} L/min   (SV ${m.nativeSv.toFixed(1)} mL x ${SHOCK_PATIENT.hr.toFixed(0)} bpm = ${f((m.nativeSv * SHOCK_PATIENT.hr) / 1000)})`);
  console.log(`  Impella                                 ${f(impCo)} L/min`);
  console.log(`  VA-ECMO circuit                         ${f(ecmoCo)} L/min`);
  console.log(`  ------------------------------------------------`);
  console.log(`  reported total systemic flow            ${f(sumParts)} L/min   (metric says ${f(m.totalFlowLpm)})`);
  console.log(`  cardiac index at BSA ${BSA}               ${f(sumParts / BSA)} L/min/m2`);
  console.log(`  of which through SVR                    ${f(svrFlow)} L/min`);
  console.log(`  of which bronchial/Thebesian shunt      ${f(bronFlow)} L/min  (${((100 * bronFlow) / sumParts).toFixed(1)}% - bypasses SVR, returns to LA)`);
  console.log(`  balance check  SVR + shunt - total      ${f(svrFlow + bronFlow - sumParts)} L/min`);
  console.log(`  mean pressures  Ao ${f(acc.pAo, 1)}  SA ${f(acc.pSa, 1)}  SV(RAP) ${f(acc.pSv, 1)}  PV(LAP) ${f(acc.pPv, 1)} mmHg`);
  const impliedSvr = (acc.pSa - acc.pSv) / acc.qSvr;
  console.log(`  Ohm check: (mean P_SA - mean P_SV) / Q_SVR = ${f(impliedSvr, 4)} mmHg*s/mL = ${f(impliedSvr * WOOD_PER_MMHG_S_ML)} WU`);
  console.log(`  reflex SVR state                        ${f(svr, 4)} mmHg*s/mL = ${f(svr * WOOD_PER_MMHG_S_ML)} WU   (reported ${f(m.svrWood)})`);
  console.log(`  discrepancy                             ${f(100 * Math.abs(impliedSvr - svr) / svr, 3)} %`);
}
