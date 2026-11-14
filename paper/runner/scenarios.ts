/** Named device configurations used by V1-V5. All are plain DeviceSettings on the shipped patient. */
import { THERAPY_STATES } from '../../src/model/therapyStates';
import { settingsOf, type DeviceSettings } from './core';

export const NAMED: Record<string, DeviceSettings> = {
  S0_shock: THERAPY_STATES.S0.settings,
  S1_IABP: THERAPY_STATES.S1.settings,
  S2_ImpellaP8: THERAPY_STATES.S2.settings,
  S3_ECMO4: THERAPY_STATES.S3.settings,
  S4_ECMO4_P5: THERAPY_STATES.S4.settings,
  S5_ECMO2_P8: THERAPY_STATES.S5.settings,
  IABP_1to2: settingsOf({ iabpOn: true, iabpRatio: 2 }),
  ECMO4_IABP: settingsOf({ ecmoFlowLpm: 4, iabpOn: true }),
  ECMO6: settingsOf({ ecmoFlowLpm: 6 }),
};
