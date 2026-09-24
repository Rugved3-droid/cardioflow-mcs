/**
 * One simulated patient. `Sim.state` is the single source of truth; every visual,
 * number, and assessment reveal reads from a Sim (never recomputes physiology).
 *
 * Clock: integer 1 ms ticks. The beat length is an integer number of ticks, so the
 * cardiac cycle never drifts and two Sims stepped together share one clock exactly.
 * Integration: classical RK4, SUBSTEPS fixed substeps per tick. No adaptive step,
 * no dependence on wall time or frame rate => same inputs, same bits (per JS engine).
 *
 * Circulation (volumes: LV/RV absolute, vessels stressed; P = V/C):
 *
 *   PV(LA) -mitral-> LV -aortic valve-> AO -Rc-> SA -Rsvr-> SV -tricuspid-> RV -pulmonic-> PA -Rpvr-> PV
 *                     \--- Impella ----/         ^  \                |
 *                                                |   \--bronchial--> PV
 *                                                +---- ECMO <--------+
 *   IABP balloon occupies volume inside SA.
 */

import type {
  Actuators,
  BeatMetrics,
  DeviceSettings,
  PatientParams,
  Sample,
  SimState,
} from './types';

export interface SimSnapshot {
  state: SimState;
  /** the 7 compartment volumes (integrals are zero at a beat boundary) */
  y: number[];
  lastBeat: BeatMetrics | null;
}
import { activation, chamberPressure, edpvrIntegral } from './ventricle';
import { balloonVolume, FALLBACK_NOTCH_FRACTION, FALLBACK_OPEN_FRACTION } from './devices/iabp';
import { impellaFlow } from './devices/impella';
import { ecmoFlow } from './devices/ecmo';
import {
  AV_FRACTION_EMA,
  DIASTOLE_ACTIVATION,
  ML_S_TO_LPM,
  SLEW,
  SUBSTEPS,
  TICK_MS,
} from './constants';
import { NO_DEVICE } from './patient';

/* y-vector layout: 7 volumes, then per-beat integrals (reset each beat) */
const LV = 0, RV = 1, AO = 2, SA = 3, SV = 4, PA = 5, PV = 6;
const I_AV = 7, I_IMP = 8, I_ECMO = 9, I_SW = 10, I_DPTI = 11, I_PAO = 12, I_AVOPEN = 13,
  I_PPV = 14, I_PSV = 15, I_PPA = 16;
const NY = 17;

interface Ctx {
  p: PatientParams;
  act: Actuators;
  cycleMs: number;
  notchMs: number | null;
  openMs: number | null;
  assistThis: boolean;
  assistPrev: boolean;
}

interface Eval extends Omit<Sample, 'tick' | 'beat' | 'tickInBeat' | 'phase'> {
  dy: Float64Array;
}

