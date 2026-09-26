/**
 * Two realities, one cardiac clock.
 *
 * Both panes hold their own Sim of the same patient. They are always advanced by
 * the same integer number of ticks, so tick, beat phase and sweep position are
 * identical across panes at every frame. Wall time only decides HOW MANY ticks
 * to run this frame — never what a tick computes.
 */

import { Sim, type SimSnapshot } from '../model/sim';
import { SHOCK_PATIENT } from '../model/patient';
import type { BeatMetrics, DeviceSettings } from '../model/types';
import steadyStates from '../model/steadyStates.json';
import type { SteadyKey } from '../model/steadyStates';
import { PvBuffer, SWEEP_MS, TraceBuffer } from './buffers';

const SNAPSHOTS = steadyStates as unknown as Record<SteadyKey, SimSnapshot>;

/** Longest wall-time slice honoured per frame (a stalled tab must not dump a burst of ticks). */
const MAX_FRAME_MS = 100;

/**
 * Rate used while an intervention equilibrates.
 *
 * This steps more 1 ms ticks per rendered frame. It does NOT change the tick, and
 * it does not touch any physiologic time constant. The sequence of ticks is
 * identical, so the state after K ticks is bit-identical however those K ticks were
 * distributed across frames — verified at every rate by validation E14, and measured
 * at ~21% of a 60 fps frame budget for two panes.
 *
 * Time compression is a rendering decision. Settling is not shortened, only watched
 * at a faster wall-clock rate.
 */
export const COMPRESS_RATE = 8;

export type Side = 'left' | 'right';

/**
 * Beat-to-beat stability test. A pane counts as settled once the headline metrics
 * stop moving between beats LAG apart, for NEEDED consecutive evaluations.
 * Thresholds are calibrated so "settled" fires when every metric is within ~1% of
 * its true steady state (see scripts/settling.ts).
 */
const SETTLE_LAG = 5;
const SETTLE_NEEDED = 5;
const SETTLE_TOL = { map: 0.07, lvedp: 0.06, nativeSv: 0.07, totalFlowLpm: 0.015 } as const;

export class PaneRuntime {
  sim: Sim;
  readonly trace = new TraceBuffer();
  readonly pv = new PvBuffer();
  beats: BeatMetrics[] = [];
  /** human label of what this reality is doing */
  label: string;
  stableCount = 0;

  /** true once the headline metrics have stopped moving (see SETTLE_TOL) */
  get settled(): boolean {
    return this.stableCount >= SETTLE_NEEDED;
  }

  /** Call once per completed beat. */
  noteBeat(m: BeatMetrics): void {
    this.beats.push(m);
    if (this.beats.length > 120) this.beats.shift();
    const prev = this.beats[this.beats.length - 1 - SETTLE_LAG];
    if (!prev) {
      this.stableCount = 0;
      return;
    }
    const steady = (Object.keys(SETTLE_TOL) as (keyof typeof SETTLE_TOL)[]).every(
      (k) => Math.abs((m[k] as number) - (prev[k] as number)) <= SETTLE_TOL[k],
    );
    this.stableCount = steady ? this.stableCount + 1 : 0;
  }

  /** Reset the settling test — called when the therapy changes under this pane. */
  markUnsettled(): void {
    this.stableCount = 0;
  }

  /**
   * Declare this pane settled without waiting for the beat-to-beat test.
   * Only used when starting from a shipped steady-state snapshot, whose generation
   * recipe runs far past convergence — a fact validation E14 checks rather than
   * assumes.
   */
  markSettled(): void {
    this.stableCount = SETTLE_NEEDED;
  }

  /** Carry a settling verdict across a fork, where the pane's physiology is unchanged. */
  adoptSettling(src: PaneRuntime): void {
    this.stableCount = src.stableCount;
  }

  constructor(sim: Sim, label: string) {
    this.sim = sim;
    this.label = label;
    if (sim.lastBeat) this.beats.push(sim.lastBeat);
  }

  get metrics(): BeatMetrics | null {
    return this.sim.lastBeat;
  }

  record(): void {
    const s = this.sim.last;
    this.trace.record(s);
    this.pv.record(s);
  }
}

export type EngineEvent = { type: 'beat' } | { type: 'reset' } | { type: 'fork' };

export class TwinEngine {
  left: PaneRuntime;
  right: PaneRuntime;
  speed = 1;
  paused = false;
  /** When true, a therapy change compresses time until both panes settle. */
  autoCompress = true;
  /** ticks since the last intervention was applied to the right pane */
  ticksSinceIntervention = 0;
  private acc = 0;
  private listeners = new Set<(e: EngineEvent) => void>();

  constructor(key: SteadyKey = 'S0', label = 'Shock') {
    this.left = new PaneRuntime(Sim.fromSnapshot(SHOCK_PATIENT, SNAPSHOTS[key]), label);
    this.right = new PaneRuntime(Sim.fromSnapshot(SHOCK_PATIENT, SNAPSHOTS[key]), label);
  }

  get tick(): number {
    return this.left.sim.state.tick;
  }

  /** True while time is being compressed to ride out an equilibration. */
  get compressing(): boolean {
    return this.speed > 1;
  }

