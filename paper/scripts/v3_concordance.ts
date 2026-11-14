/**
 * V3 concordance: joins benchmark directions (paper/benchmarks/device_benchmarks.csv,
 * extracted from the supplied PDFs) with model directions (paper/results/v3_model_directions.csv).
 *
 * Rows with read_quality UNCLEAR are listed but excluded from the concordance count.
 * Rows from sources that were used to calibrate the model (calibration_overlap = yes) are
 * counted separately and never pooled into the independent concordance figure.
 *
 * Output: paper/results/v3_concordance.csv, v3_concordance_summary.json
 * If the benchmark CSV is absent, writes a PENDING summary and exits 0.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RESULTS, writeCsv, writeJson } from '../runner/io';

function readCsv(p: string): Record<string, string>[] {
  const lines = readFileSync(p, 'utf8').trim().split(/\r?\n/);
  const parse = (l: string) => {
    const out: string[] = [];
    let cur = '', q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur);
    return out;
  };
  const cols = parse(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(parse(l).map((v, i) => [cols[i], v])));
}

const benchPath = join(import.meta.dirname, '..', 'benchmarks', 'device_benchmarks.csv');
if (!existsSync(benchPath)) {
  writeJson('v3_concordance_summary.json', { status: 'PENDING', reason: 'paper/benchmarks/device_benchmarks.csv not present (benchmark PDFs not yet supplied)' });
  console.log('PENDING: no benchmark CSV');
  process.exit(0);
}
const bench = readCsv(benchPath);
const model = readCsv(join(RESULTS, 'v3_model_directions.csv'));
const norm = (d: string) => (/^(strictly )?up|increase|rise|higher/i.test(d) ? 'up' : /^(strictly )?down|decrease|fall|lower/i.test(d) ? 'down' : /no change|unchanged|ns/i.test(d) ? 'no change' : d);
const rows = bench.map((b) => {
  const m = model.find((x) => x.comparison === b.comparison_id && x.outcome === b.outcome);
  const md = m ? norm(m.model_direction) : 'NOT RUN';
  const bd = norm(b.reported_direction);
  const usable = b.read_quality !== 'UNCLEAR' && !!m;
  return {
    ...b,
    model_direction: md,
    model_pct_change: m?.pct_change ?? '',
    model_value_from: m?.value_from ?? '',
    model_value_to: m?.value_to ?? '',
    concordant: usable ? (md === bd ? 'yes' : 'no') : 'excluded',
  };
});
writeCsv('v3_concordance.csv', rows);
const count = (filter: (r: (typeof rows)[number]) => boolean) => {
  const u = rows.filter((r) => r.concordant !== 'excluded' && filter(r));
  return { concordant: u.filter((r) => r.concordant === 'yes').length, total: u.length };
};
writeJson('v3_concordance_summary.json', {
  script: 'paper/scripts/v3_concordance.ts',
  independent: count((r) => r.calibration_overlap !== 'yes'),
  calibration_sources_only: count((r) => r.calibration_overlap === 'yes'),
  excluded_unclear_or_not_run: rows.filter((r) => r.concordant === 'excluded').length,
});
