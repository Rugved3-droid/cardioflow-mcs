import type { DeviceSettings } from './types';
import { NO_DEVICE } from './patient';

export type TherapyId = 'S0' | 'S1' | 'S2' | 'S3' | 'S4';

export interface TherapyState {
  id: TherapyId;
  name: string;
  short: string;
  settings: DeviceSettings;
}

export const ECMO_STANDARD_LPM = 4;
export const IMPELLA_STANDALONE_LEVEL = 8;
export const IMPELLA_ECPELLA_LEVEL = 8;
/** ECMO is weaned as the Impella comes on (standard ECpella practice). Holding ECMO at 4 L/min
 *  with an Impella added raises total flow and MAP in a fixed-SVR model — see README. */
export const ECMO_ECPELLA_LPM = 2;

export const THERAPY_STATES: Record<TherapyId, TherapyState> = {
  S0: { id: 'S0', name: 'Cardiogenic shock — no support', short: 'SHOCK', settings: { ...NO_DEVICE } },
  S1: { id: 'S1', name: 'IABP 1:1', short: 'IABP', settings: { ...NO_DEVICE, iabpOn: true } },
  S2: {
    id: 'S2',
    name: `Impella P${IMPELLA_STANDALONE_LEVEL}`,
    short: 'IMPELLA',
    settings: { ...NO_DEVICE, impellaLevel: IMPELLA_STANDALONE_LEVEL },
  },
  S3: {
    id: 'S3',
    name: `VA-ECMO ${ECMO_STANDARD_LPM} L/min`,
    short: 'VA-ECMO',
    settings: { ...NO_DEVICE, ecmoFlowLpm: ECMO_STANDARD_LPM },
  },
  S4: {
    id: 'S4',
    name: `ECpella (Impella P${IMPELLA_ECPELLA_LEVEL} + ECMO weaned to ${ECMO_ECPELLA_LPM})`,
    short: 'ECPELLA',
    settings: { ...NO_DEVICE, ecmoFlowLpm: ECMO_ECPELLA_LPM, impellaLevel: IMPELLA_ECPELLA_LEVEL },
  },
};

export const THERAPY_ORDER: TherapyId[] = ['S0', 'S1', 'S2', 'S3', 'S4'];
