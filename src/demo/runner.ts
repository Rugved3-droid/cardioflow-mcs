/**
 * Demo sequencing, as a plain object with no React in it.
 *
 * Kept separate from the hook so the validation harness can drive the entire demo
 * headlessly and assert that two runs are identical. A script that can only be
 * exercised by a human at a keyboard is a script nobody can prove is reproducible.
 */

import type { TwinEngine } from '../runtime/TwinEngine';
import { THERAPY_STATES, type TherapyId } from '../model/therapyStates';
import type { SteadyKey } from '../model/steadyStates';
import { DEMO_END_HOLD_BEATS, DEMO_SCRIPT, type ScriptedStep } from './script';

export interface DemoEffects {
  onTherapy: (id: TherapyId) => void;
  onCaption: (text: string) => void;
  onPanel: (panel: 'plane' | 'anatomy' | 'none') => void;
  onWhy: (target: string) => void;
  onDismissWhy: () => void;
}

/** One entry in the trace a run produces. Used to compare two runs exactly. */
export interface TraceEntry {
  index: number;
  kind: string;
  /** cardiac beat on which the step was entered — the unit the script is written in */
  beat: number;
  detail: string;
}

export class DemoRunner {
  index = 0;
  running = false;
  caption = '';
  panel: 'plane' | 'anatomy' | 'none' = 'none';
  readonly trace: TraceEntry[] = [];

  private entered = false;
  private holdUntilBeat = 0;
  /** true while a derived causal chain is on screen */
  chainVisible = false;
  /** set if the script ever starts an intervention with a chain still displayed */
  violatedChainRule = false;

  constructor(
    private readonly engine: TwinEngine,
    private readonly fx: DemoEffects,
    private readonly script: ScriptedStep[] = DEMO_SCRIPT,
  ) {}

  start(): void {
    // always begin from a shipped steady state, so take 2 equals take 1
    this.engine.load('S0', 'S0', THERAPY_STATES.S0.name, THERAPY_STATES.S0.name);
    this.index = 0;
    this.entered = false;
    this.holdUntilBeat = 0;
    this.trace.length = 0;
    this.caption = '';
    this.panel = 'none';
    this.chainVisible = false;
    this.violatedChainRule = false;
    this.running = true;
  }

  stop(): void {
    this.running = false;
    this.caption = '';
    this.panel = 'none';
    this.engine.speed = 1;
    this.chainVisible = false;
    this.fx.onCaption('');
    this.fx.onPanel('none');
    this.fx.onDismissWhy();
  }

  /**
   * Advance the script. Call once per rendered frame (or once per simulated chunk
   * headlessly). Gating is on engine state and elapsed BEATS only — never on
   * wall-clock time — so the run is identical at any frame rate or time compression.
   */
  update(): void {
    if (!this.running) return;
    const beat = this.engine.left.sim.state.beat;

    if (this.index >= this.script.length) {
      if (beat >= this.holdUntilBeat) this.stop();
      return;
    }

    const cur = this.script[this.index];
    if (!this.entered) {
      // a step marked settleFirst waits for both panes to stop moving. This is what
      // guarantees a WHY never fires over values that are still changing.
      if (cur.settleFirst && !this.engine.settled) return;
      this.entered = true;
      this.caption = cur.step.caption;
      this.fx.onCaption(cur.step.caption);
      let detail = '';
      switch (cur.step.kind) {
        case 'load':
          this.engine.load(cur.step.state as SteadyKey, cur.step.state as SteadyKey, THERAPY_STATES[cur.step.state].name, THERAPY_STATES[cur.step.state].name);
          detail = cur.step.state;
          break;
        case 'therapy':
          // a chain still on screen would be narrating the PREVIOUS transition
          if (this.chainVisible) this.violatedChainRule = true;
          this.fx.onTherapy(cur.step.state);
          detail = cur.step.state;
          break;
        case 'why':
          this.chainVisible = true;
          this.fx.onWhy(cur.step.target);
          detail = cur.step.target;
          break;
        case 'dismiss':
          this.chainVisible = false;
          this.fx.onDismissWhy();
          detail = 'chain';
          break;
        case 'panel':
          this.panel = cur.step.panel;
          this.fx.onPanel(cur.step.panel);
          detail = cur.step.panel;
          break;
        case 'hold':
          detail = `${cur.step.beats} beats`;
          break;
      }
      this.trace.push({ index: this.index, kind: cur.step.kind, beat: this.engine.left.sim.state.beat, detail });
      this.holdUntilBeat = this.engine.left.sim.state.beat + cur.holdBeats;
      return;
    }

    if (beat >= this.holdUntilBeat) {
      this.entered = false;
      this.index += 1;
      if (this.index >= this.script.length) this.holdUntilBeat = beat + DEMO_END_HOLD_BEATS;
    }
  }
}

/** Serialise a trace for exact comparison between runs. */
export function traceSignature(trace: TraceEntry[]): string {
  return trace.map((t) => `${t.index}:${t.kind}:${t.detail}@${t.beat}`).join('|');
}
