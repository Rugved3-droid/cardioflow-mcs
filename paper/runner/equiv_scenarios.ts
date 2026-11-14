/**
 * Scenario battery shared by the Node and Chrome halves of the equivalence test.
 * Imports ONLY the shipped model (src/model/), the same modules the browser build bundles.
 */
import { Sim } from '../../src/model/sim';
import { NO_DEVICE, SHOCK_PATIENT } from '../../src/model/patient';
import type { DeviceSettings } from '../../src/model/types';
import { THERAPY_STATES } from '../../src/model/therapyStates';
import { IABP_TIMINGS } from '../../src/model/devices/iabp';

export const EQUIV_SCENARIOS: Record<string, DeviceSettings> = {
  S0: THERAPY_STATES.S0.settings,
  S1: THERAPY_STATES.S1.settings,
  S2: THERAPY_STATES.S2.settings,
  S3: THERAPY_STATES.S3.settings,
  S4: THERAPY_STATES.S4.settings,
  S5: THERAPY_STATES.S5.settings,
  IABP_1to2: { ...NO_DEVICE, iabpOn: true, iabpRatio: 2 },
  IABP_earlyInflation: { ...NO_DEVICE, iabpOn: true, iabpInflateOffsetMs: IABP_TIMINGS.earlyInflation.inflate },
  ECMO4_IABP: { ...NO_DEVICE, ecmoFlowLpm: 4, iabpOn: true },
};

const FIELDS = ['map', 'sbp', 'dbp', 'lvedp', 'lvedv', 'lvesv', 'ef', 'nativeSv', 'totalFlowLpm', 'impellaLpm', 'ecmoLpm', 'avOpenFractionRaw', 'pva', 'dpti', 'lapMean', 'svr'] as const;

/** Returns, per scenario, a flat numeric trace: every beat's FIELDS, then the final 7 volumes. */
export function runEquivBattery(baselineMs = 90_000, supportMs = 120_000): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [name, set] of Object.entries(EQUIV_SCENARIOS)) {
    const sim = new Sim(SHOCK_PATIENT, NO_DEVICE);
    const trace: number[] = [];
    sim.onBeat = (m) => {
      for (const f of FIELDS) trace.push(m[f] as number);
    };
    sim.run(baselineMs);
    sim.setSettings(set);
    sim.run(supportMs);
    const v = sim.state.v;
    trace.push(v.lv, v.rv, v.ao, v.sa, v.sv, v.pa, v.pv);
    out[name] = trace;
  }
  return out;
}
