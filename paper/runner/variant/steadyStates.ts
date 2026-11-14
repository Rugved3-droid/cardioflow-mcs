/**
 * Named steady operating points. Each is computed by a fixed, deterministic recipe
 * (no convergence test => no run-to-run variation) and shipped as a JSON snapshot,
 * so the UI can start any pane in any state instantly and bit-identically.
 *
 * Regenerate with `npm run snapshots`; `npm run validate` fails if the shipped
 * JSON no longer matches what the current model produces.
 */

import { Sim, type SimSnapshot } from './sim';
import { NO_DEVICE, SHOCK_PATIENT } from './patient';
import type { DeviceSettings } from './types';
import { THERAPY_STATES } from './therapyStates';

export const STEADY_CONFIGS = {
  S0: THERAPY_STATES.S0.settings,
  S1: THERAPY_STATES.S1.settings,
  S2: THERAPY_STATES.S2.settings,
  S3: THERAPY_STATES.S3.settings,
  S4: THERAPY_STATES.S4.settings,
  S5: THERAPY_STATES.S5.settings,
  ECMO2: { ...NO_DEVICE, ecmoFlowLpm: 2 },
} satisfies Record<string, DeviceSettings>;

export type SteadyKey = keyof typeof STEADY_CONFIGS;

const BASELINE_MS = 90_000; // multiples of the 600 ms beat => ends on a boundary
const SUPPORT_MS = 120_000;

export function computeSteadyState(key: SteadyKey): SimSnapshot {
  const sim = new Sim(SHOCK_PATIENT, NO_DEVICE);
  sim.run(BASELINE_MS);
  sim.setSettings(STEADY_CONFIGS[key]);
  sim.run(SUPPORT_MS);
  sim.resetClock();
  return sim.snapshot();
}

export function computeAllSteadyStates(): Record<SteadyKey, SimSnapshot> {
  const out = {} as Record<SteadyKey, SimSnapshot>;
  for (const k of Object.keys(STEADY_CONFIGS) as SteadyKey[]) out[k] = computeSteadyState(k);
  return out;
}
