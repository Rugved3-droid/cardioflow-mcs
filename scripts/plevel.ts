/**
 * Which Impella level should the ECpella demo state use?
 * P8 unloads hardest but drives native ejection to zero, so on camera the
 * S3 -> S4 transition can read as the pump having arrested the heart rather
 * than unloaded it. Sweep the level with ECMO HELD at 4 L/min.
 */
import { Sim } from '../src/model/sim';
import { NO_DEVICE, SHOCK_PATIENT } from '../src/model/patient';
import type { BeatMetrics } from '../src/model/types';

function at(impellaLevel: number, ecmoFlowLpm = 4): BeatMetrics {
  const s = new Sim(SHOCK_PATIENT, NO_DEVICE);
  s.run(120_000);
  s.setSettings({ ecmoFlowLpm, impellaLevel });
  s.snapActuators();
  s.run(120_000);
  return s.lastBeat!;
}
const f = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a').padStart(7);

const s3 = at(0, 4);
console.log('S3 reference (VA-ECMO 4, no pump)');
console.log(`  MAP ${f(s3.map)}  LVEDP ${f(s3.lvedp)}  LVEDV ${f(s3.lvedv)}  SV ${f(s3.nativeSv)}  AVopen ${f(s3.avOpenFraction, 3)}  PVA ${f(s3.pva, 0)}  total ${f(s3.totalFlowLpm, 2)}\n`);
console.log('ECMO held at 4 L/min, Impella level swept:');
console.log('  P |    MAP   LVEDP  dLVEDP   LVEDV      SV  AVopen     PVA   Imp   total | suction');
for (const l of [0, 2, 3, 4, 5, 6, 7, 8, 9]) {
  const m = at(l, 4);
  console.log(
    String(l).padStart(3), '|', f(m.map), f(m.lvedp), f(m.lvedp - s3.lvedp), f(m.lvedv), f(m.nativeSv), f(m.avOpenFraction, 3),
    f(m.pva, 0), f(m.impellaLpm, 2), f(m.totalFlowLpm, 2), '|', m.impellaSuction ? 'SUCTION' : '',
  );
}
