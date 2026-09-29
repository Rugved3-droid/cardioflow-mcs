/**
 * Screenshots of the interior views, driven through the built app exactly as a user
 * would: number keys for the state, I for the view, the view's own timing selector.
 * Usage: npx tsx src/endo/shot.ts <iabp|impella>
 * Kept separate from scripts/shot.ts so that script is untouched.
 */
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const scenario = process.argv[2] ?? 'iabp';
const W = 1920, H = 1080;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  mkdirSync('shots', { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: [`--window-size=${W},${H}`] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  await page.goto(pathToFileURL(resolve('release/CardioFlow-MCS.html')).href);
  await sleep(2500);
  const shot = async (name: string) => { await page.screenshot({ path: `shots/endo-${scenario}-${name}.png` }); console.log('shot', name); };
  /** a burst across roughly one and a half cardiac cycles (600 ms at HR 100) */
  const burst = async (name: string, n = 7, gap = 97) => { for (let i = 0; i < n; i++) { await shot(`${name}-${i}`); await sleep(gap); } };

  if (scenario === 'iabp') {
    await page.keyboard.press('i');
    await sleep(600);
    await shot('0-nodevice');
    await page.keyboard.press('i');
    await page.keyboard.press('2'); // S1 IABP
    await sleep(12000);
    await page.keyboard.press('i');
    await sleep(1200);
    await burst('1-correct');
    for (const t of ['earlyInflation', 'lateInflation', 'earlyDeflation', 'lateDeflation']) {
      await page.select('.endo-ctl select', t);
      await sleep(12000);
      await burst(`2-${t}`);
    }
    // slow motion on the last mistiming: one full beat at 1/8 is ~4.8 s of wall time
    await page.keyboard.press('s');
    await sleep(1500);
    for (let i = 0; i < 40; i++) await shot(`3-slow-lateDeflation-${String(i).padStart(2, '0')}`);
    await page.keyboard.press('s');
  } else if (scenario === 'impella') {
    await page.keyboard.press('3'); // S2 Impella P8, from S0 in solo: swaps in place
    await sleep(1500);
    await page.keyboard.press('i');
    await sleep(200);
    await shot('0-s2-early');
    await sleep(3000);
    await shot('1-s2-mid');
    await sleep(9000);
    await burst('2-s2-settled');
    await page.keyboard.press('i');
    await page.keyboard.press('4'); // S3 VA-ECMO
    await sleep(14000);
    await page.keyboard.press('5'); // S4 ECpella P5
    await sleep(1200);
    await page.keyboard.press('i');
    await sleep(14000);
    await burst('3-s4-p5', 8, 90);
  }
  if (errors.length) console.log('CONSOLE:\n' + errors.join('\n'));
  await browser.close();
})();
