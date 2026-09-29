/**
 * E18 — endovascular interior views. Same standard as E13: everything drawn must be
 * a function of simulator state, and the properties the view exists to teach are
 * asserted on the frame the view would paint, not eyeballed.
 *
 * Called from scripts/validate.ts with the harness's own `check`, so these count in
 * the one gating total and appear in validation/report.md like every other check.
 */

import { Sim, type SimSnapshot } from '../model/sim';
import { SHOCK_PATIENT } from '../model/patient';
import { BALLOON_VOLUME_ML, IABP_TIMINGS, type IabpTimingName } from '../model/devices/iabp';
import { DIASTOLE_ACTIVATION } from '../model/constants';
import type { SteadyKey } from '../model/steadyStates';
import { PaneRuntime, TwinEngine } from '../runtime/TwinEngine';
import { coronaryArrowCount, coronaryGradient, coronaryIntegralThisBeat, SLOW_RATE } from './common';
import { BALLOON_R_MAX, balloonRadius, iabpFrame, IABP_INTERIOR_CUM, IABP_INTERIOR_READS, wallRadius, type IabpFrame } from './iabpInterior';

type CheckFn = (exp: string, claim: string, why: string, pass: boolean, observed: string, gating?: boolean) => void;

const EXP = 'E18';
/** Reference lumen radius in px at 1920x1080 (iabpGeom: 0.2 * H). Visibility thresholds are in these px. */
const REF_R_PX = 0.2 * 1080;

const strictlyUp = (xs: number[]) => xs.every((x, i) => i === 0 || x > xs[i - 1]);
const nonDecreasing = (xs: number[]) => xs.every((x, i) => i === 0 || x >= xs[i - 1]);

function fieldCheck(check: CheckFn, reads: Record<string, readonly string[]>, cum: Record<string, string>, view: string) {
  const probe = Sim.fromSnapshot(SHOCK_PATIENT, FRESH!.S1);
  const s = probe.last as unknown as Record<string, unknown>;
  const errs: string[] = [];
  for (const [what, fields] of Object.entries(reads)) {
    for (const f of fields) {
      if (!(f in s)) errs.push(`${what} reads "${f}", which is not a Sample field`);
      else if (typeof s[f] !== 'number') errs.push(`${what}: ${f} is not numeric`);
    }
  }
  for (const [what, k] of Object.entries(cum)) {
    if (!(k in probe.state.cum)) errs.push(`${what} positions from state.cum.${k}, which does not exist`);
  }
  check(
    EXP,
    `${view}: every animated quantity names a real instantaneous simulator field`,
    'no drawn dimension may come from anywhere but the model',
    errs.length === 0,
    errs.join('; ') || Object.entries(reads).map(([k, v]) => `${k}←${v.join('+')}`).join(', ') + '; ' + Object.entries(cum).map(([k, v]) => `${k} position←cum.${v}`).join(', '),
  );
}

let FRESH: Record<SteadyKey, SimSnapshot> | null = null;

/** A settled IABP pane at the given timing, aligned to a beat boundary, recording its trace. */
function iabpPane(t: IabpTimingName): PaneRuntime {
  const sim = Sim.fromSnapshot(SHOCK_PATIENT, FRESH!.S1);
  sim.setSettings({ iabpInflateOffsetMs: IABP_TIMINGS[t].inflate, iabpDeflateOffsetMs: IABP_TIMINGS[t].deflate });
  sim.snapActuators();
  sim.run(30_000);
  while (sim.state.tickInBeat !== 0) sim.tick();
  const pane = new PaneRuntime(sim, t);
  for (let i = 0; i < sim.cycleMs; i++) {
    sim.tick();
    pane.record();
  }
  while (sim.state.tickInBeat !== 0) {
    sim.tick();
    pane.record();
  }
  return pane;
}

interface SeqFrame extends IabpFrame {
  tib: number;
  qAortic: number;
}

/** The interior sequence over one full beat, every 4 ms, exactly as the view would compute it. */
function iabpSequence(pane: PaneRuntime): SeqFrame[] {
  const sim = pane.sim;
  const out: SeqFrame[] = [];
  for (let i = 0; i < sim.cycleMs; i++) {
    if (i % 4 === 0) {
      const f = iabpFrame(sim.last, sim.state, sim.lastBeat, coronaryIntegralThisBeat(pane.trace, sim.last, sim.cycleMs, sim.p));
      out.push({ ...f, tib: sim.state.tickInBeat, qAortic: sim.last.qAortic });
    }
    sim.tick();
    pane.record();
  }
  return out;
}

