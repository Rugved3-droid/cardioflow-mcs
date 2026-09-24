import type { BeatMetrics } from '../model/types';

export interface MetricDef {
  key: keyof BeatMetrics;
  label: string;
  unit: string;
  digits: number;
  /** display multiplier (e.g. fraction -> %) */
  scale?: number;
  /** |Δ| below this is shown as unchanged */
  same: number;
  /** full-scale |Δ| for the delta bar */
  span: number;
}

export const M: Record<string, MetricDef> = {
  map: { key: 'map', label: 'MAP', unit: 'mmHg', digits: 0, same: 1, span: 40 },
  lvedp: { key: 'lvedp', label: 'LVEDP', unit: 'mmHg', digits: 0, same: 1, span: 25 },
  lvedv: { key: 'lvedv', label: 'LVEDV', unit: 'mL', digits: 0, same: 2, span: 40 },
  nativeSv: { key: 'nativeSv', label: 'Native SV', unit: 'mL', digits: 0, same: 1, span: 25 },
  nativeCo: { key: 'nativeCoLpm', label: 'Native CO', unit: 'L/min', digits: 1, same: 0.1, span: 3 },
  total: { key: 'totalFlowLpm', label: 'Total flow', unit: 'L/min', digits: 1, same: 0.1, span: 3 },
  impella: { key: 'impellaLpm', label: 'Impella', unit: 'L/min', digits: 1, same: 0.1, span: 4 },
  ecmo: { key: 'ecmoLpm', label: 'ECMO', unit: 'L/min', digits: 1, same: 0.1, span: 4 },
  av: { key: 'avOpenFraction', label: 'AV open', unit: '% cycle', digits: 0, scale: 100, same: 1, span: 30 },
  pva: { key: 'pva', label: 'PVA', unit: 'mmHg·mL', digits: 0, same: 50, span: 2500 },
  dpti: { key: 'dpti', label: 'DPTI', unit: 'mmHg·s', digits: 1, same: 0.3, span: 15 },
  lap: { key: 'lapMean', label: 'LAP', unit: 'mmHg', digits: 0, same: 1, span: 25 },
  sbp: { key: 'sbp', label: 'SBP', unit: 'mmHg', digits: 0, same: 1, span: 40 },
  dbp: { key: 'dbp', label: 'DBP', unit: 'mmHg', digits: 0, same: 1, span: 40 },
  pdp: { key: 'peakDiastolicP', label: 'Peak diast.', unit: 'mmHg', digits: 0, same: 1, span: 30 },
  svr: { key: 'svrWood', label: 'SVR', unit: 'WU', digits: 1, same: 0.3, span: 8 },
};

export function val(m: BeatMetrics | null, d: MetricDef): number {
  if (!m) return NaN;
  const v = m[d.key];
  return typeof v === 'number' ? v * (d.scale ?? 1) : NaN;
}

export function fmt(x: number, digits: number): string {
  if (!Number.isFinite(x)) return '—';
  const r = x.toFixed(digits);
  return r === '-0' || r === '-0.0' ? r.slice(1) : r;
}

export const DELTA_KEYS = ['map', 'total', 'svr', 'lvedp', 'lvedv', 'nativeSv', 'av', 'pva'] as const;
