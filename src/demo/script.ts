/**
 * The scripted demo.
 *
 * One keypress starts it and it runs to the end with no further input: every state
 * change, every WHY, every panel is sequenced here. Two rules make it reproducible
 * on camera:
 *
 *  1. No step advances on wall-clock time. Steps that follow an intervention wait
 *     for the engine's own settling test, so the run is identical whatever the
 *     machine's frame rate, and a WHY can never fire while values are still moving.
 *  2. No step depends on where the previous take left off. The run begins by loading
 *     a shipped steady state, which is bit-identical every time.
 *
 * Time compression is part of the script, not a manual key press: an intervention
 * turns it on and the settle gate turns it off.
 */

import type { TherapyId } from '../model/therapyStates';
import type { WhyTarget } from '../causal/derive';

export type DemoStep =
  | { kind: 'load'; state: TherapyId; caption: string }
  | { kind: 'therapy'; state: TherapyId; caption: string }
  | { kind: 'why'; target: WhyTarget; caption: string }
  | { kind: 'panel'; panel: 'plane' | 'anatomy' | 'none'; caption: string }
  | { kind: 'hold'; beats: number; caption: string }
  /** Explicitly clear a displayed causal chain. The script never starts the next
   *  intervention while one is up, so the chain can never be left narrating a
   *  transition it was not derived from. */
  | { kind: 'dismiss'; caption: string };

/**
 * `settleFirst` on a step means: do not begin it until both panes have stopped
 * moving. `beats` is a hold measured in cardiac beats, not seconds, so it is
 * unaffected by time compression.
 */
export interface ScriptedStep {
  step: DemoStep;
  settleFirst: boolean;
  holdBeats: number;
}

const s = (step: DemoStep, settleFirst: boolean, holdBeats: number): ScriptedStep => ({ step, settleFirst, holdBeats });

export const DEMO_SCRIPT: ScriptedStep[] = [
  s({ kind: 'load', state: 'S0', caption: 'Cardiogenic shock. No support. MAP 62, LVEDP 20, the ventricle barely ejecting.' }, false, 6),

  s({ kind: 'therapy', state: 'S1', caption: 'IABP first. Counterpulsation: diastolic augmentation, a little afterload relief.' }, false, 0),
  s({ kind: 'hold', beats: 5, caption: 'MAP up a little. LVEDP down a little. A modest intervention, honestly shown.' }, true, 5),

  s({ kind: 'therapy', state: 'S3', caption: 'Now VA-ECMO at 4 L/min. Watch the two numbers that matter.' }, false, 0),
  s({ kind: 'hold', beats: 6, caption: 'MAP 62 to 81. And LVEDP 20 to 26. The pressure got better and the ventricle got worse.' }, true, 6),

  s({ kind: 'why', target: 'lvedp', caption: 'Why? The chain is derived from these numbers, not written in advance.' }, true, 14),
  s({ kind: 'dismiss', caption: '' }, false, 1),

  s({ kind: 'panel', panel: 'plane', caption: 'Perfusion against unloading. ECMO moves this patient right — and down.' }, true, 10),
  s({ kind: 'panel', panel: 'none', caption: '' }, false, 1),

  s({ kind: 'therapy', state: 'S4', caption: 'Add an Impella across the valve. Circuit flow held at 4 — one variable changes.' }, false, 0),
  s({ kind: 'hold', beats: 6, caption: 'LVEDP 26 to 23. MAP holds. The ventricle is vented without giving up perfusion.' }, true, 6),

  s({ kind: 'panel', panel: 'anatomy', caption: 'The same state, drawn: blood leaving the LV through the pump, and the cavity smaller.' }, true, 10),
  s({ kind: 'panel', panel: 'none', caption: '' }, false, 1),

  s({ kind: 'panel', panel: 'plane', caption: 'On the plane: back up, without moving left. That divergence is the whole point.' }, true, 12),
  s({ kind: 'panel', panel: 'none', caption: '' }, false, 2),
];

/** Beats to hold the closing caption before the script reports itself finished. */
export const DEMO_END_HOLD_BEATS = 6;