export function endoChecks(fresh: Record<SteadyKey, SimSnapshot>, check: CheckFn): void {
  FRESH = fresh;

  /* ---------------- IABP, from inside the aorta ---------------- */
  fieldCheck(check, IABP_INTERIOR_READS, IABP_INTERIOR_CUM, 'IABP interior');

  {
    const vols = [0, 1, 2.5, 5, 10, 20, 30, 40];
    const rs = vols.map(balloonRadius);
    check(
      EXP,
      'IABP interior: balloon size is strictly monotonic in vBalloon, zero when empty, full size at full volume',
      'the balloon on screen must be the balloon in the model',
      rs[0] === 0 && strictlyUp(rs) && Math.abs(rs[rs.length - 1] - BALLOON_R_MAX) < 1e-12 && vols[vols.length - 1] === BALLOON_VOLUME_ML,
      vols.map((v, i) => `${v}→${(rs[i] * REF_R_PX).toFixed(0)}px`).join(' '),
    );
  }

  {
    const ps = [20, 35, 50, 65, 80, 95, 110];
    const rs = ps.map(wallRadius);
    check(
      EXP,
      'IABP interior: aortic wall position is strictly monotonic in pressure (diastolic augmentation is displacement)',
      'the pressure rise must be shown as the wall moving, and more pressure must always mean more displacement',
      strictlyUp(rs),
      ps.map((p, i) => `${p}→${(rs[i] * REF_R_PX).toFixed(0)}px`).join(' '),
    );
  }

  {
    const gs = [0, 0.3, 1, 5, 15, 30, 50, 70, 90];
    const cs = gs.map(coronaryArrowCount);
    check(
      EXP,
      'IABP interior: coronary inflow is monotonic non-decreasing in the diastolic gradient and zero at zero gradient',
      'the coronary arrows must be a faithful function of the gradient that drives them',
      cs[0] === 0 && nonDecreasing(cs) && cs[cs.length - 1] > cs[3],
      gs.map((g, i) => `${g}→${cs[i].toFixed(2)}`).join(' '),
    );
  }

  // the gradient drawn is the DPTI integrand the model already computes, not a second formula
  {
    const sim = Sim.fromSnapshot(SHOCK_PATIENT, fresh.S1);
    const pane = new PaneRuntime(sim, 'S1');
    let sum = 0;
    let systolicLeak = 0;
    let traceSum = 0;
    for (let i = 0; i < sim.cycleMs; i++) {
      const g = coronaryGradient(sim.last);
      sum += g * 0.001;
      if (sim.last.activation >= DIASTOLE_ACTIVATION && g !== 0) systolicLeak++;
      pane.record();
      if (i === sim.cycleMs - 1) traceSum = coronaryIntegralThisBeat(pane.trace, sim.last, sim.cycleMs, sim.p);
      sim.tick();
    }
    const dpti = sim.lastBeat!.dpti;
    const relErr = Math.abs(sum - dpti) / dpti;
    check(
      EXP,
      'IABP interior: the coronary drive integrates to the beat\'s reported DPTI (within 2%), and is zero whenever the LV is not in diastole',
      'coronary inflow must come from the diastolic gradient the model already computes, not a separate estimate',
      relErr < 0.02 && systolicLeak === 0,
      `∫drawn gradient ${sum.toFixed(2)} vs DPTI ${dpti.toFixed(2)} mmHg·s (${(100 * relErr).toFixed(2)}%); systolic ticks with drive: ${systolicLeak}`,
    );
    const trErr = Math.abs(traceSum - sum) / sum;
    check(
      EXP,
      'IABP interior: the running coronary integral read from the pane trace matches the tick-by-tick integral (within 3%)',
      'coronary arrow position comes from the recorded trace; it must be the same integral, not an approximation of something else',
      trErr < 0.03,
      `trace ${traceSum.toFixed(2)} vs per-tick ${sum.toFixed(2)} mmHg·s (${(100 * trErr).toFixed(2)}%)`,
    );
  }

  // computing a frame must not touch the simulator
  {
    const pane = iabpPane('correct');
    const before = JSON.stringify(pane.sim.state) + JSON.stringify(pane.sim.last);
    const a = iabpFrame(pane.sim.last, pane.sim.state, pane.sim.lastBeat, coronaryIntegralThisBeat(pane.trace, pane.sim.last, pane.sim.cycleMs, pane.sim.p));
    const b = iabpFrame(pane.sim.last, pane.sim.state, pane.sim.lastBeat, coronaryIntegralThisBeat(pane.trace, pane.sim.last, pane.sim.cycleMs, pane.sim.p));
    const after = JSON.stringify(pane.sim.state) + JSON.stringify(pane.sim.last);
    check(
      EXP,
      'IABP interior: computing a frame leaves the simulator untouched, and the same state gives the same frame',
      'a view that wrote to the model, or drifted while it was paused, would own a clock of its own',
      before === after && JSON.stringify(a) === JSON.stringify(b),
      before === after ? 'state unchanged; frames identical' : 'STATE MUTATED',
    );
  }

  // the four mistimings each produce a visibly different interior sequence
  {
    const names = Object.keys(IABP_TIMINGS) as IabpTimingName[];
    const seqs = Object.fromEntries(names.map((n) => [n, iabpSequence(iabpPane(n))])) as Record<IabpTimingName, SeqFrame[]>;

    /** Largest on-screen difference between two sequences at matching phase, px, plus collision frames that differ. */
    const distance = (a: SeqFrame[], b: SeqFrame[]) => {
      let px = 0;
      let coll = 0;
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        px = Math.max(px, Math.abs(a[i].balloonR - b[i].balloonR) * REF_R_PX, Math.abs(a[i].descR - b[i].descR) * REF_R_PX);
        if (a[i].collision !== b[i].collision) coll++;
      }
      return { px, collMs: coll * 4 };
    };
    const pairs: string[] = [];
    let worst = Infinity;
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const d = distance(seqs[names[i]], seqs[names[j]]);
        const score = d.px;
        worst = Math.min(worst, score);
        pairs.push(`${names[i]}/${names[j]} ${d.px.toFixed(0)}px`);
      }
    }
    check(
      EXP,
      'IABP interior: correct timing and all four mistimings produce pairwise different interior sequences (≥ 12 px at 1080p somewhere in the beat)',
      'if two timings looked the same from inside the vessel, the view could not teach the difference',
      worst >= 12,
      `smallest pairwise difference ${worst.toFixed(0)} px; ` + pairs.join(', '),
    );

    // and each one differs in the way the textbook describes
    const collisionFrames = (sq: SeqFrame[]) => sq.filter((f) => f.collision);
    const openFrames = (sq: SeqFrame[]) => sq.filter((f) => f.qAortic > 0);
    const openStart = (sq: SeqFrame[]) => openFrames(sq)[0]?.tib ?? NaN;
    const openEnd = (sq: SeqFrame[]) => openFrames(sq).at(-1)?.tib ?? NaN;
    const half = BALLOON_R_MAX * Math.SQRT1_2; // half volume
    /** first frame after valve closure with the balloon at least half full */
    const inflateAt = (sq: SeqFrame[]) => sq.find((f) => f.tib > openEnd(sq) - 60 && f.balloonR >= half)?.tib ?? NaN;
    /** empty time before the valve opens, ms: counted back from valve opening, wrapping into the
     *  previous beat (the sequence is a settled steady state, so the previous beat is the same) */
    const emptyBeforeOpen = (sq: SeqFrame[]) => {
      const k0 = sq.findIndex((f) => f.qAortic > 0);
      let n = 0;
      for (let j = 1; j < sq.length; j++) {
        const f = sq[(k0 - j + sq.length) % sq.length];
        if (f.balloonR * REF_R_PX < 2) n += 4;
        else break;
      }
      return n;
    };

    const c = seqs.correct;
    check(EXP, 'IABP interior, correct timing: the balloon is never drawn inflated while the valve is open', 'the reference sequence has no collision', collisionFrames(c).length === 0, `${collisionFrames(c).length * 4} ms of collision`);

    const ei = seqs.earlyInflation;
    const eiColl = collisionFrames(ei);
    const eiMid = (openStart(ei) + openEnd(ei)) / 2;
    check(
      EXP,
      'IABP interior, early inflation: the balloon is drawn inflating while the valve is still open, at the END of ejection',
      'inflating against the ejecting LV is the error; from inside it must be visible as the balloon filling before the leaflets have shut',
      eiColl.length > 0 && eiColl.every((f) => f.tib > eiMid),
      `${eiColl.length * 4} ms of collision at ${eiColl.length ? `${eiColl[0].tib}-${eiColl.at(-1)!.tib}` : '-'} ms; ejection ${openStart(ei)}-${openEnd(ei)} ms`,
    );

    const ld = seqs.lateDeflation;
    const ldColl = collisionFrames(ld);
    const ldMid = (openStart(ld) + openEnd(ld)) / 2;
    check(
      EXP,
      'IABP interior, late deflation: the balloon is drawn still inflated as the valve opens, at the START of ejection',
      'the LV opening against a still-full balloon is the error; it must be visible at the other end of systole from early inflation',
      ldColl.length > 0 && ldColl.every((f) => f.tib < ldMid),
      `${ldColl.length * 4} ms of collision at ${ldColl.length ? `${ldColl[0].tib}-${ldColl.at(-1)!.tib}` : '-'} ms; ejection ${openStart(ld)}-${openEnd(ld)} ms`,
    );

    const li = seqs.lateInflation;
    const liDelay = inflateAt(li) - openEnd(li);
    const cDelay = inflateAt(c) - openEnd(c);
    check(
      EXP,
      'IABP interior, late inflation: the balloon fills visibly later after valve closure than with correct timing (≥ 50 ms)',
      'the lost early-diastolic window is the error; from inside it is an empty balloon after the leaflets have shut',
      liDelay - cDelay >= 50,
      `closure→half-full ${liDelay} ms vs correct ${cDelay} ms`,
    );

    const ed = seqs.earlyDeflation;
    check(
      EXP,
      'IABP interior, early deflation: the balloon is drawn empty for visibly longer before the valve opens than with correct timing (≥ 100 ms)',
      'deflating early wastes the pre-ejection pressure drop; from inside it is an empty balloon well before ejection',
      emptyBeforeOpen(ed) - emptyBeforeOpen(c) >= 100,
      `empty before opening ${emptyBeforeOpen(ed)} ms vs correct ${emptyBeforeOpen(c)} ms`,
    );
  }
  // slow motion, used to film the mistimed beat, must change only the ticks per frame
  {
    const N = 6_000;
    const real = new TwinEngine('S1', 'S1');
    real.autoCompress = false;
    real.applyRight({ iabpInflateOffsetMs: IABP_TIMINGS.earlyInflation.inflate }, 'early');
    real.stepTicks(N);
    const slow = new TwinEngine('S1', 'S1');
    slow.autoCompress = false;
    slow.applyRight({ iabpInflateOffsetMs: IABP_TIMINGS.earlyInflation.inflate }, 'early');
    slow.speed = SLOW_RATE;
    let frames = 0;
    while (slow.tick < N) {
      if (N - slow.tick < 4) slow.stepTicks(N - slow.tick);
      else slow.frame(1000 / 60);
      frames++;
    }
    const same =
      JSON.stringify(real.right.sim.state) === JSON.stringify(slow.right.sim.state) &&
      JSON.stringify(real.right.sim.last) === JSON.stringify(slow.right.sim.last) &&
      JSON.stringify(real.left.sim.state) === JSON.stringify(slow.left.sim.state);
    const overlapFrames = 20 / ((1000 / 60) * SLOW_RATE);
    check(
      EXP,
      `IABP interior: slow motion (${SLOW_RATE}×) reaches a bit-identical state to real time, and holds the 20 ms mistiming overlap for ≥ 8 frames at 60 fps`,
      'the mistimed beat must be filmable without the physiology being touched; like compression, only ticks per frame change',
      same && overlapFrames >= 8,
      `${N} ticks in ${frames} frames: ${same ? 'identical state' : 'STATE DIFFERS'}; 20 ms overlap = ${overlapFrames.toFixed(1)} frames`,
    );
  }
}
