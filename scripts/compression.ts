/**
 * Does stepping more ticks per rendered frame change anything?
 *
 * The claim under test: the tick is fixed at 1 ms and the sequence of ticks is
 * identical regardless of how they are chunked across frames, so the state after
 * K ticks must be bit-identical however those K ticks were distributed. If that
 * holds, time compression is a rendering decision, not a physiological one.
 *
 * Also measures throughput, because a rate the machine cannot sustain would drop
 * frames rather than compress time.
 */
import { createHash } from 'node:crypto';
import { TwinEngine } from '../src/runtime/TwinEngine';
import { THERAPY_STATES } from '../src/model/therapyStates';

const TOTAL = 120_000; // 120 s of simulated time

function runChunked(chunk: number): { hash: string; bits: string; beats: number } {
  const eng = new TwinEngine('S0', 'S0');
  eng.applyRight(THERAPY_STATES.S3.settings, 'S3');
  const h = createHash('sha256');
  let beats = 0;
  eng.left.sim.onBeat = (m) => {
    h.update(JSON.stringify(m));
    beats++;
  };
  eng.right.sim.onBeat = (m) => h.update(JSON.stringify(m));
  let done = 0;
  while (done < TOTAL) {
    const n = Math.min(chunk, TOTAL - done);
    eng.stepTicks(n);
    done += n;
  }
  // exact bit pattern of the final state of both panes
  const f = new Float64Array([
    eng.left.sim.state.v.lv, eng.left.sim.state.v.sa, eng.left.sim.state.svr, eng.left.sim.last.pAo,
    eng.right.sim.state.v.lv, eng.right.sim.state.v.sa, eng.right.sim.state.svr, eng.right.sim.last.pAo,
    eng.right.sim.state.cum.ecmo, eng.right.sim.state.cum.aortic,
  ]);
  h.update(Buffer.from(f.buffer));
  return { hash: h.digest('hex'), bits: Buffer.from(f.buffer).toString('hex'), beats };
}

console.log('DETERMINISM UNDER CHUNKING');
console.log('Each row runs the same 120 s of simulated time, chunked as a different number of');
console.log('ticks per rendered frame. 17 ticks/frame ~ 1x at 60 fps; 133 ~ 8x.\n');
const chunks = [1, 17, 34, 67, 133, 267, 800];
const results = chunks.map((c) => ({ c, ...runChunked(c) }));
const ref = results[0];
console.log('ticks/frame | ~rate at 60fps |  beats | final-state bits identical | beat hash identical');
for (const r of results) {
  console.log(
    String(r.c).padStart(11),
    '|',
    `${(r.c / 16.67).toFixed(1)}x`.padStart(14),
    '|',
    String(r.beats).padStart(6),
    '|',
    (r.bits === ref.bits ? 'YES' : 'NO  <<< DIFFERS').padStart(26),
    '|',
    r.hash === ref.hash ? 'YES' : 'NO  <<< DIFFERS',
  );
}
const allSame = results.every((r) => r.bits === ref.bits && r.hash === ref.hash);
console.log(`\n=> ${allSame ? 'IDENTICAL at every chunk size.' : 'DIVERGENCE DETECTED.'}`);

console.log('\nTHROUGHPUT (two panes stepped in lockstep)');
for (const warm of [0, 1]) {
  const eng = new TwinEngine('S0', 'S0');
  eng.applyRight(THERAPY_STATES.S3.settings, 'S3');
  const t0 = process.hrtime.bigint();
  eng.stepTicks(60_000);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (warm) {
    const perTick = ms / 60_000;
    console.log(`  60,000 ticks in ${ms.toFixed(0)} ms  =>  ${(perTick * 1000).toFixed(1)} us/tick, ${Math.round(1000 / perTick).toLocaleString()} ticks/s`);
    for (const rate of [1, 2, 4, 6, 8, 12]) {
      const ticksPerFrame = (1000 / 60) * rate;
      const budgetUse = (ticksPerFrame * perTick) / (1000 / 60);
      console.log(`    ${String(rate).padStart(2)}x -> ${ticksPerFrame.toFixed(0).padStart(4)} ticks/frame, ${(budgetUse * 100).toFixed(0).padStart(3)}% of a 16.7 ms frame budget${budgetUse > 0.55 ? '   <-- too tight' : ''}`);
    }
  }
}
