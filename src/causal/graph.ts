/**
 * The causal graph: an explicit directed graph of model variables.
 *
 * This is a DATA STRUCTURE, not prose and not canned paragraphs. Nodes are model
 * quantities; edges are typed, signed influences carrying a short mechanism string.
 * When an intervention happens, `derivePath` diffs the pre/post state and walks
 * this graph to emit the path that was ACTUALLY traversed on this occasion — so
 * the explanation is assembled from the numbers, not looked up.
 *
 * Every edge's sign is a claim about the model that the validation harness can
 * check (see E10): if the model stops obeying an edge, the build fails rather
 * than the app narrating something untrue.
 */

import type { BeatMetrics } from '../model/types';
import type { TraceChannel } from '../runtime/buffers';

/** Where a node lives on screen, so the highlight can light up the right surfaces. */
export type Surface = 'anatomy' | 'waveform' | 'pvloop' | 'numeric';

export interface CausalNode {
  id: string;
  label: string;
  /** short form for the chain ribbon */
  short: string;
  /** metric this node reads from, when it has one */
  metric?: keyof BeatMetrics;
  unit?: string;
  digits?: number;
  /** surfaces that should highlight when this node is active */
  surfaces: Surface[];
  /** device knobs and structural quantities are roots: they change because the operator acted */
  root?: boolean;
  /** waveform traces to emphasise while this node is highlighted */
  traces?: TraceChannel[];
  /** feature of the PV loop to emphasise */
  pv?: 'edp' | 'edv' | 'sv' | 'area' | 'esp';
}

export type EdgeSign = 1 | -1;

export interface CausalEdge {
  from: string;
  to: string;
  /** +1: from rises => to rises. -1: from rises => to falls. */
  sign: EdgeSign;
  /** why, in one clause. Reads as "<from> up ... <mechanism> ... <to> up/down". */
  mechanism: string;
  /**
   * Edge only applies when this predicate holds of the post-intervention beat.
   * Used where a pathway is genuinely conditional (e.g. the valve must open for
   * ejection-mediated effects to exist).
   */
  when?: (post: BeatMetrics) => boolean;
}

export const NODES: Record<string, CausalNode> = {
  ecmoFlow: { id: 'ecmoFlow', label: 'VA-ECMO circuit flow', short: 'ECMO flow', metric: 'ecmoLpm', unit: 'L/min', digits: 1, surfaces: ['anatomy', 'waveform', 'numeric'], root: true, traces: ['qEcmo'] },
  impellaFlow: { id: 'impellaFlow', label: 'Impella pump flow', short: 'Impella flow', metric: 'impellaLpm', unit: 'L/min', digits: 1, surfaces: ['anatomy', 'waveform', 'numeric'], root: true, traces: ['qImpella'] },
  balloon: { id: 'balloon', label: 'IABP balloon volume in the aorta', short: 'Balloon', metric: 'iabpFill', unit: '', digits: 2, surfaces: ['anatomy', 'waveform'], root: true, traces: ['vBalloon', 'pAo'] },

  arterialVolume: { id: 'arterialVolume', label: 'Arterial blood volume', short: 'Arterial volume', surfaces: ['anatomy'] },
  map: { id: 'map', label: 'Mean arterial pressure', short: 'MAP', metric: 'map', unit: 'mmHg', digits: 0, surfaces: ['waveform', 'numeric'], traces: ['pAo'] },
  svr: { id: 'svr', label: 'Systemic vascular resistance (baroreflex)', short: 'SVR', metric: 'svrWood', unit: 'WU', digits: 1, surfaces: ['numeric'] },
  peakDiastolicP: { id: 'peakDiastolicP', label: 'Peak diastolic aortic pressure', short: 'Diastolic augmentation', metric: 'peakDiastolicP', unit: 'mmHg', digits: 0, surfaces: ['waveform', 'numeric'], traces: ['pAo'] },
  afterload: { id: 'afterload', label: 'LV afterload (aortic pressure at ejection)', short: 'LV afterload', metric: 'aorticEdp', unit: 'mmHg', digits: 0, surfaces: ['waveform', 'pvloop'], traces: ['pAo', 'pLv'], pv: 'esp' },

  nativeSv: { id: 'nativeSv', label: 'Native stroke volume', short: 'Native SV', metric: 'nativeSv', unit: 'mL', digits: 0, surfaces: ['pvloop', 'numeric', 'anatomy'], pv: 'sv' },
  avOpen: { id: 'avOpen', label: 'Aortic valve opening', short: 'AV opening', metric: 'avOpenFraction', unit: '% cycle', digits: 0, surfaces: ['anatomy', 'waveform', 'pvloop', 'numeric'], traces: ['pAo', 'pLv'], pv: 'sv' },
  lvedv: { id: 'lvedv', label: 'LV end-diastolic volume', short: 'LVEDV', metric: 'lvedv', unit: 'mL', digits: 0, surfaces: ['anatomy', 'pvloop', 'numeric'], pv: 'edv' },
  lvedp: { id: 'lvedp', label: 'LV end-diastolic pressure', short: 'LVEDP', metric: 'lvedp', unit: 'mmHg', digits: 0, surfaces: ['pvloop', 'numeric', 'waveform'], traces: ['pLv'], pv: 'edp' },
  lap: { id: 'lap', label: 'Left atrial pressure', short: 'LAP', metric: 'lapMean', unit: 'mmHg', digits: 0, surfaces: ['waveform', 'numeric'], traces: ['pPv'] },
  pva: { id: 'pva', label: 'Pressure-volume area (O₂ demand)', short: 'PVA', metric: 'pva', unit: 'mmHg·mL', digits: 0, surfaces: ['pvloop', 'numeric'], pv: 'area' },
  dpti: { id: 'dpti', label: 'Diastolic pressure-time integral (coronary supply)', short: 'DPTI', metric: 'dpti', unit: 'mmHg·s', digits: 1, surfaces: ['waveform', 'numeric'], traces: ['pAo', 'pLv'] },
  totalFlow: { id: 'totalFlow', label: 'Total systemic flow', short: 'Total flow', metric: 'totalFlowLpm', unit: 'L/min', digits: 1, surfaces: ['anatomy', 'numeric'] },
  lvVolume: { id: 'lvVolume', label: 'LV cavity volume', short: 'LV volume', metric: 'lvedv', unit: 'mL', digits: 0, surfaces: ['anatomy', 'pvloop'], pv: 'edv' },
};

