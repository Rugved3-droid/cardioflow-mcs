/** Model ECMO flow sweep at the benchmark flows (0.3, 1..5 L/min), baroreflex on and off. Output: results/v3_ecmo_sweep.csv */
import { runScenario, settingsOf, SHOCK_PATIENT, efMetrics } from '../runner/core';
import { writeCsv } from '../runner/io';
const rows: Record<string, unknown>[] = [];
for (const reflex of ['on', 'off'])
  for (const f of [0, 0.3, 1, 2, 3, 4, 5]) {
    const m = runScenario(settingsOf({ ecmoFlowLpm: f }), { patient: { ...SHOCK_PATIENT, baroEnabled: reflex === 'on' } }).lastBeat!;
    rows.push({ reflex, flow_Lpm: f, LVEDP: m.lvedp, LVEDV: m.lvedv, LVESV: m.lvesv, SV: (m.lvedv * m.ef) / 100, nativeSv: m.nativeSv,
      EF: m.ef, EF_native: efMetrics(m).efNative, SBP: m.sbp, MAP: m.map, PCWP: m.lapMean, strokeWork: m.strokeWork, avOpen: m.avOpenFractionRaw });
  }
writeCsv('v3_ecmo_sweep.csv', rows);
console.table(rows);