function evaluate(y: Float64Array, tInBeat: number, c: Ctx): Eval {
  const p = c.p;
  const act = activation(tInBeat, c.cycleMs, p.actScale);

  const vb =
    c.act.iabpFill > 0 && c.notchMs !== null && c.openMs !== null
      ? balloonVolume(tInBeat, c.cycleMs, c.notchMs, c.openMs, c.act.iabpInflateOffsetMs, c.act.iabpDeflateOffsetMs, c.act.iabpFill, c.assistThis, c.assistPrev)
      : 0;

  const pLv = chamberPressure(y[LV], act, p.lvEes, p.lvV0, p.lvA, p.lvB, p.lvV0ed);
  const pRv = chamberPressure(y[RV], act, p.rvEes, p.rvV0, p.rvA, p.rvB, p.rvV0);
  const pAo = y[AO] / p.cAo;
  const pSa = (y[SA] + vb) / p.cSa;
  const pSv = y[SV] / p.cSv;
  const pPa = y[PA] / p.cPa;
  const pPv = y[PV] / p.cPv;

  // ideal diodes: open iff upstream > downstream
  const qMitral = pPv > pLv ? (pPv - pLv) / p.rMitral : 0;
  const qAortic = pLv > pAo ? (pLv - pAo) / p.rAortic : 0;
  const qTricuspid = pSv > pRv ? (pSv - pRv) / p.rTricuspid : 0;
  const qPulmonic = pRv > pPa ? (pRv - pPa) / p.rPulmonic : 0;
  const qRc = (pAo - pSa) / p.rc;
  const qSvr = (pSa - pSv) / p.rSvr;
  const qPvr = (pPa - pPv) / p.rPvr;
  const qBronchial = (pSa - pPv) / p.rBronchial;

  const imp = impellaFlow(c.act.impellaLevel, pAo, pLv, y[LV], p.lvV0);
  const ecmo = ecmoFlow(c.act.ecmoFlowLpm, pSv);

  const dy = new Float64Array(NY);
  dy[LV] = qMitral - qAortic - imp.q;
  dy[AO] = qAortic + imp.q - qRc;
  dy[SA] = qRc + ecmo.q - qSvr - qBronchial;
  dy[SV] = qSvr - qTricuspid - ecmo.q;
  dy[RV] = qTricuspid - qPulmonic;
  dy[PA] = qPulmonic - qPvr;
  dy[PV] = qPvr + qBronchial - qMitral;

  dy[I_AV] = qAortic;
  dy[I_IMP] = imp.q;
  dy[I_ECMO] = ecmo.q;
  dy[I_SW] = -pLv * dy[LV]; // loop area = -∮P dV
  dy[I_DPTI] = act < DIASTOLE_ACTIVATION && pAo > pLv ? pAo - pLv : 0;
  dy[I_PAO] = pAo;
  dy[I_AVOPEN] = qAortic > 0 ? 1 : 0;
  dy[I_PPV] = pPv;
  dy[I_PSV] = pSv;
  dy[I_PPA] = pPa;

  return {
    dy,
    activation: act,
    pLv, pRv, pAo, pSa, pSv, pPa, pPv,
    vLv: y[LV],
    vRv: y[RV],
    qMitral, qAortic, qTricuspid, qPulmonic, qRc, qSvr, qPvr, qBronchial,
    qImpella: imp.q,
    qEcmo: ecmo.q,
    vBalloon: vb,
    avOpen: qAortic > 0,
    impellaSuction: imp.suction,
    ecmoDrainageLimited: ecmo.drainageLimited,
  };
}

function slew(cur: number, target: number, ratePerS: number): number {
  const maxStep = (ratePerS * TICK_MS) / 1000;
  const d = target - cur;
  return Math.abs(d) <= maxStep ? target : cur + Math.sign(d) * maxStep;
}

/** Per-beat sampled (non-integrated) extrema. */
class BeatExtrema {
  n = 0;
  sbp = -Infinity;
  dbp = Infinity;
  peakDiastolicP = -Infinity;
  lvPeakP = -Infinity;
  vMin = Infinity;
  edv = 0;
  edp = 0;
  aoAtOpen: number | null = null;
  aoAtStart = 0;
  esRatio = -Infinity;
  esv = 0;
  esp = 0;
  firstOpenMs: number | null = null;
  lastOpenMs: number | null = null;
  suction = false;
  drainLimited = false;
}

export class Sim {
  readonly p: PatientParams;
  readonly cycleMs: number;
  state: SimState;
  /** the sample at the current tick (what every visual reads) */
  last!: Sample;
  /** most recent completed beat */
  lastBeat: BeatMetrics | null = null;
  /** listeners invoked synchronously at each beat close */
  onBeat: ((m: BeatMetrics) => void) | null = null;

  private y = new Float64Array(NY);
  private ex = new BeatExtrema();

