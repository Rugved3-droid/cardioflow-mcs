/**
 * V5. Twin-pane integrity, using the app's own runtime (src/runtime/TwinEngine.ts).
 *
 *  T1  identical inputs: both panes loaded from the same shipped snapshot, stepped in
 *      lockstep for 1000 beats; every tick's full Sample and every beat's BeatMetrics
 *      compared. Done for S0, S3 and S4 (criterion: max |diff| <= 1e-9; bitwise reported).
 *  T2  one change in one pane: both panes loaded at S0, 5 beats run, then the right pane
 *      alone receives a single device change via the app path (applyRight); 1000 beats.
 *      The left pane is compared tick-by-tick against an independent single Sim run
 *      from the same snapshot for the same number of ticks (it must be bit-identical,
 *      i.e. unaffected by its neighbour). Done for 4 single-variable changes.
 *  T3  fork path (the app's "split reality"): engine.fork(); the continuing pane is
 *      compared with a reference copy cloned at the fork instant.
 *  T4  patient-parameter independence: the app exposes only DeviceSettings per pane
 *      (both panes share the read-only SHOCK_PATIENT object; nothing in src writes to a
 *      PatientParams field). For completeness, two Sims with separate patient objects
 *      differing in Ees are stepped together; the unchanged one is compared with a solo run.
 *
 * Output: paper/results/v5_twin.csv
 */
import { TwinEngine } from '../../src/runtime/TwinEngine';
import { Sim } from '../../src/model/sim';
import { SHOCK_PATIENT } from '../../src/model/patient';
import shipped from '../../src/model/steadyStates.json';
import type { BeatMetrics, Sample } from '../../src/model/types';
import { writeCsv } from '../runner/io';

const BEATS = 1000;
type Snap = Parameters<typeof Sim.fromSnapshot>[1];
const SN = shipped as unknown as Record<string, Snap>;

function diffObj(a: Sample | BeatMetrics, b: Sample | BeatMetrics): { max: number; bit: boolean } {
  let max = 0, bit = true;
  for (const k of Object.keys(a) as (keyof typeof a)[]) {
    const x = a[k] as unknown, y = (b as any)[k] as unknown;
    if (typeof x === 'number' && typeof y === 'number') {
      if (!Object.is(x, y)) bit = false;
      const d = Math.abs(x - y);
      if (d > max || Number.isNaN(d)) max = Number.isNaN(d) ? Infinity : d;
    } else if (x !== y) { bit = false; max = Infinity; }
  }
  return { max, bit };
}

class Tracker {
  max = 0; bit = true; ticks = 0; beats = 0;
  add(r: { max: number; bit: boolean }) { this.max = Math.max(this.max, r.max); this.bit &&= r.bit; }
}

const rows: Record<string, unknown>[] = [];

/* T1 */
for (const key of ['S0', 'S3', 'S4'] as const) {
  const e = new TwinEngine(key);
  e.autoCompress = false;
  e.load(key, key);
  const tr = new Tracker();
  const n = BEATS * e.left.sim.cycleMs;
  for (let i = 0; i < n; i++) {
    e.stepTicks(1);
    tr.ticks++;
    tr.add(diffObj(e.left.sim.last, e.right.sim.last));
    if (e.left.sim.state.tickInBeat === 0) { tr.beats++; tr.add(diffObj(e.left.sim.lastBeat!, e.right.sim.lastBeat!)); }
  }
  const vs = JSON.stringify(e.left.sim.state) === JSON.stringify(e.right.sim.state);
  rows.push({ test: 'T1_identical_inputs', case: `${key} | ${key}`, ticks: tr.ticks, beats: tr.beats, max_abs_diff: tr.max, bit_identical: tr.bit && vs, pass_1e9: tr.max <= 1e-9 });
  console.log(rows[rows.length - 1]);
}

