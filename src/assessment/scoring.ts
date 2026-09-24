import { CONSTRUCT_LABEL, HEADLINE_COMPETENCY, type Construct } from './itemBank';
import type { Session } from './sessionStore';

export interface ConstructScore {
  construct: Construct;
  label: string;
  n: number;
  predictionCorrect: number;
  mechanismCorrect: number;
}

export interface Scorecard {
  byConstruct: ConstructScore[];
  headline: {
    label: string;
    n: number;
    correct: number;
    pct: number;
    /**
     * The defining dissociation: predicted BOTH that VA-ECMO raises MAP and that it
     * lowers native stroke volume. Both halves are evidence-backed and robust to the
     * preload/afterload balance, unlike LVEDP (see itemBank: ecmo-lvedp, retired).
     */
    keyPair: 'both-correct' | 'missed' | 'not-attempted';
  };
  predictionPct: number;
  mechanismPct: number;
  medianLatencyMs: number;
}

export function score(s: Session): Scorecard {
  const by = new Map<Construct, ConstructScore>();
  for (const r of s.responses) {
    const c = r.construct as Construct;
    const e = by.get(c) ?? { construct: c, label: CONSTRUCT_LABEL[c] ?? c, n: 0, predictionCorrect: 0, mechanismCorrect: 0 };
    e.n++;
    if (r.predictionCorrect) e.predictionCorrect++;
    if (r.mechanismCorrect) e.mechanismCorrect++;
    by.set(c, e);
  }
  const comp = s.responses.filter((r) => r.competencyItem);
  const compCorrect = comp.filter((r) => r.predictionCorrect).length;
  const map = s.responses.find((r) => r.itemId === 'ecmo-map');
  const sv = s.responses.find((r) => r.itemId === 'ecmo-sv');
  const keyPair = !map || !sv ? 'not-attempted' : map.predictionCorrect && sv.predictionCorrect ? 'both-correct' : 'missed';
  const n = s.responses.length;
  const lat = s.responses.map((r) => r.latencyMs).sort((a, b) => a - b);
  return {
    byConstruct: [...by.values()],
    headline: {
      label: HEADLINE_COMPETENCY,
      n: comp.length,
      correct: compCorrect,
      pct: comp.length ? (100 * compCorrect) / comp.length : 0,
      keyPair,
    },
    predictionPct: n ? (100 * s.responses.filter((r) => r.predictionCorrect).length) / n : 0,
    mechanismPct: n ? (100 * s.responses.filter((r) => r.mechanismCorrect).length) / n : 0,
    medianLatencyMs: lat.length ? lat[Math.floor(lat.length / 2)] : 0,
  };
}
