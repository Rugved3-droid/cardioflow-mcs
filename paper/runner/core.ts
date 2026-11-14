/**
 * Headless runner for the paper experiments.
 *
 * It does NOT re-implement the model. It drives the exact TypeScript modules the
 * browser build is compiled from (src/model/), or the generated knob variant
 * (paper/runner/variant/) when a constant must be changed. p0_equivalence.ts
 * proves both routes reproduce the browser engine.
 */
import { Sim as ShippedSim } from '../../src/model/sim';
import { NO_DEVICE, SHOCK_PATIENT } from '../../src/model/patient';
import type { BeatMetrics, DeviceSettings, PatientParams } from '../../src/model/types';
import { Sim as VariantSim } from './variant/sim';
import * as vConst from './variant/constants';
import * as vImp from './variant/devices/impella';
import * as vEcmo from './variant/devices/ecmo';
import * as vIabp from './variant/devices/iabp';

export { SHOCK_PATIENT, NO_DEVICE };
export type { BeatMetrics, DeviceSettings, PatientParams };

export type AnySim = ShippedSim | VariantSim;

export interface Knobs {
  SUBSTEPS?: number;
  H_MAX?: number;
  K?: number;
  SUCTION_START?: number;
  SUCTION_END?: number;
  DRAIN_ZERO_MMHG?: number;
  DRAIN_FULL_MMHG?: number;
  BALLOON_VOLUME_ML?: number;
  INFLATE_MS?: number;
  DEFLATE_MS?: number;
  DEFLATE_LEAD_MS?: number;
}

const OWNER: Record<keyof Knobs, { __set: (n: string, v: number) => void }> = {
  SUBSTEPS: vConst,
  H_MAX: vImp,
  K: vImp,
  SUCTION_START: vImp,
  SUCTION_END: vImp,
  DRAIN_ZERO_MMHG: vEcmo,
  DRAIN_FULL_MMHG: vEcmo,
  BALLOON_VOLUME_ML: vIabp,
  INFLATE_MS: vIabp,
  DEFLATE_MS: vIabp,
  DEFLATE_LEAD_MS: vIabp,
};

export function resetKnobs(): void {
  vConst.__reset();
  vImp.__reset();
  vEcmo.__reset();
  vIabp.__reset();
}

export function setKnobs(k: Knobs): void {
  resetKnobs();
  for (const [name, v] of Object.entries(k)) {
    if (v === undefined) continue;
    OWNER[name as keyof Knobs].__set(name, v);
  }
}

export function knobDefaults(): Required<Knobs> {
  return {
    ...vConst.__defaults,
    ...vImp.__defaults,
    ...vEcmo.__defaults,
    ...vIabp.__defaults,
  } as Required<Knobs>;
}

/** Shipped steady-state recipe (src/model/steadyStates.ts): 90 s unsupported, then 120 s on the target settings. */
export const BASELINE_MS = 90_000;
export const SUPPORT_MS = 120_000;

export interface RunOpts {
  patient?: PatientParams;
  /** use the knob variant (required if knobs are set) */
  variant?: boolean;
  knobs?: Knobs;
  baselineMs?: number;
  supportMs?: number;
  /** called at every beat close with the beat index since t=0 */
  onBeat?: (m: BeatMetrics, sim: AnySim) => void;
  /** called every tick after integration */
  onTick?: (sim: AnySim) => void;
}

export function makeSim(opts: RunOpts = {}): AnySim {
  const p = opts.patient ?? SHOCK_PATIENT;
  if (opts.variant || opts.knobs) {
    setKnobs(opts.knobs ?? {});
    return new VariantSim(p, NO_DEVICE);
  }
  return new ShippedSim(p, NO_DEVICE);
}

/** Run the shipped recipe for one device configuration and return the sim at the end (beat boundary). */
export function runScenario(settings: DeviceSettings, opts: RunOpts = {}): AnySim {
  const sim = makeSim(opts);
  if (opts.onBeat) sim.onBeat = (m) => opts.onBeat!(m, sim);
  const step = (ms: number) => {
    for (let i = 0; i < ms; i++) {
      sim.tick();
      opts.onTick?.(sim);
    }
  };
  step(opts.baselineMs ?? BASELINE_MS);
  sim.setSettings(settings);
  step(opts.supportMs ?? SUPPORT_MS);
  return sim;
}

/** Record one full beat of the PV loop and pressures, starting at a beat boundary. */
export function recordBeat(sim: AnySim): { t: number; vLv: number; pLv: number; pAo: number; qAortic: number; qImpella: number; qEcmo: number; vBalloon: number }[] {
  if (sim.state.tickInBeat !== 0) throw new Error('recordBeat must start at a beat boundary');
  const out = [];
  for (let i = 0; i < sim.cycleMs; i++) {
    const s = sim.last;
    out.push({ t: s.tickInBeat, vLv: s.vLv, pLv: s.pLv, pAo: s.pAo, qAortic: s.qAortic, qImpella: s.qImpella, qEcmo: s.qEcmo, vBalloon: s.vBalloon });
    sim.tick();
  }
  return out;
}

/** Headline outputs used throughout the paper. */
export const OUTPUTS = [
  'map', 'totalFlowLpm', 'nativeCoLpm', 'nativeSv', 'lvedp', 'lvedv', 'lvesv', 'ef',
  'avOpenFractionRaw', 'lapMean', 'rapMean', 'svrWood', 'pva', 'strokeWork', 'dpti',
  'impellaLpm', 'ecmoLpm', 'pulsePressure', 'sbp', 'dbp', 'peakDiastolicP', 'aorticEdp',
] as const;
export type Output = (typeof OUTPUTS)[number];

/**
 * Ejection-fraction metrics used in the paper. Applied identically to every scenario.
 *
 *   efNative   = 100 * native SV / LVEDV, where native SV = integral of aortic-valve flow
 *                over the beat. Counts only blood the LV ejects through its own valve; it is 0
 *                when the valve does not open (e.g. Impella P8). PRIMARY EF metric.
 *   efEmptying = 100 * (LVEDV - min LV volume) / LVEDV  (the simulator's own `ef`,
 *                sim.ts:450). Counts ALL LV outflow (native + Impella), so it is reported as
 *                "LV emptying fraction", never as EF, in pump-supported states.
 *
 * Native aortic-valve output (nativeSv, nativeCoLpm) and the raw AV opening fraction
 * (avOpenFractionRaw) are reported alongside.
 */
export function efMetrics(m: Pick<BeatMetrics, 'nativeSv' | 'lvedv' | 'ef'>): { efNative: number; efEmptying: number } {
  return { efNative: m.lvedv > 0 ? (100 * m.nativeSv) / m.lvedv : 0, efEmptying: m.ef };
}

export function pick(m: BeatMetrics): Record<Output, number> & { efNative: number; efEmptying: number } {
  const o = {} as Record<Output, number>;
  for (const k of OUTPUTS) o[k] = m[k] as number;
  return { ...o, ...efMetrics(m) };
}

export function settingsOf(s: Partial<DeviceSettings>): DeviceSettings {
  return { ...NO_DEVICE, ...s };
}
