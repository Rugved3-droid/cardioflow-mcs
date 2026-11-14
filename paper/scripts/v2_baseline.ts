/**
 * V2. Baseline physiology vs supplied reference ranges.
 *
 * Scope (author decision 2026-11-14): shock baseline vs reference SHOCK ranges only.
 * The code ships one patient (SHOCK_PATIENT); no normal-physiology parameter set is
 * authored or calibrated (stated as a limitation).
 *
 * PCWP-equivalent = beat-mean pulmonary-venous/LA pressure (the model lumps pulmonary
 * veins and LA into one compliance, so this is mean LAP). SVR-equivalent = beat-mean
 * reflex SVR in Wood units (mmHg*s/mL x 16.6667).
 *
 * If paper/benchmarks/reference_ranges.csv exists (columns: variable,condition,low,high,
 * units,source,page_or_table), each value is classified in/out of range. Otherwise the
 * comparison column reads PENDING.
 *
 * Output: paper/results/v2_baseline.csv
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runScenario, settingsOf, efMetrics } from '../runner/core';
import { writeCsv } from '../runner/io';

const sim = runScenario(settingsOf({}));
const m = sim.lastBeat!;
const vals: [string, string, number][] = [
  ['MAP', 'mmHg', m.map],
  ['SBP', 'mmHg', m.sbp],
  ['DBP', 'mmHg', m.dbp],
  ['CO', 'L/min', m.totalFlowLpm],
  ['SV', 'mL', m.nativeSv],
  ['LVEDP', 'mmHg', m.lvedp],
  ['LVEDV', 'mL', m.lvedv],
  ['LVESV', 'mL', m.lvesv],
  ['EF_native', '%', efMetrics(m).efNative],
  ['LV_emptying_fraction', '%', efMetrics(m).efEmptying],
  ['native_CO', 'L/min', m.nativeCoLpm],
  ['AV_open_fraction', 'fraction of cycle', m.avOpenFractionRaw],
  ['PCWP_equiv_meanLAP', 'mmHg', m.lapMean],
  ['RAP_equiv_meanSVpressure', 'mmHg', m.rapMean],
  ['mPAP', 'mmHg', m.paMean],
  ['SVR_equiv', 'WU', m.svrWood],
  ['HR', 'bpm', sim.p.hr],
];
const refPath = join(import.meta.dirname, '..', 'benchmarks', 'reference_ranges.csv');
let ref: Record<string, string>[] = [];
if (existsSync(refPath)) {
  const [h, ...ls] = readFileSync(refPath, 'utf8').trim().split(/\r?\n/);
  const cols = h.split(',').map((c) => c.trim());
  ref = ls.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v.trim()])));
}
const rows: Record<string, unknown>[] = [];
for (const condition of ['cardiogenic_shock']) {
  for (const [name, units, v] of vals) {
    const r = ref.find((x) => x.variable === name && x.condition === condition);
    rows.push({
      condition,
      variable: name,
      units,
      model_value: v,
      ref_low: r?.low ?? '',
      ref_high: r?.high ?? '',
      ref_source: r ? `${r.source} ${r.page_or_table ?? ''}`.trim() : '',
      verdict: !r ? 'PENDING: no reference range supplied' : v >= Number(r.low) && v <= Number(r.high) ? 'in range' : 'OUT OF RANGE',
    });
  }
}
writeCsv('v2_baseline.csv', rows);
console.table(rows);
