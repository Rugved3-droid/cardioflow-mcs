/** Regenerate src/model/steadyStates.json. Run after any model or patient change. */
import { writeFileSync } from 'node:fs';
import { computeAllSteadyStates } from '../src/model/steadyStates';

const snaps = computeAllSteadyStates();
writeFileSync('src/model/steadyStates.json', JSON.stringify(snaps) + '\n');
for (const [k, s] of Object.entries(snaps)) {
  const m = s.lastBeat!;
  console.log(k.padEnd(6), `MAP ${m.map.toFixed(1)}  LVEDP ${m.lvedp.toFixed(1)}  total ${m.totalFlowLpm.toFixed(2)} L/min`);
}
console.log('wrote src/model/steadyStates.json');
