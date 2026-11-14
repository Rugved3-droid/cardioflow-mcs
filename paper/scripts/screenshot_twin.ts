/**
 * Figure 1B source: compare-mode screenshot of the shipped app (release/CardioFlow-MCS.html), pane A = S3 (VA-ECMO 4),
 * pane B = S4 (ECMO 4 + Impella P5), captured after settling, at 3x device scale. Also dumps the bounding box and
 * computed font size of every visible text element (twin_pane_text.json) so the figure crop can guarantee >= 12 pt print size.
 * Usage (repo root): npx tsx paper/scripts/screenshot_twin.ts
 */
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--window-size=1920,1080'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 3 });
  await page.goto(pathToFileURL(resolve('release/CardioFlow-MCS.html')).href);
  await sleep(2500);
  await page.keyboard.press('c'); await sleep(1500);
  await page.keyboard.press('4'); await sleep(9000);
  await page.keyboard.press('5'); await sleep(150000);
  await page.screenshot({ path: 'paper/results/figs/twin_pane_s3_s4.png' });
  const texts = await page.evaluate(() => {
    const out: { x: number; y: number; w: number; h: number; fs: number; t: string }[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const t = (n.textContent ?? '').trim(); if (!t) continue;
      const el = n.parentElement!; const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      const rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) continue;
      out.push({ x: r.left, y: r.top, w: r.width, h: r.height, fs: parseFloat(cs.fontSize), t: t.slice(0, 40) });
    }
    // SVG text too
    document.querySelectorAll('svg text').forEach((e) => {
      const r = (e as SVGGraphicsElement).getBoundingClientRect(); const fs = parseFloat(getComputedStyle(e).fontSize);
      if (r.width > 0) out.push({ x: r.left, y: r.top, w: r.width, h: r.height, fs, t: (e.textContent ?? '').slice(0, 40) });
    });
    return out;
  });
  writeFileSync('paper/results/figs/twin_pane_text.json', JSON.stringify(texts));
  await browser.close();
  console.log('saved', texts.length, 'text items');
})();
