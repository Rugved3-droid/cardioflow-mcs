import type { DeviceSettings } from './types';
import { NO_DEVICE } from './patient';

export type TherapyId = 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5';

export interface TherapyState {
  id: TherapyId;
  name: string;
  short: string;
  settings: DeviceSettings;
}

export const ECMO_STANDARD_LPM = 4;
export const IMPELLA_STANDALONE_LEVEL = 8;
/**
 * Impella level for ECpella. P5 rather than P8: it still unloads the LV
 * substantially, but leaves the aortic valve intermittently opening, so the
 * S3 -> S4 transition reads as unloading rather than as the pump having stopped
 * the heart. P8 remains selectable in Explore and is what S5 uses.
 */
export const IMPELLA_ECPELLA_LEVEL = 5;
/** Optional weaned configuration, kept as S5. Changes TWO variables from S3. */
export const ECMO_WEANED_LPM = 2;

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
  /**
   * S4 differs from S3 by EXACTLY ONE variable: the Impella. ECMO is held at
   * ECMO_STANDARD_LPM. That single-variable difference is what makes the
   * S3 -> S4 comparison a clean counterfactual.
   */
  S4: {
    id: 'S4',
    name: `ECpella (VA-ECMO ${ECMO_STANDARD_LPM} + Impella P${IMPELLA_ECPELLA_LEVEL})`,
    short: 'ECPELLA',
    settings: { ...NO_DEVICE, ecmoFlowLpm: ECMO_STANDARD_LPM, impellaLevel: IMPELLA_ECPELLA_LEVEL },
  },
  /** Optional. Two variables change from S3, so it is not a counterfactual - it is a management step. */
  S5: {
    id: 'S5',
    name: `ECpella, ECMO weaned to ${ECMO_WEANED_LPM} (Impella P${IMPELLA_STANDALONE_LEVEL})`,
    short: 'WEANED',
    settings: { ...NO_DEVICE, ecmoFlowLpm: ECMO_WEANED_LPM, impellaLevel: IMPELLA_STANDALONE_LEVEL },
  },
};

/** The five states the demo walks, keys 1-5. S5 is reachable from the Explore controls. */
export const THERAPY_ORDER: TherapyId[] = ['S0', 'S1', 'S2', 'S3', 'S4'];
export const ALL_THERAPY_IDS: TherapyId[] = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5'];