  constructor(p: PatientParams, settings: DeviceSettings = NO_DEVICE) {
    this.p = p;
    this.cycleMs = Math.round(60000 / p.hr);
    const v = { ...p.v0 };
    this.state = {
      tick: 0,
      beat: 0,
      tickInBeat: 0,
      v,
      act: { iabpFill: 0, iabpInflateOffsetMs: settings.iabpInflateOffsetMs, iabpDeflateOffsetMs: settings.iabpDeflateOffsetMs, impellaLevel: 0, ecmoFlowLpm: 0 },
      settings: { ...settings },
      iabpNotchMs: null,
      iabpOpenMs: null,
      lastAvClosureMs: null,
      lastAvOpeningMs: null,
      avOpenFractionSmoothed: 0,
    };
    this.loadY();
    this.last = this.sampleNow();
  }

  /** Deep copy (used by twin panes to fork an identical patient). */
  clone(): Sim {
    const s = new Sim(this.p, this.state.settings);
    s.state = structuredClone(this.state);
    s.y.set(this.y);
    s.ex = Object.assign(new BeatExtrema(), this.ex);
    s.lastBeat = this.lastBeat ? { ...this.lastBeat } : null;
    s.last = { ...this.last };
    return s;
  }

  /** Serializable snapshot. Only taken at a beat boundary, where per-beat accumulators are empty. */
  snapshot(): SimSnapshot {
    if (this.state.tickInBeat !== 0) throw new Error('snapshot only at a beat boundary');
    return {
      state: structuredClone(this.state),
      y: Array.from(this.y.subarray(0, 7)),
      lastBeat: this.lastBeat ? { ...this.lastBeat } : null,
    };
  }

  static fromSnapshot(p: PatientParams, snap: SimSnapshot): Sim {
    const s = new Sim(p, snap.state.settings);
    s.state = structuredClone(snap.state);
    s.y.fill(0);
    s.y.set(snap.y);
    s.lastBeat = snap.lastBeat ? { ...snap.lastBeat } : null;
    s.last = s.sampleNow();
    return s;
  }

  /** Re-zero the clock (at a beat boundary) so two panes share tick 0. Physiology is untouched. */
  resetClock(): void {
    if (this.state.tickInBeat !== 0) throw new Error('resetClock only at a beat boundary');
    this.state.tick = 0;
    this.state.beat = 0;
    this.last = this.sampleNow();
  }

  setSettings(next: Partial<DeviceSettings>): void {
    this.state.settings = { ...this.state.settings, ...next };
  }

  /** Jump actuators to their targets with no ramp. For headless steady-state experiments only. */
  snapActuators(): void {
    const s = this.state.settings;
    const a = this.state.act;
    a.impellaLevel = s.impellaLevel;
    a.ecmoFlowLpm = s.ecmoFlowLpm;
    a.iabpInflateOffsetMs = s.iabpInflateOffsetMs;
    a.iabpDeflateOffsetMs = s.iabpDeflateOffsetMs;
  }

  totalVolume(): number {
    const v = this.state.v;
    return v.lv + v.rv + v.ao + v.sa + v.sv + v.pa + v.pv;
  }

  private loadY(): void {
    const v = this.state.v;
    this.y[LV] = v.lv; this.y[RV] = v.rv; this.y[AO] = v.ao; this.y[SA] = v.sa;
    this.y[SV] = v.sv; this.y[PA] = v.pa; this.y[PV] = v.pv;
  }
  private storeY(): void {
    const v = this.state.v, y = this.y;
    v.lv = y[LV]; v.rv = y[RV]; v.ao = y[AO]; v.sa = y[SA]; v.sv = y[SV]; v.pa = y[PA]; v.pv = y[PV];
  }

  private ctx(): Ctx {
    const s = this.state;
    const r = s.settings.iabpRatio;
    return {
      p: this.p,
      act: s.act,
      cycleMs: this.cycleMs,
      notchMs: s.iabpNotchMs,
      openMs: s.iabpOpenMs,
      assistThis: s.beat % r === 0,
      assistPrev: (s.beat + r - 1) % r === 0,
    };
  }

