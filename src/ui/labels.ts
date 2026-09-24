import type { SteadyKey } from '../model/steadyStates';
import { THERAPY_STATES } from '../model/therapyStates';

export const STEADY_LABEL: Record<SteadyKey, string> = {
  S0: THERAPY_STATES.S0.name,
  S1: THERAPY_STATES.S1.name,
  S2: THERAPY_STATES.S2.name,
  S3: THERAPY_STATES.S3.name,
  S4: THERAPY_STATES.S4.name,
  ECMO2: 'VA-ECMO 2 L/min',
};

import type { DeviceSettings } from '../model/types';
import { IABP_TIMINGS, type IabpTimingName } from '../model/devices/iabp';

/** Human label for an arbitrary device configuration (Explore mode). */
export function describeSettings(s: DeviceSettings): string {
  const parts: string[] = [];
  if (s.iabpOn) {
    const t = (Object.keys(IABP_TIMINGS) as IabpTimingName[]).find(
      (k) => IABP_TIMINGS[k].inflate === s.iabpInflateOffsetMs && IABP_TIMINGS[k].deflate === s.iabpDeflateOffsetMs,
    );
    parts.push(`IABP ${s.iabpRatio === 2 ? '1:2' : '1:1'}${t && t !== 'correct' ? ` (${IABP_TIMINGS[t].label.toLowerCase()})` : ''}`);
  }
  if (s.impellaLevel > 0) parts.push(`Impella P${s.impellaLevel}`);
  if (s.ecmoFlowLpm > 0) parts.push(`VA-ECMO ${s.ecmoFlowLpm} L/min`);
  return parts.length ? parts.join(' + ') : 'No support';
}
