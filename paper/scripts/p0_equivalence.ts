/**
 * Phase 0 / rule 5: the headless runner reproduces the browser engine.
 *
 *  A. Node (headless runner) vs Chrome (browser V8): the shipped model source, bundled by
 *     esbuild exactly as a browser loads it, runs the 9-scenario battery inside headless
 *     Chrome; the same battery runs in Node. Every beat's 16 headline metrics + final
 *     volumes are compared. Criterion: max relative error <= 1e-6.
 *  B. Knob variant (paper/runner/variant) at default knobs vs shipped model: bitwise.
 *  C. The release build (release/CardioFlow-MCS.html) starts every pane from the
 *     steady-state snapshots in src/model/steadyStates.json. Check (i) a fresh Node
 *     recomputation equals the shipped JSON bitwise, (ii) every number in the JSON
 *     appears verbatim in the release HTML (i.e. the release ships these exact states),
 *     (iii) the release HTML was built after the last commit touching src/model.
 *
 * Output: paper/results/p0_equivalence.csv, paper/results/p0_equivalence.json
 */
import { build } from 'esbuild';
import puppeteer from 'puppeteer-core';
import { readFileSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { runEquivBattery, EQUIV_SCENARIOS } from '../runner/equiv_scenarios';
import { Sim as VariantSim } from '../runner/variant/sim';
import { Sim } from '../../src/model/sim';
import { NO_DEVICE, SHOCK_PATIENT } from '../../src/model/patient';
import { computeAllSteadyStates } from '../../src/model/steadyStates';
import shipped from '../../src/model/steadyStates.json';
import { resetKnobs } from '../runner/core';
import { relErr, writeCsv, writeJson } from '../runner/io';

const ROOT = join(import.meta.dirname, '..', '..');
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function chromeBattery(): Promise<{ res: Record<string, number[]>; ua: string }> {
  const b = await build({
    entryPoints: [join(ROOT, 'paper/runner/browser_entry.ts')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    write: false,
    target: 'es2020',
  });
  const code = b.outputFiles[0].text;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('about:blank');
    await page.addScriptTag({ content: code });
    const ua = await browser.version();
    const res = (await page.evaluate(() => (globalThis as any).__runEquiv())) as Record<string, number[]>;
    return { res, ua };
  } finally {
    await browser.close();
  }
}

function variantBattery(): Record<string, number[]> {
  resetKnobs();
  const FIELDS = ['map', 'sbp', 'dbp', 'lvedp', 'lvedv', 'lvesv', 'ef', 'nativeSv', 'totalFlowLpm', 'impellaLpm', 'ecmoLpm', 'avOpenFractionRaw', 'pva', 'dpti', 'lapMean', 'svr'] as const;
  const out: Record<string, number[]> = {};
  for (const [name, set] of Object.entries(EQUIV_SCENARIOS)) {
    const sim = new VariantSim(SHOCK_PATIENT, NO_DEVICE);
    const trace: number[] = [];
    sim.onBeat = (m) => {
      for (const f of FIELDS) trace.push(m[f] as number);
    };
    sim.run(90_000);
    sim.setSettings(set);
    sim.run(120_000);
    const v = sim.state.v;
    trace.push(v.lv, v.rv, v.ao, v.sa, v.sv, v.pa, v.pv);
    out[name] = trace;
  }
  return out;
}

function compare(a: Record<string, number[]>, b: Record<string, number[]>) {
  const rows = [];
  for (const k of Object.keys(a)) {
    const x = a[k], y = b[k];
    let maxRel = 0, nDiff = 0;
    if (x.length !== y.length) throw new Error(`${k}: length ${x.length} vs ${y.length}`);
    for (let i = 0; i < x.length; i++) {
      if (!Object.is(x[i], y[i])) nDiff++;
      maxRel = Math.max(maxRel, relErr(x[i], y[i], 1e-9));
    }
    rows.push({ scenario: k, n_values: x.length, n_not_bit_identical: nDiff, max_rel_err: maxRel });
  }
  return rows;
}

function flattenNumbers(o: unknown, acc: number[] = []): number[] {
  if (typeof o === 'number') acc.push(o);
  else if (Array.isArray(o)) o.forEach((v) => flattenNumbers(v, acc));
  else if (o && typeof o === 'object') Object.values(o).forEach((v) => flattenNumbers(v, acc));
  return acc;
}

async function main() {
  const t0 = Date.now();
  const node = runEquivBattery();
  const { res: chrome, ua } = await chromeBattery();
  const ab = compare(node, chrome).map((r) => ({ test: 'A_node_vs_chrome', ...r }));
  const variant = variantBattery();
  const bb = compare(node, variant).map((r) => ({ test: 'B_variant_vs_shipped', ...r }));

  // C. snapshots
  const fresh = computeAllSteadyStates();
  const freshNums = flattenNumbers(JSON.parse(JSON.stringify(fresh)));
  const shippedNums = flattenNumbers(shipped);
  let cDiff = freshNums.length === shippedNums.length ? 0 : -1;
  if (cDiff === 0) for (let i = 0; i < freshNums.length; i++) if (!Object.is(freshNums[i], shippedNums[i])) cDiff++;
  const html = readFileSync(join(ROOT, 'release/CardioFlow-MCS.html'), 'utf8');
  // only non-trivial values (integers/zeros/flags are uninformative as substrings)
  const informative = shippedNums.filter((v) => !Number.isInteger(v));
  // the minifier rewrites literals (0.94 -> .94, 3.5e-37 -> 35e-38), so compare parsed values
  const literals = new Set((html.match(/\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number));
  const missing = informative.filter((v) => !literals.has(Math.abs(v)));
  const releaseMtime = statSync(join(ROOT, 'release/CardioFlow-MCS.html')).mtime.toISOString();
  const lastModelCommit = execSync('git log -1 --format=%cI -- src/model', { cwd: ROOT }).toString().trim();
  const cRows = [
    { test: 'C_snapshot_recompute_vs_shipped_json', scenario: 'all 7 snapshots', n_values: shippedNums.length, n_not_bit_identical: cDiff, max_rel_err: '' },
    { test: 'C_snapshot_values_present_in_release_html', scenario: 'all 7 snapshots', n_values: informative.length, n_not_bit_identical: missing.length, max_rel_err: '' },
  ];

  const allA = Math.max(...ab.map((r) => r.max_rel_err));
  const allB = bb.reduce((s, r) => s + r.n_not_bit_identical, 0);
  writeCsv('p0_equivalence.csv', [...ab, ...bb, ...cRows]);
  const summary = {
    script: 'paper/scripts/p0_equivalence.ts',
    node: process.version,
    chrome: ua,
    criterion: 'max relative error <= 1e-6',
    A_node_vs_chrome_max_rel_err: allA,
    A_pass: allA <= 1e-6,
    A_bit_identical: ab.every((r) => r.n_not_bit_identical === 0),
    B_variant_vs_shipped_values_not_bit_identical: allB,
    C_snapshot_recompute_values_not_bit_identical: cDiff,
    C_snapshot_values_missing_from_release_html: missing.length,
    release_html_mtime: releaseMtime,
    last_commit_touching_src_model: lastModelCommit,
    release_newer_than_model: new Date(releaseMtime) > new Date(lastModelCommit),
    runtime_s: (Date.now() - t0) / 1000,
  };
  writeJson('p0_equivalence.json', summary);
  console.log(summary);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
