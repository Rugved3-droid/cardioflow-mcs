/**
 * V4. One-at-a-time +/-20% sensitivity.
 *
 * For each parameter below, the shipped patient (or device constant) is scaled by 0.8
 * and 1.2, everything else held at its shipped value, and six configurations are run
 * with the shipped steady-state recipe: S0 (none), S1 (IABP 1:1), S2 (Impella P8),
 * S3 (VA-ECMO 4), S4 (VA-ECMO 4 + Impella P5), ECMO4+IABP.
 *
 * Note on SVR: with the baroreflex on (as shipped), `rSvr` is only the initial SVR;
 * steady-state SVR is set by the reflex. "SVR" is therefore perturbed as the reflex
 * effector range (svrMin and svrMax scaled together). The reflex setpoint is perturbed
 * separately. An open-loop structural variant (baroEnabled=false, SVR fixed at rSvr)
 * is also run.
 *
 * Usage: npx tsx paper/scripts/v4_sensitivity.ts <shard> <nShards>
 *        npx tsx paper/scripts/v4_sensitivity.ts aggregate
 * Output: paper/results/v4_runs_shard*.csv -> v4_runs.csv, v4_tornado.csv, v4_direction_flips.csv
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runScenario, SHOCK_PATIENT, knobDefaults, type Knobs, type PatientParams } from '../runner/core';
import { NAMED } from '../runner/scenarios';
import { RESULTS, writeCsv } from '../runner/io';

interface Pert { id: string; label: string; apply: (f: number) => { patient?: PatientParams; knobs?: Knobs } }
const P = SHOCK_PATIENT;
const pat = (patch: Partial<PatientParams>) => ({ patient: { ...P, ...patch } });
const K0 = knobDefaults();
const PERTS: Pert[] = [
  { id: 'lvEes', label: 'LV Ees (contractility)', apply: (f) => pat({ lvEes: P.lvEes * f }) },
  { id: 'lvV0', label: 'LV V0 (ESPVR intercept)', apply: (f) => pat({ lvV0: P.lvV0 * f }) },
  { id: 'lvB', label: 'EDPVR stiffness B', apply: (f) => pat({ lvB: P.lvB * f }) },
  { id: 'lvA', label: 'EDPVR scale A', apply: (f) => pat({ lvA: P.lvA * f }) },
  { id: 'lvV0ed', label: 'EDPVR intercept V0,ed', apply: (f) => pat({ lvV0ed: P.lvV0ed * f }) },
  { id: 'svrRange', label: 'SVR (reflex range svrMin, svrMax)', apply: (f) => pat({ svrMin: P.svrMin * f, svrMax: P.svrMax * f }) },
  { id: 'baroSetpoint', label: 'Baroreflex setpoint', apply: (f) => pat({ baroSetpoint: P.baroSetpoint * f }) },
  { id: 'cSa', label: 'Arterial compliance C_sa', apply: (f) => pat({ cSa: P.cSa * f }) },
  { id: 'vSv0', label: 'Stressed venous volume (initial V_sv)', apply: (f) => pat({ v0: { ...P.v0, sv: P.v0.sv * f } }) },
  { id: 'cSv', label: 'Venous compliance C_sv', apply: (f) => pat({ cSv: P.cSv * f }) },
  { id: 'hr', label: 'Heart rate', apply: (f) => pat({ hr: P.hr * f }) },
  { id: 'H_MAX', label: 'Impella shut-off head H_max', apply: (f) => ({ knobs: { H_MAX: K0.H_MAX * f } }) },
  { id: 'K', label: 'Impella H-Q slope K', apply: (f) => ({ knobs: { K: K0.K * f } }) },
  { id: 'DRAIN_FULL_MMHG', label: 'ECMO drainage full-flow pressure', apply: (f) => ({ knobs: { DRAIN_FULL_MMHG: K0.DRAIN_FULL_MMHG * f } }) },
  { id: 'BALLOON_VOLUME_ML', label: 'IABP balloon volume', apply: (f) => ({ knobs: { BALLOON_VOLUME_ML: K0.BALLOON_VOLUME_ML * f } }) },
];
const SCEN = ['S0_shock', 'S1_IABP', 'S2_ImpellaP8', 'S3_ECMO4', 'S4_ECMO4_P5', 'ECMO4_IABP'];
const OUT = ['map', 'totalFlowLpm', 'nativeSv', 'lvedp', 'lvedv', 'lvesv', 'avOpenFractionRaw', 'lapMean', 'pva', 'ef', 'svrWood'] as const;

interface Job { pert: string; label: string; factor: number; cfg: { patient?: PatientParams; knobs?: Knobs } }
function jobs(): Job[] {
  const j: Job[] = [{ pert: 'baseline', label: 'Shipped parameters', factor: 1, cfg: {} }];
  j.push({ pert: 'openLoop', label: 'Baroreflex off (structural)', factor: 1, cfg: pat({ baroEnabled: false }) });
  for (const p of PERTS) for (const f of [0.8, 1.2]) j.push({ pert: p.id, label: p.label, factor: f, cfg: p.apply(f) });
  return j;
}

function runShard(shard: number, n: number) {
  const rows: Record<string, unknown>[] = [];
  const all = jobs();
  const t0 = Date.now();
  for (let i = shard; i < all.length; i += n) {
    const jb = all[i];
    for (const s of SCEN) {
      const sim = runScenario(NAMED[s], { patient: jb.cfg.patient, knobs: jb.cfg.knobs, variant: true });
      const m = sim.lastBeat!;
      const row: Record<string, unknown> = { pert: jb.pert, label: jb.label, factor: jb.factor, scenario: s };
      for (const k of OUT) row[k] = m[k] as number;
      row.efNative = m.lvedv > 0 ? (100 * m.nativeSv) / m.lvedv : 0; // same definition as runner/core.ts efMetrics
      row.ecmoDrainageLimited = m.ecmoDrainageLimited ? 1 : 0;
      row.impellaSuction = m.impellaSuction ? 1 : 0;
      rows.push(row);
    }
    console.log(`shard ${shard}: ${jb.pert} x${jb.factor} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  writeCsv(`v4_runs_shard${shard}.csv`, rows);
}

function readCsv(p: string): Record<string, string>[] {
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
  const [h, ...lines] = readFileSync(p, 'utf8').trim().split(/\r?\n/);
  const cols = parse(h);
  return lines.map((l) => Object.fromEntries(parse(l).map((v, i) => [cols[i], v])));
}

const EPS: Record<string, number> = { map: 0.5, totalFlowLpm: 0.05, nativeSv: 0.5, lvedp: 0.5, lvedv: 1, lvesv: 1, avOpenFractionRaw: 0.005, lapMean: 0.5, pva: 50, ef: 0.5, efNative: 0.5, svrWood: 0.2 };
const COMPARISONS = [
  { id: 'C1_ECMO4_vs_none', from: 'S0_shock', to: 'S3_ECMO4' },
  { id: 'C2_ECMO4+IABP_vs_ECMO4', from: 'S3_ECMO4', to: 'ECMO4_IABP' },
  { id: 'C3_ECMO4+P5_vs_ECMO4', from: 'S3_ECMO4', to: 'S4_ECMO4_P5' },
  { id: 'C4_ImpellaP8_vs_none', from: 'S0_shock', to: 'S2_ImpellaP8' },
  { id: 'C5_IABP_vs_none', from: 'S0_shock', to: 'S1_IABP' },
];
const FLIP_OUT = ['map', 'totalFlowLpm', 'nativeSv', 'efNative', 'lvedp', 'lvedv', 'lvesv', 'avOpenFractionRaw', 'lapMean', 'pva'] as const;
const dirOf = (d: number, k: string) => (Math.abs(d) < EPS[k] ? 0 : Math.sign(d));

function aggregate() {
  const files = readdirSync(RESULTS).filter((f) => /^v4_runs_shard\d+\.csv$/.test(f));
  const rows = files.flatMap((f) => readCsv(join(RESULTS, f)));
  // efNative derived from stored columns with the runner/core.ts definition (identical for shards run before the column existed)
  for (const r of rows) r.efNative = String(Number(r.lvedv) > 0 ? (100 * Number(r.nativeSv)) / Number(r.lvedv) : 0);
  writeCsv('v4_runs.csv', rows);
  const get = (pert: string, factor: number, scen: string) => rows.find((r) => r.pert === pert && Number(r.factor) === factor && r.scenario === scen)!;
  const val = (r: Record<string, string>, k: string) => Number(r[k]);

  // tornado: outcomes = S0 MAP, S0 total CO, S0 LVEDP, S3 MAP, S3 LVEDP, ECMO-induced dLVEDP (S3-S0), ECpella dLVEDP (S4-S3)
  const TOR = [
    { id: 'S0_MAP', f: (p: string, x: number) => val(get(p, x, 'S0_shock'), 'map') },
    { id: 'S0_totalCO', f: (p: string, x: number) => val(get(p, x, 'S0_shock'), 'totalFlowLpm') },
    { id: 'S0_LVEDP', f: (p: string, x: number) => val(get(p, x, 'S0_shock'), 'lvedp') },
    { id: 'S3_MAP', f: (p: string, x: number) => val(get(p, x, 'S3_ECMO4'), 'map') },
    { id: 'S3_totalCO', f: (p: string, x: number) => val(get(p, x, 'S3_ECMO4'), 'totalFlowLpm') },
    { id: 'S3_LVEDP', f: (p: string, x: number) => val(get(p, x, 'S3_ECMO4'), 'lvedp') },
    { id: 'dLVEDP_ECMO4', f: (p: string, x: number) => val(get(p, x, 'S3_ECMO4'), 'lvedp') - val(get(p, x, 'S0_shock'), 'lvedp') },
    { id: 'dLVEDP_ECpella_vs_ECMO4', f: (p: string, x: number) => val(get(p, x, 'S4_ECMO4_P5'), 'lvedp') - val(get(p, x, 'S3_ECMO4'), 'lvedp') },
  ];
  const tor: Record<string, unknown>[] = [];
  for (const t of TOR) {
    const base = t.f('baseline', 1);
    for (const p of PERTS) {
      const lo = t.f(p.id, 0.8), hi = t.f(p.id, 1.2);
      tor.push({ outcome: t.id, pert: p.id, label: p.label, baseline: base, at_0p8: lo, at_1p2: hi, delta_0p8: lo - base, delta_1p2: hi - base, swing: Math.abs(hi - lo) });
    }
    const ol = t.f('openLoop', 1);
    tor.push({ outcome: t.id, pert: 'openLoop', label: 'Baroreflex off (structural)', baseline: base, at_0p8: '', at_1p2: ol, delta_0p8: '', delta_1p2: ol - base, swing: Math.abs(ol - base) });
  }
  writeCsv('v4_tornado.csv', tor);

  // direction flips across every perturbation
  const flips: Record<string, unknown>[] = [];
  const cases = [{ pert: 'openLoop', factor: 1 }, ...PERTS.flatMap((p) => [0.8, 1.2].map((f) => ({ pert: p.id, factor: f })))];
  for (const c of COMPARISONS)
    for (const k of FLIP_OUT) {
      const bd = val(get('baseline', 1, c.to), k) - val(get('baseline', 1, c.from), k);
      const bdir = dirOf(bd, k);
      const flipped: string[] = [];
      const toNone: string[] = [];
      for (const cs of cases) {
        const d = val(get(cs.pert, cs.factor, c.to), k) - val(get(cs.pert, cs.factor, c.from), k);
        const dd = dirOf(d, k);
        if (bdir !== 0 && dd === -bdir) flipped.push(`${cs.pert}x${cs.factor}(${d.toFixed(2)})`);
        else if (dd !== bdir) toNone.push(`${cs.pert}x${cs.factor}(${d.toFixed(2)})`);
      }
      flips.push({ comparison: c.id, outcome: k, baseline_change: bd, baseline_direction: bdir === 0 ? 'no change' : bdir > 0 ? 'up' : 'down',
        n_cases: cases.length, n_sign_flips: flipped.length, sign_flips: flipped.join('; '), n_moved_to_or_from_no_change: toNone.length, moved_to_or_from_no_change: toNone.join('; ') });
    }
  writeCsv('v4_direction_flips.csv', flips);
  console.log('aggregated', rows.length, 'rows');
}

const [a, b] = process.argv.slice(2);
if (a === 'aggregate') aggregate();
else runShard(Number(a ?? 0), Number(b ?? 1));