  /** Both realities have stopped moving. */
  get settled(): boolean {
    return this.left.settled && this.right.settled;
  }

  private endCompressionIfSettled(): void {
    if (this.autoCompress && this.speed > 1 && this.settled) this.speed = 1;
  }

  on(fn: (e: EngineEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(e: EngineEvent) {
    for (const fn of this.listeners) fn(e);
  }

  /** Both panes restart from the same shipped snapshot, clock at 0. Bit-identical every time. */
  load(leftKey: SteadyKey, rightKey: SteadyKey = leftKey, leftLabel: string = leftKey, rightLabel: string = rightKey): void {
    this.left = new PaneRuntime(Sim.fromSnapshot(SHOCK_PATIENT, SNAPSHOTS[leftKey]), leftLabel);
    this.right = new PaneRuntime(Sim.fromSnapshot(SHOCK_PATIENT, SNAPSHOTS[rightKey]), rightLabel);
    // shipped snapshots are converged by construction (E14 verifies it)
    this.left.markSettled();
    this.right.markSettled();
    this.speed = 1;
    this.acc = 0;
    this.ticksSinceIntervention = 0;
    this.emit({ type: 'reset' });
  }

  /**
   * Split reality: the left pane becomes a live copy of the right pane as it is now
   * (the "before" world continues unchanged), and the right pane receives the new
   * settings (the "after" world).
   */
  fork(next: Partial<DeviceSettings>, rightLabel: string): void {
    const src = this.right;
    const left = new PaneRuntime(src.sim.clone(), src.label);
    left.trace.copyFrom(src.trace);
    left.pv.copyFrom(src.pv);
    left.beats = src.beats.slice();
    left.adoptSettling(src); // this pane's physiology did not change
    this.left = left;
    this.applyRight(next, rightLabel);
    this.emit({ type: 'fork' });
  }

  /** Change the right pane only. Reference loops are captured on both sides for comparison. */
  applyRight(next: Partial<DeviceSettings>, rightLabel: string): void {
    const ref = this.right.pv.latestLoop();
    this.left.pv.reference = ref ? ref.slice() : null;
    this.right.pv.reference = ref ? ref.slice() : null;
    this.right.sim.setSettings(next);
    this.right.label = rightLabel;
    this.right.markUnsettled();
    if (this.autoCompress) this.speed = COMPRESS_RATE;
    this.ticksSinceIntervention = 0;
  }

  /**
   * Solo -> twin. Keeps the pane the learner is already watching as B, untouched and
   * still running, and brings the untreated baseline in beside it as A.
   *
   * The new A is phase-aligned before it appears: it is stepped forward from the
   * shipped S0 snapshot so that it finishes at exactly B's tick and B's point in the
   * cardiac cycle, recording as it goes. Its waveform is therefore already full and
   * already beat-locked the moment it becomes visible, so the split reads as a second
   * reality arriving rather than as a reset.
   *
   * Additive: nothing else calls this and no existing path changes.
   */
  compareWithBaseline(baselineKey: SteadyKey = 'S0', baselineLabel = 'Cardiogenic shock — no support'): void {
    const b = this.right;
    const cycle = b.sim.cycleMs;
    const fill = cycle * Math.ceil(SWEEP_MS / cycle) + b.sim.state.tickInBeat;

    const sim = Sim.fromSnapshot(SHOCK_PATIENT, SNAPSHOTS[baselineKey]);
    sim.state.tick = b.sim.state.tick - fill;
    sim.state.beat = b.sim.state.beat - Math.floor(fill / cycle);

    const a = new PaneRuntime(sim, baselineLabel);
    a.beats = [];
    for (let i = 0; i < fill; i++) {
      const beforeBeat = sim.state.beat;
      sim.tick();
      a.record();
      if (sim.state.beat !== beforeBeat && sim.lastBeat) a.noteBeat(sim.lastBeat);
    }
    a.markSettled(); // the baseline snapshot is converged by construction (E14)
    this.left = a;
    this.emit({ type: 'fork' });
  }

  /** Called once per animation frame with elapsed wall time. */
  frame(wallDtMs: number): void {
    if (this.paused) return;
    this.acc += Math.min(wallDtMs, MAX_FRAME_MS) * this.speed;
    const n = Math.floor(this.acc);
    this.acc -= n;
    this.stepTicks(n);
  }

  stepTicks(n: number): void {
    let beat = false;
    for (let i = 0; i < n; i++) {
      const lb = this.left.sim.state.beat;
      this.left.sim.tick();
      this.right.sim.tick();
      this.left.record();
      this.right.record();
      this.ticksSinceIntervention++;
      if (this.left.sim.state.beat !== lb) {
        beat = true;
        this.left.noteBeat(this.left.sim.lastBeat!);
        this.right.noteBeat(this.right.sim.lastBeat!);
        this.endCompressionIfSettled();
      }
    }
    if (beat) this.emit({ type: 'beat' });
  }

  /** Apply a change at the next beat boundary (so the cardiac cycle is never cut mid-beat). */
  atNextBeat(fn: () => void): void {
    const remaining = this.left.sim.cycleMs - this.left.sim.state.tickInBeat;
    this.stepTicks(remaining % this.left.sim.cycleMs);
    fn();
  }
}
