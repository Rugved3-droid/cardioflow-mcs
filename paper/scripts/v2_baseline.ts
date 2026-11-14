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
 * Reference values: paper/benchmarks/reference_ranges.csv (built by build_benchmarks.py from the
 * downloaded sources; columns variable,condition,low,high,units,source,page_or_table,species,note).
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
function parseLine(l: string): string[] {
  const out: string[] = [];
  let cur = '', q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}
let ref: Record<string, string>[] = [];
if (existsSync(refPath)) {
  const [h, ...ls] = readFileSync(refPath, 'utf8').trim().split(/\r?\n/);
  const cols = parseLine(h).map((c) => c.trim());
  ref = ls.map((l) => Object.fromEntries(parseLine(l).map((v, i) => [cols[i], v.trim()])));
}
/**
 * Verdict rules (author instruction 2026-11-14): reference values come only from the shock / LV-failure
 * baselines of the downloaded benchmark papers. Human-simulation sources (Donker 2019) give a point value:
 * the verdict reports model minus source. Porcine sources give mean +- SD: the in/out classification is
 * shown as CONTEXT ONLY, because absolute values are not compared across species.
 */
const rows: Record<string, unknown>[] = [];
for (const [name, units, v] of vals) {
  const rs = ref.filter((x) => x.variable === name && x.condition === 'cardiogenic_shock');
  if (!rs.length) rows.push({ condition: 'cardiogenic_shock', variable: name, units, model_value: v, ref_low: '', ref_high: '', ref_source: '', species: '', verdict: 'no reference value in the benchmark sources' });
  for (const r of rs) {
    const lo = Number(r.low), hi = Number(r.high);
    const verdict = r.species.startsWith('human')
      ? `model - source = ${(v - lo).toFixed(1)} ${units} (${(100 * (v / lo - 1)).toFixed(0)}%)`
      : `context only (porcine): ${v >= lo && v <= hi ? 'inside' : v < lo ? 'below' : 'above'} mean +- SD`;
    rows.push({ condition: 'cardiogenic_shock', variable: name, units, model_value: v, ref_low: r.low, ref_high: r.high,
      ref_source: `${r.source} ${r.page_or_table}`, species: r.species, verdict });
  }
}
writeCsv('v2_baseline.csv', rows);
console.table(rows.map((r) => ({ variable: r.variable, model: Number(r.model_value).toFixed(1), lo: r.ref_low, hi: r.ref_high, src: String(r.ref_source).split(' ')[0], verdict: r.verdict })));
