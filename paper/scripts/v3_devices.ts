/**
 * V3. Device hemodynamics, model side.
 *
 * Runs the shipped model as it ships (no parameter changes) through:
 *   (a) VA-ECMO flow sweep 0 -> 7 L/min in 0.5 L/min steps
 *   (b) VA-ECMO at 1..5 L/min x unloading {none, IABP 1:1, Impella P2, P4, P5, P6, P8}
 *       (LV venting is NOT implemented in the code; it is not run)
 *   (c) Impella alone P1..P9
 *   (d) IABP alone 1:1 and 1:2
 * Each run is the shipped steady-state recipe (90 s unsupported, 120 s on device) and
 * reports the last beat. PV loops (1 ms resolution, one beat) are recorded for the
 * named scenarios in PV_SET.
 *
 * Then derives model directions and % change for pre-defined comparisons. The
 * benchmark-direction columns are NOT filled here: they come only from
 * paper/benchmarks/*.csv, extracted from the supplied PDFs (see v3_concordance.ts).
 *
 * Output: paper/results/v3_runs.csv, v3_pv_loops.csv, v3_model_directions.csv
 */
import { runScenario, recordBeat, settingsOf, type DeviceSettings, pick, OUTPUTS } from '../runner/core';
import { writeCsv } from '../runner/io';

interface Run { id: string; family: string; ecmo: number; unload: string; settings: DeviceSettings }
const runs: Run[] = [];
const fmt = (x: number) => x.toFixed(1);

for (let f = 0; f <= 7.0001; f += 0.5) runs.push({ id: `ECMO_${fmt(f)}`, family: 'ecmo_sweep', ecmo: f, unload: 'none', settings: settingsOf({ ecmoFlowLpm: f }) });
const UNLOAD: Record<string, Partial<DeviceSettings>> = {
  IABP: { iabpOn: true },
  P2: { impellaLevel: 2 },
  P4: { impellaLevel: 4 },
  P5: { impellaLevel: 5 },
  P6: { impellaLevel: 6 },
  P8: { impellaLevel: 8 },
};
for (const f of [1, 2, 3, 4, 5])
  for (const [u, s] of Object.entries(UNLOAD))
    runs.push({ id: `ECMO_${fmt(f)}+${u}`, family: 'ecmo_plus_unloading', ecmo: f, unload: u, settings: settingsOf({ ecmoFlowLpm: f, ...s }) });
for (let l = 1; l <= 9; l++) runs.push({ id: `Impella_P${l}`, family: 'impella_alone', ecmo: 0, unload: `P${l}`, settings: settingsOf({ impellaLevel: l }) });
runs.push({ id: 'IABP_1to1', family: 'iabp_alone', ecmo: 0, unload: 'IABP', settings: settingsOf({ iabpOn: true }) });
runs.push({ id: 'IABP_1to2', family: 'iabp_alone', ecmo: 0, unload: 'IABP_1to2', settings: settingsOf({ iabpOn: true, iabpRatio: 2 }) });

const PV_SET = new Set(['ECMO_0.0', 'ECMO_2.0', 'ECMO_4.0', 'ECMO_6.0', 'ECMO_4.0+IABP', 'ECMO_4.0+P5', 'ECMO_4.0+P8', 'Impella_P8', 'IABP_1to1']);

const rows: Record<string, unknown>[] = [];
const pv: Record<string, unknown>[] = [];
const byId: Record<string, Record<string, number>> = {};
const t0 = Date.now();
for (const r of runs) {
  const sim = runScenario(r.settings);
  const m = sim.lastBeat!;
  const o = { ...pick(m), avOpened: m.avOpened ? 1 : 0, impellaSuction: m.impellaSuction ? 1 : 0, ecmoDrainageLimited: m.ecmoDrainageLimited ? 1 : 0, lvesp: m.lvesp, lvPeakP: m.lvPeakP };
  byId[r.id] = o as Record<string, number>;
  rows.push({ id: r.id, family: r.family, ecmo_cmd_lpm: r.ecmo, unloading: r.unload, ...o });
  if (PV_SET.has(r.id)) for (const s of recordBeat(sim)) pv.push({ id: r.id, ...s });
  console.log(r.id, ((Date.now() - t0) / 1000).toFixed(0) + 's', `MAP ${o.map.toFixed(1)} LVEDP ${o.lvedp.toFixed(1)} SV ${o.nativeSv.toFixed(1)}`);
}
writeCsv('v3_runs.csv', rows);
writeCsv('v3_pv_loops.csv', pv);