/**
 * Edges. Each is a signed, mechanistic claim about THIS model.
 * Kept small and legible on purpose: a graph nobody can read is not an explanation.
 */
export const EDGES: CausalEdge[] = [
  /* --- VA-ECMO --- */
  { from: 'ecmoFlow', to: 'arterialVolume', sign: 1, mechanism: 'the circuit returns blood retrograde into the aorta' },
  { from: 'arterialVolume', to: 'map', sign: 1, mechanism: 'more volume in a compliant arterial tree raises its pressure' },
  { from: 'ecmoFlow', to: 'totalFlow', sign: 1, mechanism: 'circuit flow adds to whatever the ventricle still ejects' },
  { from: 'map', to: 'afterload', sign: 1, mechanism: 'the ventricle must exceed aortic pressure before it can eject' },
  { from: 'map', to: 'svr', sign: -1, mechanism: 'the baroreflex senses the higher pressure and dilates' },
  { from: 'svr', to: 'map', sign: 1, mechanism: 'dilation lets the same flow generate less pressure (negative feedback)' },
  { from: 'afterload', to: 'nativeSv', sign: -1, mechanism: 'a weak ventricle on a low ESPVR ejects less against a higher pressure' },
  { from: 'afterload', to: 'avOpen', sign: -1, mechanism: 'LV pressure clears the higher aortic pressure for less of the cycle' },
  { from: 'nativeSv', to: 'lvedv', sign: -1, mechanism: 'blood not ejected stays in the ventricle and adds to the next filling' },
  { from: 'lvedv', to: 'lvedp', sign: 1, mechanism: 'on a steep exponential EDPVR, a little more volume is a lot more pressure' },
  { from: 'lvedp', to: 'lap', sign: 1, mechanism: 'the atrium fills against the ventricle it empties into' },
  { from: 'lvedv', to: 'pva', sign: 1, mechanism: 'a larger, higher-pressure loop encloses more potential energy' },
  { from: 'lvedv', to: 'lvVolume', sign: 1, mechanism: 'the cavity is visibly larger' },

  /* --- Impella --- */
  { from: 'impellaFlow', to: 'lvedv', sign: -1, mechanism: 'the pump removes blood from the cavity continuously, including during diastole' },
  { from: 'impellaFlow', to: 'totalFlow', sign: 1, mechanism: 'pump output reaches the aorta whether or not the valve opens' },
  { from: 'impellaFlow', to: 'arterialVolume', sign: 1, mechanism: 'the pump discharges into the ascending aorta' },
  { from: 'impellaFlow', to: 'avOpen', sign: -1, mechanism: 'the emptied ventricle no longer builds enough pressure to open the valve' },
  { from: 'impellaFlow', to: 'nativeSv', sign: -1, mechanism: 'the pump ejects the volume the ventricle would have ejected itself' },

  /* --- IABP --- */
  { from: 'balloon', to: 'peakDiastolicP', sign: 1, mechanism: 'inflation in diastole displaces aortic blood and raises diastolic pressure' },
  { from: 'peakDiastolicP', to: 'dpti', sign: 1, mechanism: 'coronary perfusion pressure is integrated over diastole' },
  { from: 'balloon', to: 'afterload', sign: -1, mechanism: 'deflation just before systole leaves a volume void for the ventricle to eject into' },
  { from: 'balloon', to: 'map', sign: 1, mechanism: 'counterpulsation raises mean pressure despite lowering the systolic peak' },
];

/** Adjacency, built once. */
export const OUT: Record<string, CausalEdge[]> = {};
for (const e of EDGES) (OUT[e.from] ??= []).push(e);

export const ROOTS = Object.values(NODES).filter((n) => n.root).map((n) => n.id);