  private sampleNow(): Sample {
    const s = this.state;
    const e = evaluate(this.y, s.tickInBeat, this.ctx());
    const { dy: _dy, ...rest } = e;
    return { ...rest, tick: s.tick, beat: s.beat, tickInBeat: s.tickInBeat, phase: s.tickInBeat / this.cycleMs };
  }

  /** Advance exactly one 1 ms tick. */
  tick(): void {
    const s = this.state;
    const set = s.settings;
    const a = s.act;

    /* 1. actuators (rate-limited; constant within the tick) */
    const iabpTarget = set.iabpOn && s.iabpNotchMs !== null ? 1 : 0;
    a.iabpFill = slew(a.iabpFill, iabpTarget, SLEW.iabpFillPerS);
    a.iabpInflateOffsetMs = slew(a.iabpInflateOffsetMs, set.iabpInflateOffsetMs, SLEW.iabpTimingMsPerS);
    a.iabpDeflateOffsetMs = slew(a.iabpDeflateOffsetMs, set.iabpDeflateOffsetMs, SLEW.iabpTimingMsPerS);
    a.impellaLevel = slew(a.impellaLevel, set.impellaLevel, SLEW.impellaLevelPerS);
    a.ecmoFlowLpm = slew(a.ecmoFlowLpm, set.ecmoFlowLpm, SLEW.ecmoLpmPerS);
    if (!set.iabpOn && a.iabpFill === 0) {
      s.iabpNotchMs = null;
      s.iabpOpenMs = null;
    }

    /* 2. sample the state at this tick and fold it into the beat */
    this.accumulate(this.sampleNow());

    /* 3. integrate tick -> tick+1 (RK4, fixed substeps) */
    const c = this.ctx();
    const h = TICK_MS / SUBSTEPS; // ms
    const hs = h / 1000; // s
    const y = this.y;
    const tmp = new Float64Array(NY);
    for (let k = 0; k < SUBSTEPS; k++) {
      const t0 = s.tickInBeat + k * h;
      const k1 = evaluate(y, t0, c).dy;
      for (let i = 0; i < NY; i++) tmp[i] = y[i] + 0.5 * hs * k1[i];
      const k2 = evaluate(tmp, t0 + 0.5 * h, c).dy;
      for (let i = 0; i < NY; i++) tmp[i] = y[i] + 0.5 * hs * k2[i];
      const k3 = evaluate(tmp, t0 + 0.5 * h, c).dy;
      for (let i = 0; i < NY; i++) tmp[i] = y[i] + hs * k3[i];
      const k4 = evaluate(tmp, t0 + h, c).dy;
      for (let i = 0; i < NY; i++) y[i] += (hs / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    }
    this.storeY();

    /* 4. advance the clock; close the beat on the boundary */
    s.tick += 1;
    s.tickInBeat += 1;
    if (s.tickInBeat >= this.cycleMs) {
      s.tickInBeat = 0;
      this.closeBeat();
      s.beat += 1;
    }
    this.last = this.sampleNow();
  }

  run(ms: number): void {
    for (let i = 0; i < ms; i++) this.tick();
  }

  private accumulate(m: Sample): void {
    const x = this.ex;
    const p = this.p;
    if (x.n === 0) {
      x.edv = m.vLv;
      x.edp = m.pLv;
      x.aoAtStart = m.pAo;
    }
    x.n++;
    if (m.activation >= DIASTOLE_ACTIVATION) {
      if (m.pAo > x.sbp) x.sbp = m.pAo;
    } else if (m.pAo > x.peakDiastolicP) x.peakDiastolicP = m.pAo;
    if (m.pAo < x.dbp) x.dbp = m.pAo;
    if (m.pLv > x.lvPeakP) x.lvPeakP = m.pLv;
    if (m.vLv < x.vMin) x.vMin = m.vLv;
    const dv = m.vLv - p.lvV0;
    if (dv > 2) {
      const r = m.pLv / dv;
      if (r > x.esRatio) {
        x.esRatio = r;
        x.esv = m.vLv;
        x.esp = m.pLv;
      }
    }
    if (m.avOpen) {
      if (x.firstOpenMs === null) {
        x.firstOpenMs = m.tickInBeat;
        x.aoAtOpen = m.pAo;
      }
      x.lastOpenMs = m.tickInBeat;
    }
    if (m.impellaSuction) x.suction = true;
    if (m.ecmoDrainageLimited) x.drainLimited = true;
  }

  private closeBeat(): void {
    const s = this.state;
    const x = this.ex;
    const y = this.y;
    const p = this.p;
    const T = this.cycleMs / 1000;

    const sv = y[I_AV];
    const avRaw = y[I_AVOPEN] / T;
    s.avOpenFractionSmoothed =
      this.lastBeat === null ? avRaw : s.avOpenFractionSmoothed + AV_FRACTION_EMA * (avRaw - s.avOpenFractionSmoothed);
    s.lastAvClosureMs = x.lastOpenMs !== null ? x.lastOpenMs + 1 : null;
    s.lastAvOpeningMs = x.firstOpenMs;

    // IABP console: capture timing references from this (unassisted) beat
    if (s.settings.iabpOn && s.iabpNotchMs === null) {
      s.iabpNotchMs = s.lastAvClosureMs ?? Math.round(FALLBACK_NOTCH_FRACTION * this.cycleMs);
      s.iabpOpenMs = s.lastAvOpeningMs ?? Math.round(FALLBACK_OPEN_FRACTION * this.cycleMs);
    }

    const esvDisp = Math.max(x.esv - p.lvV0, 0);
    const pe = Math.max(0.5 * x.esp * esvDisp - edpvrIntegral(x.esv, p.lvA, p.lvB, p.lvV0ed), 0);
    const sw = y[I_SW];
    const toLpm = (ml: number) => (ml / T) * ML_S_TO_LPM;
    const impLpm = toLpm(y[I_IMP]);
    const ecmoLpm = toLpm(y[I_ECMO]);
    const nativeLpm = toLpm(sv);

    const m: BeatMetrics = {
      beat: s.beat,
      endTick: s.tick,
      map: y[I_PAO] / T,
      sbp: x.sbp,
      dbp: x.dbp,
      pulsePressure: x.sbp - x.dbp,
      peakDiastolicP: x.peakDiastolicP,
      aorticEdp: x.aoAtOpen ?? x.aoAtStart,
      lvedp: x.edp,
      lvedv: x.edv,
      lvesv: x.esv,
      lvesp: x.esp,
      lvPeakP: x.lvPeakP,
      ef: x.edv > 0 ? (100 * (x.edv - x.vMin)) / x.edv : 0,
      nativeSv: sv,
      nativeCoLpm: nativeLpm,
      impellaLpm: impLpm,
      ecmoLpm,
      totalFlowLpm: nativeLpm + impLpm + ecmoLpm,
      strokeWork: sw,
      pe,
      pva: sw + pe,
      dpti: y[I_DPTI], // integrand mmHg, integrated over s => mmHg*s per beat
      avOpenFractionRaw: avRaw,
      avOpenFraction: s.avOpenFractionSmoothed,
      avOpened: sv > 0.5,
      avOpenMs: x.firstOpenMs,
      avCloseMs: s.lastAvClosureMs,
      lapMean: y[I_PPV] / T,
      rapMean: y[I_PSV] / T,
      paMean: y[I_PPA] / T,
      impellaSuction: x.suction,
      ecmoDrainageLimited: x.drainLimited,
      iabpFill: s.act.iabpFill,
    };
    for (let i = 7; i < NY; i++) y[i] = 0;
    this.ex = new BeatExtrema();
    this.lastBeat = m;
    this.onBeat?.(m);
  }
}