/* ---------- model directions for pre-defined comparisons ---------- */
const COMPARE_OUT = ['map', 'totalFlowLpm', 'nativeSv', 'nativeCoLpm', 'lvedp', 'lvedv', 'lvesv', 'efNative', 'efEmptying', 'avOpenFractionRaw', 'lapMean', 'pva', 'strokeWork', 'pulsePressure', 'dpti', 'svrWood'] as const;
const COMPARISONS: { id: string; question: string; from: string; to: string }[] = [
  { id: 'C1_ECMO4_vs_none', question: 'VA-ECMO 4 L/min vs no support', from: 'ECMO_0.0', to: 'ECMO_4.0' },
  { id: 'C1b_ECMO2_vs_none', question: 'VA-ECMO 2 L/min vs no support', from: 'ECMO_0.0', to: 'ECMO_2.0' },
  { id: 'C1c_ECMO6_vs_none', question: 'VA-ECMO 6 L/min vs no support', from: 'ECMO_0.0', to: 'ECMO_6.0' },
  { id: 'C2_ECMO4+IABP_vs_ECMO4', question: 'adding IABP to VA-ECMO 4', from: 'ECMO_4.0', to: 'ECMO_4.0+IABP' },
  { id: 'C3_ECMO4+P5_vs_ECMO4', question: 'adding Impella P5 to VA-ECMO 4 (ECpella, S4 vs S3)', from: 'ECMO_4.0', to: 'ECMO_4.0+P5' },
  { id: 'C3b_ECMO4+P8_vs_ECMO4', question: 'adding Impella P8 to VA-ECMO 4', from: 'ECMO_4.0', to: 'ECMO_4.0+P8' },
  { id: 'C4_ImpellaP8_vs_none', question: 'Impella P8 alone vs no support', from: 'ECMO_0.0', to: 'Impella_P8' },
  { id: 'C4b_ImpellaP4_vs_none', question: 'Impella P4 alone vs no support', from: 'ECMO_0.0', to: 'Impella_P4' },
  { id: 'C5_IABP_vs_none', question: 'IABP 1:1 alone vs no support', from: 'ECMO_0.0', to: 'IABP_1to1' },
];
const EPS: Record<string, number> = { map: 0.5, totalFlowLpm: 0.05, nativeSv: 0.5, lvedp: 0.5, lvedv: 1, lvesv: 1, efNative: 0.5, efEmptying: 0.5, nativeCoLpm: 0.05, avOpenFractionRaw: 0.005, lapMean: 0.5, pva: 50, strokeWork: 50, pulsePressure: 0.5, dpti: 0.1, svrWood: 0.2 };
const dir: Record<string, unknown>[] = [];
for (const c of COMPARISONS)
  for (const k of COMPARE_OUT) {
    const a = byId[c.from][k], b = byId[c.to][k];
    const d = b - a;
    dir.push({
      comparison: c.id, question: c.question, outcome: k, from: c.from, to: c.to,
      value_from: a, value_to: b, abs_change: d,
      pct_change: Math.abs(a) > 1e-9 ? (100 * d) / Math.abs(a) : '',
      model_direction: Math.abs(d) < EPS[k] ? 'no change' : d > 0 ? 'up' : 'down',
      no_change_band: EPS[k],
    });
  }
// sweep monotonicity
for (const k of COMPARE_OUT) {
  const sw = runs.filter((r) => r.family === 'ecmo_sweep').map((r) => byId[r.id][k]);
  const ds = sw.slice(1).map((v, i) => v - sw[i]);
  dir.push({ comparison: 'C1_sweep_monotonicity', question: 'VA-ECMO 0->7 L/min sweep', outcome: k, from: 'ECMO_0.0', to: 'ECMO_7.0',
    value_from: sw[0], value_to: sw[sw.length - 1], abs_change: sw[sw.length - 1] - sw[0], pct_change: Math.abs(sw[0]) > 1e-9 ? (100 * (sw[sw.length - 1] - sw[0])) / Math.abs(sw[0]) : '',
    model_direction: ds.every((d) => d > 0) ? 'strictly up' : ds.every((d) => d < 0) ? 'strictly down' : 'non-monotone', no_change_band: '' });
}
writeCsv('v3_model_directions.csv', dir);
console.log('done', (Date.now() - t0) / 1000, 's');
void OUTPUTS;
