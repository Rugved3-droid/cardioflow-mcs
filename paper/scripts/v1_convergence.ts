/**
 * V1a. Time-step convergence.
 *
 * The shipped model integrates with classical RK4 at h = TICK_MS/SUBSTEPS = 0.25 ms.
 * SUBSTEPS is swept 1,2,4,8,16,32,64 (h = 1 ms ... 0.0156 ms) with the knob variant
 * (bit-identical to the shipped model at SUBSTEPS=4, see p0_equivalence). Each run is
 * the full shipped steady-state recipe (90 s unsupported + 120 s on device) from cold.
 *
 * What is NOT refined: the 1 ms clock tick, which also sets (i) the sampling of
 * per-beat extrema (LVEDP is sampled at activation onset, LVESV at max P/(V-V0)),
 * (ii) the forward-Euler update of the two baroreflex lags (tau 2 s and 8 s), and
 * (iii) actuator slew. These are part of the model definition, not of the ODE solve.
 *
 * Criterion: every output changes by < 0.5% when h is halved.
 * Relative change uses a floor so near-zero outputs (native SV on Impella P8) are
 * judged on an absolute scale: |a-b| / max(|b|, floor).
 *
 * Usage: npx tsx paper/scripts/v1_convergence.ts
 * Output: paper/results/v1_convergence.csv, v1_convergence_summary.csv
 */
import { runScenario } from '../runner/core';
import { NAMED } from '../runner/scenarios';
import { writeCsv } from '../runner/io';

const SUBSTEPS = [1, 2, 4, 8, 16, 32, 64];
const OUT = ['map', 'totalFlowLpm', 'nativeCoLpm', 'lvedp', 'lvedv', 'lvesv', 'nativeSv'] as const;
/** floors for the relative change, in output units */
const FLOOR: Record<(typeof OUT)[number], number> = { map: 1, totalFlowLpm: 0.1, nativeCoLpm: 0.1, lvedp: 1, lvedv: 1, lvesv: 1, nativeSv: 1 };
const SCEN = ['S0_shock', 'S1_IABP', 'S2_ImpellaP8', 'S3_ECMO4', 'S4_ECMO4_P5', 'S5_ECMO2_P8', 'ECMO4_IABP'];

const rows: Record<string, unknown>[] = [];
const summary: Record<string, unknown>[] = [];
const t0 = Date.now();
for (const name of SCEN) {
  const res: Record<number, Record<string, number>> = {};
  for (const n of SUBSTEPS) {
    const sim = runScenario(NAMED[name], { knobs: { SUBSTEPS: n } });
    const m = sim.lastBeat!;
    res[n] = Object.fromEntries(OUT.map((k) => [k, m[k] as number]));
    console.log(name, n, ((Date.now() - t0) / 1000).toFixed(0) + 's', res[n].lvedp);
  }
  const ref = res[SUBSTEPS[SUBSTEPS.length - 1]];
  let worstShippedHalving = 0;
  let worstShippedVsRef = 0;
  for (let i = 0; i < SUBSTEPS.length; i++) {
    const n = SUBSTEPS[i];
    const next = SUBSTEPS[i + 1];
    const row: Record<string, unknown> = { scenario: name, substeps: n, h_ms: 1 / n };
    let maxHalving = 0, maxRef = 0;
    for (const k of OUT) {
      row[k] = res[n][k];
      const dRef = Math.abs(res[n][k] - ref[k]) / Math.max(Math.abs(ref[k]), FLOOR[k]);
      row[`${k}_relchg_vs_finest`] = dRef;
      maxRef = Math.max(maxRef, dRef);
      if (next !== undefined) {
        const d = Math.abs(res[n][k] - res[next][k]) / Math.max(Math.abs(res[next][k]), FLOOR[k]);
        row[`${k}_relchg_on_halving`] = d;
        maxHalving = Math.max(maxHalving, d);
      }
    }
    row.max_relchg_on_halving = next !== undefined ? maxHalving : '';
    row.max_relchg_vs_finest = maxRef;
    rows.push(row);
    if (n === 4) {
      worstShippedHalving = maxHalving;
      worstShippedVsRef = maxRef;
    }
  }
  // coarsest h meeting the 0.5% halving criterion from there down
  let coarsestOk: number | null = null;
  for (let i = SUBSTEPS.length - 2; i >= 0; i--) {
    const r = rows.find((x) => x.scenario === name && x.substeps === SUBSTEPS[i])!;
    if ((r.max_relchg_on_halving as number) < 0.005) coarsestOk = SUBSTEPS[i];
    else break;
  }
  summary.push({
    scenario: name,
    shipped_substeps: 4,
    shipped_h_ms: 0.25,
    shipped_max_relchg_on_halving: worstShippedHalving,
    shipped_max_relchg_vs_finest: worstShippedVsRef,
    shipped_passes_0p5pct: worstShippedHalving < 0.005,
    coarsest_substeps_meeting_criterion: coarsestOk ?? 'none',
  });
}
writeCsv('v1_convergence.csv', rows);
writeCsv('v1_convergence_summary.csv', summary);
console.table(summary);
