/**
 * Mismatch 2 diagnosis: IABP vs Impella on top of VA-ECMO 4 L/min.
 *
 * For ECMO 4 alone, ECMO 4 + IABP 1:1 and ECMO 4 + Impella P1..P9, reports the beat-mean
 * Impella flow actually achieved, the pressure head the pump works against, and the LV
 * loading outcomes. Each arm runs with the baroreflex ON (shipped) and OFF (open loop, SVR
 * fixed at rSvr), because Donker 2019 has no reflexes (SDC Appendix).
 * Also reports, without ECMO, the shipped IABP's diastolic augmentation and systolic
 * unloading (S1 vs S0, from the same beat metrics).
 *
 * Output: paper/results/m2_impella_vs_iabp.csv, paper/results/m2_iabp_alone.csv
 */
import { runScenario, settingsOf, SHOCK_PATIENT, efMetrics, type BeatMetrics } from '../runner/core';
import { writeCsv } from '../runner/io';

const row = (arm: string, reflex: string, m: BeatMetrics, ref?: BeatMetrics) => ({
  arm, reflex,
  impella_Lpm: m.impellaLpm, ecmo_Lpm: m.ecmoLpm, total_Lpm: m.totalFlowLpm,
  map: m.map, sbp: m.sbp, dbp: m.dbp, aorticEdp: m.aorticEdp, peakDiastolicP: m.peakDiastolicP,
  lvedp: m.lvedp, lvedv: m.lvedv, lvesv: m.lvesv, nativeSv: m.nativeSv,
  lvEmptyingSv: m.lvedv * m.ef / 100, efNative: efMetrics(m).efNative,
  avOpen: m.avOpenFractionRaw, lapMean: m.lapMean, svrWood: m.svrWood, pva: m.pva,
  d_lvedp: ref ? m.lvedp - ref.lvedp : '', d_lvedv_pct: ref ? 100 * (m.lvedv / ref.lvedv - 1) : '',
  d_lap: ref ? m.lapMean - ref.lapMean : '', d_nativeSv_pct: ref && ref.nativeSv > 0 ? 100 * (m.nativeSv / ref.nativeSv - 1) : '',
});

const rows: Record<string, unknown>[] = [];
for (const reflex of ['on', 'off'] as const) {
  const patient = { ...SHOCK_PATIENT, baroEnabled: reflex === 'on' };
  const run = (s: Partial<Parameters<typeof settingsOf>[0]>) => runScenario(settingsOf(s), { patient }).lastBeat!;
  const ecmo = run({ ecmoFlowLpm: 4 });
  rows.push(row('ECMO4', reflex, ecmo, ecmo));
  rows.push(row('ECMO4+IABP', reflex, run({ ecmoFlowLpm: 4, iabpOn: true }), ecmo));
  for (let L = 1; L <= 9; L++) rows.push(row(`ECMO4+P${L}`, reflex, run({ ecmoFlowLpm: 4, impellaLevel: L }), ecmo));
  const s0 = run({});
  rows.push(row('none', reflex, s0, s0));
  rows.push(row('IABP', reflex, run({ iabpOn: true }), s0));
  for (const L of [2, 5, 8]) rows.push(row(`P${L}`, reflex, run({ impellaLevel: L }), s0));
}
writeCsv('m2_impella_vs_iabp.csv', rows);
console.table(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(2) : v]))).map(({ arm, reflex, impella_Lpm, map, dbp, aorticEdp, lvedp, lvedv, nativeSv, lvEmptyingSv, avOpen, d_lvedp, d_lvedv_pct, d_lap }) => ({ arm, reflex, impella_Lpm, map, dbp, aorticEdp, lvedp, lvedv, nativeSv, lvEmptyingSv, avOpen, d_lvedp, d_lvedv_pct, d_lap })));

// Part B: IABP balloon-volume dependence on ECMO 4 (knob variant; NOT a recalibration).
// 30 mL is the displacement Donker 2019 used (SDC Appendix, "Simulation of Intra-Aortic Balloon Pump").
const rowsB: Record<string, unknown>[] = [];
for (const reflex of ['on', 'off'] as const) {
  const patient = { ...SHOCK_PATIENT, baroEnabled: reflex === 'on' };
  const ecmo = runScenario(settingsOf({ ecmoFlowLpm: 4 }), { patient, variant: true, knobs: {} }).lastBeat!;
  for (const v of [20, 30, 40]) {
    const m = runScenario(settingsOf({ ecmoFlowLpm: 4, iabpOn: true }), { patient, knobs: { BALLOON_VOLUME_ML: v } }).lastBeat!;
    rowsB.push({ ...row(`ECMO4+IABP_${v}mL`, reflex, m, ecmo), balloon_mL: v });
  }
}
writeCsv('m2_iabp_balloon_volume.csv', rowsB);
console.table(rowsB.map((r: any) => ({ arm: r.arm, reflex: r.reflex, d_lvedp: +r.d_lvedp.toFixed(2), d_lvedv_pct: +r.d_lvedv_pct.toFixed(2), d_lap: +r.d_lap.toFixed(2), d_nativeSv_pct: +r.d_nativeSv_pct.toFixed(1) })));
