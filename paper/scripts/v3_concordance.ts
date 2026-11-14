/**
 * V3 concordance against the downloaded benchmarks.
 *
 * Reads paper/benchmarks/device_benchmarks.csv (written by build_benchmarks.py from the
 * downloaded full texts), runs every model arm it names on the shipped patient (baroreflex ON,
 * primary) and with the reflex OFF (secondary; Donker's model has no reflexes), and classifies each
 * comparison.
 *
 * Rules (fixed before looking at the results):
 *  - delta mode: model change = arm1 - arm2 (e.g. E4 minus none). Model direction is 'flat' if
 *    |relative change| < 1 %. A benchmark 'flat' is concordant if |model change| < 1 unit (mmHg).
 *  - rank modes: model value = change(pair 1) - change(pair 2), absolute (rank_abs) or in %
 *    (rank_pct); direction 'down' if < 0.
 *  - Concordant = model direction equals benchmark direction. Magnitude is reported, not scored:
 *    relative magnitude = model % change / benchmark % change (delta) or model diff / benchmark
 *    diff (rank). Where the source states a bound, `within_bound` reports it separately.
 *  - Animal data: direction and % only; absolute values are never compared across species.
 *  - Counts are reported separately for class = consistency (Donker, Donker review, Broome,
 *    Ostadal: calibration anchors or the source model) and class = independent (Hala, Nix,
 *    Moller-Helgestad). They are never pooled.
 *
 * Output: paper/results/v3_concordance.csv, v3_concordance_summary.json, v3_arms.csv
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runScenario, settingsOf, SHOCK_PATIENT, efMetrics, type BeatMetrics } from '../runner/core';
import { writeCsv, writeJson } from '../runner/io';

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

const bench = readCsv(join(import.meta.dirname, '..', 'benchmarks', 'device_benchmarks.csv'));

function settingsForArm(arm: string) {
  if (arm === 'none') return settingsOf({});
  const s: Record<string, unknown> = {};
  for (const part of arm.split('+')) {
    if (part === 'IABP') s.iabpOn = true;
    else if (part.startsWith('E')) s.ecmoFlowLpm = Number(part.slice(1));
    else if (part.startsWith('P')) s.impellaLevel = Number(part.slice(1));
    else throw new Error(`bad arm ${arm}`);
  }
  return settingsOf(s);
}

type Metrics = Record<string, number>;
function runArm(arm: string, reflex: boolean): Metrics {
  let cur = -Infinity, lastPeak = NaN;
  const sim = runScenario(settingsForArm(arm), {
    patient: { ...SHOCK_PATIENT, baroEnabled: reflex },
    onTick: (s) => {
      if (s.state.tickInBeat === 0) { lastPeak = cur; cur = -Infinity; }
      cur = Math.max(cur, s.last.pLv);
    },
  });
  const m: BeatMetrics = sim.lastBeat!;
  return {
    map: m.map, sbp: m.sbp, lapMean: m.lapMean, lvedp: m.lvedp, lvedv: m.lvedv, lvesv: m.lvesv,
    nativeSv: m.nativeSv, emptyingSv: (m.lvedv * m.ef) / 100, efEmptying: m.ef, efNative: efMetrics(m).efNative,
    pva: m.pva, strokeWork: m.strokeWork, nativeCoLpm: m.nativeCoLpm, rapMean: m.rapMean, paMean: m.paMean,
    lvPeak: lastPeak, impellaLpm: m.impellaLpm, ecmoLpm: m.ecmoLpm, avOpen: m.avOpenFractionRaw,
  };
}

const arms = new Set<string>();
for (const b of bench) for (const pair of b.model_contrast.split('|')) for (const a of pair.split('>')) arms.add(a);
const results: Record<'on' | 'off', Record<string, Metrics>> = { on: {}, off: {} };
const armRows: Record<string, unknown>[] = [];
for (const reflex of ['on', 'off'] as const) {
  for (const a of [...arms].sort()) {
    results[reflex][a] = runArm(a, reflex === 'on');
    armRows.push({ arm: a, reflex, ...results[reflex][a] });
  }
}
writeCsv('v3_arms.csv', armRows);

const dirOf = (x: number, pct: number) => (Math.abs(pct) < 1 ? 'flat' : x > 0 ? 'up' : 'down');
const out: Record<string, unknown>[] = [];
for (const reflex of ['on', 'off'] as const) {
  const R = results[reflex];
  for (const b of bench) {
    const k = b.model_metric;
    const change = (pair: string) => {
      const [a1, a2] = pair.split('>');
      const v1 = R[a1][k], v2 = R[a2][k];
      return { v1, v2, d: v1 - v2, pct: v2 !== 0 ? 100 * (v1 / v2 - 1) : NaN };
    };
    const common = { reflex, comp_id: b.comp_id, class: b.class, source_key: b.source_key, species: b.species, outcome: b.outcome,
      benchmark_contrast: b.benchmark_contrast, model_contrast: b.model_contrast, model_metric: k, units: b.units,
      bench_base: b.bench_base, bench_int: b.bench_int, bench_delta: b.bench_delta, bench_direction: b.bench_direction, significant: b.significant };
    if (b.mode === 'delta') {
      const c = change(b.model_contrast);
      let modelDir = dirOf(c.d, c.pct);
      if (b.bench_direction === 'flat') modelDir = Math.abs(c.d) < 1 ? 'flat' : c.d > 0 ? 'up' : 'down';
      let within = '';
      if (b.bound_low !== '') {
        const x = b.units === '%' ? c.pct : c.d;
        within = x >= Number(b.bound_low) && x <= Number(b.bound_high) ? 'Y' : 'N';
      }
      out.push({ ...common, bench_pct: b.bench_pct, model_from: c.v2, model_to: c.v1, model_delta: c.d, model_pct: c.pct, model_direction: modelDir,
        concordant: modelDir === b.bench_direction ? 'Y' : 'N', relative_magnitude: b.bench_pct !== '' ? c.pct / Number(b.bench_pct) : '',
        within_bound: within, location: b.location, note: b.note });
    } else {
      const [p1, p2] = b.model_contrast.split('|');
      const c1 = change(p1), c2 = change(p2);
      const pctMode = b.mode === 'rank_pct';
      const v = pctMode ? c1.pct - c2.pct : c1.d - c2.d;
      const modelDir = Math.abs(v) < 1e-9 ? 'flat' : v > 0 ? 'up' : 'down';
      const bd = Number(b.bench_delta);
      out.push({ ...common, bench_pct: '', model_from: pctMode ? c2.pct : c2.d, model_to: pctMode ? c1.pct : c1.d, model_delta: v, model_pct: '',
        model_direction: modelDir, concordant: modelDir === b.bench_direction ? 'Y' : 'N',
        relative_magnitude: Number.isFinite(bd) && bd !== 0 ? v / bd : '', within_bound: '', location: b.location, note: b.note });
    }
  }
}
writeCsv('v3_concordance.csv', out);

const count = (f: (r: Record<string, unknown>) => boolean) => {
  const u = out.filter(f);
  return { concordant: u.filter((r) => r.concordant === 'Y').length, total: u.length };
};
const summary: Record<string, unknown> = { script: 'paper/scripts/v3_concordance.ts', benchmark_rows: bench.length };
for (const reflex of ['on', 'off']) {
  summary[`reflex_${reflex}`] = {
    consistency: count((r) => r.reflex === reflex && r.class === 'consistency'),
    independent: count((r) => r.reflex === reflex && r.class === 'independent'),
    independent_significant_only: count((r) => r.reflex === reflex && r.class === 'independent' && r.significant === 'Y'),
    by_source: Object.fromEntries([...new Set(bench.map((b) => b.source_key))].map((s) => [s, count((r) => r.reflex === reflex && r.source_key === s)])),
    discordant: out.filter((r) => r.reflex === reflex && r.concordant === 'N')
      .map((r) => `${r.comp_id}: bench ${r.bench_direction}, model ${r.model_direction} (${Number(r.model_delta).toFixed(2)} ${r.units})`),
    bounds_violated: out.filter((r) => r.reflex === reflex && r.within_bound === 'N')
      .map((r) => `${r.comp_id}: model ${Number(r.units === '%' ? r.model_pct : r.model_delta).toFixed(2)} ${r.units}`),
  };
}
writeJson('v3_concordance_summary.json', summary);
console.log(JSON.stringify(summary, null, 1));
