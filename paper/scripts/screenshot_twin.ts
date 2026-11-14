/**
 * Figure 1B: twin-pane screenshot of the shipped single-file app (release/CardioFlow-MCS.html),
 * S3 (VA-ECMO 4) in pane A vs S4 (ECMO 4 + Impella P5) in pane B, captured after the panes settle.
 * Usage: npx tsx paper/scripts/screenshot_twin.ts   (run from the repo root)
 */
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--window-size=1920,1080'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(resolve('release/CardioFlow-MCS.html')).href);
  await sleep(2500);
  await page.keyboard.press('c'); await sleep(1500);
  await page.keyboard.press('4'); await sleep(9000);
  await page.keyboard.press('5'); await sleep(150000);
  await page.screenshot({ path: 'paper/results/figs/twin_pane_s3_s4.png' });
  await browser.close();
  console.log('saved');
})();
