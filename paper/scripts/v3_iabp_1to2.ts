/** V3 supplement: IABP 1:2 has a 2-beat limit cycle, so report both beats and their mean.
 * Output: paper/results/v3_iabp_1to2.csv */
import { runScenario, settingsOf, pick } from '../runner/core';
import { writeCsv } from '../runner/io';
const sim = runScenario(settingsOf({ iabpOn: true, iabpRatio: 2 }));
const a = pick(sim.lastBeat!); const aBeat = sim.lastBeat!.beat;
sim.run(sim.cycleMs); const b = pick(sim.lastBeat!); const bBeat = sim.lastBeat!.beat;
const mean = Object.fromEntries(Object.keys(a).map(k => [k, ((a as any)[k] + (b as any)[k]) / 2]));
writeCsv('v3_iabp_1to2.csv', [{ row: `beat ${aBeat} (${aBeat % 2 === 0 ? 'assisted' : 'unassisted'})`, ...a }, { row: `beat ${bBeat} (${bBeat % 2 === 0 ? 'assisted' : 'unassisted'})`, ...b }, { row: 'two-beat mean', ...mean }]);
console.log(a.map, b.map, (mean as any).map, (mean as any).totalFlowLpm, (mean as any).lvedp);
