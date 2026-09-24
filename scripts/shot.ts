/**
 * Dev visual check: drive the built single-file app in the installed Chrome,
 * press keys / click, capture screenshots + console errors.
 * Usage: npx tsx scripts/shot.ts <scenario>
 */
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const scenario = process.argv[2] ?? 'explore';
const W = +(process.env.W ?? 1920), H = +(process.env.H ?? 1080);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: [`--window-size=${W},${H}`] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  await page.goto(pathToFileURL(resolve('release/CardioFlow-MCS.html')).href);
  await sleep(2500);
  const shot = async (name: string) => { await page.screenshot({ path: `shots/${scenario}-${name}.png` }); console.log('shot', name); };
  const clickText = async (t: string) => {
    const ok = await page.evaluate((t) => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim().startsWith(t)) as HTMLButtonElement | undefined;
      if (b && !b.disabled) { b.click(); return true; } return false;
    }, t);
    if (!ok) throw new Error('button not found/enabled: ' + t);
  };

  if (scenario === 'explore') {
    await shot('0-s0');
    await page.keyboard.press('4'); await sleep(9000); await shot('1-s3');
    await page.keyboard.press('5'); await sleep(9000); await shot('2-s4');
    await page.keyboard.press('2'); await sleep(6000); await shot('3-iabp');
  } else if (scenario === 'assess') {
    await clickText('Resident session'); await sleep(500);
    await clickText('Start session'); await sleep(1500); await shot('0-question');
    for (let i = 0; i < 10; i++) {
      await clickText(i % 3 === 0 ? 'Fall' : 'Rise').catch(async () => clickText('Opens less').catch(() => clickText('Closes earlier')));
      await clickText('Lock answer');
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent === 'Lock' ), { timeout: 30000 });
      if (i === 5) await shot('1-revealed');
      await page.evaluate(() => (document.querySelector('.btn.mech') as HTMLButtonElement).click());
      await clickText('Lock');
      await sleep(200);
      if (i === 5) await shot('2-mech');
      if (process.env.STOP && i === +process.env.STOP) { await shot('stop'); break; }
      await clickText(i < 9 ? 'Next item' : 'Finish');
      await sleep(300);
    }
    await sleep(500); await shot('3-scorecard');
    const stored = await page.evaluate(() => localStorage.getItem('cardioflow-mcs.sessions.v1'));
    console.log('stored bytes', stored?.length, 'responses', JSON.parse(stored!)[0].responses.length);
  }
  console.log(errors.length ? 'CONSOLE:\n' + errors.join('\n') : 'no console errors');
  await browser.close();
})();