/* T2 */
const CHANGES: [string, Parameters<TwinEngine['applyRight']>[0]][] = [
  ['ECMO 0->4 L/min', { ecmoFlowLpm: 4 }],
  ['Impella 0->P8', { impellaLevel: 8 }],
  ['IABP off->on', { iabpOn: true }],
  ['ECMO 0->7 L/min', { ecmoFlowLpm: 7 }],
];
for (const [label, change] of CHANGES) {
  const e = new TwinEngine('S0');
  e.autoCompress = false;
  e.load('S0', 'S0');
  const ref = Sim.fromSnapshot(SHOCK_PATIENT, SN.S0);
  const cyc = ref.cycleMs;
  for (let i = 0; i < 5 * cyc; i++) { e.stepTicks(1); ref.tick(); }
  e.applyRight(change, label);
  const tr = new Tracker();
  let rightDiverged = false;
  for (let i = 0; i < BEATS * cyc; i++) {
    e.stepTicks(1);
    ref.tick();
    tr.ticks++;
    tr.add(diffObj(e.left.sim.last, ref.last));
    if (!rightDiverged && !Object.is(e.right.sim.last.pAo, e.left.sim.last.pAo)) rightDiverged = true;
    if (ref.state.tickInBeat === 0) { tr.beats++; tr.add(diffObj(e.left.sim.lastBeat!, ref.lastBeat!)); }
  }
  const vs = JSON.stringify(e.left.sim.state) === JSON.stringify(ref.state);
  rows.push({ test: 'T2_change_one_pane', case: `right: ${label}; left vs solo reference`, ticks: tr.ticks, beats: tr.beats, max_abs_diff: tr.max, bit_identical: tr.bit && vs, pass_1e9: tr.max <= 1e-9, right_pane_did_change: rightDiverged, right_final_lvedp: e.right.sim.lastBeat!.lvedp, left_final_lvedp: e.left.sim.lastBeat!.lvedp });
  console.log(rows[rows.length - 1]);
}

/* T3 */
{
  const e = new TwinEngine('S0');
  e.autoCompress = false;
  e.load('S0', 'S0');
  e.stepTicks(7 * e.left.sim.cycleMs + 123); // fork mid-beat, as a user would
  const ref = e.right.sim.clone();
  e.fork({ ecmoFlowLpm: 4 }, 'VA-ECMO 4');
  const tr = new Tracker();
  for (let i = 0; i < BEATS * ref.cycleMs; i++) {
    e.stepTicks(1); ref.tick(); tr.ticks++;
    tr.add(diffObj(e.left.sim.last, ref.last));
  }
  rows.push({ test: 'T3_fork', case: 'fork mid-beat; continuing pane vs clone at fork instant', ticks: tr.ticks, beats: BEATS, max_abs_diff: tr.max, bit_identical: tr.bit, pass_1e9: tr.max <= 1e-9 });
  console.log(rows[rows.length - 1]);
}

/* T4 */
{
  const pA = { ...SHOCK_PATIENT, v0: { ...SHOCK_PATIENT.v0 } };
  const pB = { ...SHOCK_PATIENT, v0: { ...SHOCK_PATIENT.v0 }, lvEes: SHOCK_PATIENT.lvEes * 1.2 };
  const a = Sim.fromSnapshot(pA, SN.S0), b = Sim.fromSnapshot(pB, SN.S0), solo = Sim.fromSnapshot({ ...SHOCK_PATIENT }, SN.S0);
  const tr = new Tracker();
  for (let i = 0; i < BEATS * a.cycleMs; i++) {
    a.tick(); b.tick(); solo.tick(); tr.ticks++;
    tr.add(diffObj(a.last, solo.last));
  }
  rows.push({ test: 'T4_patient_param_one_sim', case: 'neighbour Ees x1.2; unchanged sim vs solo', ticks: tr.ticks, beats: BEATS, max_abs_diff: tr.max, bit_identical: tr.bit, pass_1e9: tr.max <= 1e-9, neighbour_final_lvedp: b.lastBeat!.lvedp, unchanged_final_lvedp: a.lastBeat!.lvedp });
  console.log(rows[rows.length - 1]);
}

writeCsv('v5_twin.csv', rows);
