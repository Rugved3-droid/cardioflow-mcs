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
import { PvBuffer, TraceBuffer } from './buffers';

const SNAPSHOTS = steadyStates as unknown as Record<SteadyKey, SimSnapshot>;

/** Longest wall-time slice honoured per frame (a stalled tab must not dump a burst of ticks). */
const MAX_FRAME_MS = 100;

export type Side = 'left' | 'right';

export class PaneRuntime {
  sim: Sim;
  readonly trace = new TraceBuffer();
  readonly pv = new PvBuffer();
  beats: BeatMetrics[] = [];
  /** human label of what this reality is doing */
  label: string;

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
    this.ticksSinceIntervention = 0;
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
        this.left.beats.push(this.left.sim.lastBeat!);
        this.right.beats.push(this.right.sim.lastBeat!);
        if (this.left.beats.length > 120) this.left.beats.shift();
        if (this.right.beats.length > 120) this.right.beats.shift();
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
