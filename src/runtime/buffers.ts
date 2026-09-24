/**
 * Display buffers. They only copy numbers out of a Sim; they compute nothing.
 */

import type { Sample } from '../model/types';

/** Sweep window and decimation for the monitor-style waveform. */
export const SWEEP_MS = 5000;
export const TRACE_DECIM = 4;
export const TRACE_SLOTS = SWEEP_MS / TRACE_DECIM;

export const TRACE_CHANNELS = ['pAo', 'pLv', 'pPv', 'qImpella', 'qEcmo', 'vBalloon', 'vLv'] as const;
export type TraceChannel = (typeof TRACE_CHANNELS)[number];

export class TraceBuffer {
  readonly data: Record<TraceChannel, Float32Array>;
  /** tick of the sample stored in each slot (-1 = empty) */
  readonly stamp = new Int32Array(TRACE_SLOTS).fill(-1);

  constructor() {
    this.data = Object.fromEntries(TRACE_CHANNELS.map((c) => [c, new Float32Array(TRACE_SLOTS)])) as Record<
      TraceChannel,
      Float32Array
    >;
  }

  record(s: Sample): void {
    if (s.tick % TRACE_DECIM !== 0) return;
    const i = (s.tick % SWEEP_MS) / TRACE_DECIM;
    for (const c of TRACE_CHANNELS) this.data[c][i] = s[c];
    this.stamp[i] = s.tick;
  }

  clear(): void {
    this.stamp.fill(-1);
  }

  copyFrom(o: TraceBuffer): void {
    for (const c of TRACE_CHANNELS) this.data[c].set(o.data[c]);
    this.stamp.set(o.stamp);
  }
}

const PV_DECIM = 2;
const PV_MAX = 2048;
export const PV_HISTORY = 5;

export class PvBuffer {
  /** loop in progress, interleaved V,P */
  current = new Float32Array(PV_MAX * 2);
  currentLen = 0;
  /** most recent completed loops, newest first */
  history: Float32Array[] = [];
  /** loop captured at the moment the two realities diverged (reference) */
  reference: Float32Array | null = null;

  record(s: Sample): void {
    if (s.tickInBeat === 0 && this.currentLen > 8) {
      // close the loop on its end-diastolic point, then start the next one there
      this.push(s);
      this.history.unshift(this.current.slice(0, this.currentLen * 2));
      if (this.history.length > PV_HISTORY) this.history.pop();
      this.currentLen = 0;
    }
    if (s.tick % PV_DECIM === 0 || s.tickInBeat === 0) this.push(s);
  }

  private push(s: Sample): void {
    if (this.currentLen >= PV_MAX) return;
    this.current[this.currentLen * 2] = s.vLv;
    this.current[this.currentLen * 2 + 1] = s.pLv;
    this.currentLen++;
  }

  clear(): void {
    this.currentLen = 0;
    this.history = [];
    this.reference = null;
  }

  copyFrom(o: PvBuffer): void {
    this.current.set(o.current);
    this.currentLen = o.currentLen;
    this.history = o.history.map((h) => h.slice());
    this.reference = o.reference ? o.reference.slice() : null;
  }

  latestLoop(): Float32Array | null {
    return this.history[0] ?? null;
  }
}
