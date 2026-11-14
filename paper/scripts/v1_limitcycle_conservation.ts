/**
 * V1b. Limit-cycle (steady-state) criterion, and V1c. volume conservation.
 *
 * Limit-cycle criterion (pre-specified here, before running):
 *   a beat is "steady" when, for each of MAP, total flow, native SV, LVEDP, LVEDV, LVESV,
 *   |x_n - x_{n-1}| <= 1e-3 * max(|x_n|, s)   (0.1% beat-to-beat; s = 10 mmHg, 10 mL, 1 L/min
 *   so near-zero outputs are judged absolutely), and the criterion is met at the first beat
 *   that begins a run of 10 consecutive steady beats.
 *   For IABP 1:2 the comparison is x_n vs x_{n-2} (the limit cycle has period 2 beats).
 *
 * Reported per scenario:
 *   - beats from a cold start (initial volumes v0, no device) to steady  [S0 only]
 *   - beats after the device command to steady (includes the actuator ramp)
 *   - beats available in the shipped recipe (120 s on device)
 *   - residual of the shipped recipe: |x(210 s) - x(510 s)| / max(|x(510 s)|, s), worst output
 *
 * Volume conservation: total blood volume (LV+RV+Ao+SA+SV+PA+PV) is recorded after every
 * 1 ms tick over the full 510 s run; max |V(t) - V(0)| is reported. The IABP balloon
 * displaces SA volume (it is not blood) and the ECMO circuit is a zero-volume flow source,
 * so both must conserve exactly up to floating-point round-off.
 *
 * Output: paper/results/v1_limitcycle.csv, v1_conservation.csv
 */
import { makeSim, BASELINE_MS, SUPPORT_MS, type BeatMetrics } from '../runner/core';
import { NAMED } from '../runner/scenarios';
import { writeCsv } from '../runner/io';

const KEYS = ['map', 'totalFlowLpm', 'nativeSv', 'lvedp', 'lvedv', 'lvesv'] as const;
const SCALE: Record<(typeof KEYS)[number], number> = { map: 10, totalFlowLpm: 1, nativeSv: 10, lvedp: 10, lvedv: 10, lvesv: 10 };
const TOL = 1e-3;
const RUN = 10;
const EXTRA_MS = 300_000;

function firstSteady(beats: BeatMetrics[], lag: number): number | null {
  let streak = 0;
  for (let i = lag; i < beats.length; i++) {
    const a = beats[i], b = beats[i - lag];
    const ok = KEYS.every((k) => Math.abs((a[k] as number) - (b[k] as number)) <= TOL * Math.max(Math.abs(a[k] as number), SCALE[k]));
    streak = ok ? streak + 1 : 0;
    if (streak === RUN) return i - RUN + 1;
  }
  return null;
}

const lc: Record<string, unknown>[] = [];
const cons: Record<string, unknown>[] = [];
for (const [name, set] of Object.entries(NAMED)) {
  const sim = makeSim();
  const v0 = sim.totalVolume();
  let maxDev = 0, ticks = 0;
  const pre: BeatMetrics[] = [];
  const post: BeatMetrics[] = [];
  let phase: 'pre' | 'post' = 'pre';
  sim.onBeat = (m) => (phase === 'pre' ? pre : post).push(m);
  const step = (ms: number) => {
    for (let i = 0; i < ms; i++) {
      sim.tick();
      ticks++;
      const d = Math.abs(sim.totalVolume() - v0);
      if (d > maxDev) maxDev = d;
    }
  };
  step(BASELINE_MS);
  sim.setSettings(set);
  phase = 'post';
  step(SUPPORT_MS);
  const atRecipe = sim.lastBeat!;
  step(EXTRA_MS);
  const late = sim.lastBeat!;
  const lag = set.iabpOn && set.iabpRatio === 2 ? 2 : 1;
  let resid = 0, residKey = '';
  for (const k of KEYS) {
    const r = Math.abs((atRecipe[k] as number) - (late[k] as number)) / Math.max(Math.abs(late[k] as number), SCALE[k]);
    if (r > resid) { resid = r; residKey = k; }
  }
  // for period-2 cycles the beat at the recipe end and at +300 s may be different phases
  const sameParity = lag === 1 || (post.length - 1) % 2 === (post.length - 1 - EXTRA_MS / sim.cycleMs) % 2;
  lc.push({
    scenario: name,
    cycle_ms: sim.cycleMs,
    comparison_lag_beats: lag,
    beats_cold_start_to_steady_unsupported: firstSteady(pre, 1),
    beats_unsupported_phase: pre.length,
    beats_after_command_to_steady: firstSteady(post, lag),
    seconds_after_command_to_steady: (() => { const b = firstSteady(post, lag); return b === null ? null : (b * sim.cycleMs) / 1000; })(),
    beats_in_shipped_recipe_support_phase: SUPPORT_MS / sim.cycleMs,
    recipe_residual_worst_rel: resid,
    recipe_residual_worst_output: residKey,
    residual_same_beat_parity: sameParity,
  });
  cons.push({
    scenario: name,
    ticks,
    total_volume_mL: v0,
    max_abs_deviation_mL: maxDev,
    max_rel_deviation: maxDev / v0,
  });
  console.log(name, lc[lc.length - 1], cons[cons.length - 1]);
}
writeCsv('v1_limitcycle.csv', lc);
writeCsv('v1_conservation.csv', cons);
