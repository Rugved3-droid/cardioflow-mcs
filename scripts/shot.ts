/**
 * Dev visual check: drive the built single-file app in the installed Chrome,
 * press keys / click, capture screenshots + console errors.
 * Usage: npx tsx scripts/shot.ts <scenario>
 */
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
import { ACTIVE_ITEMS } from '../src/assessment/itemBank';
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
  } else if (scenario === 'why') {
    const READ = '(function(){var panes=document.querySelectorAll(\'.pane\');var b=panes[panes.length-1];var nums=Array.prototype.slice.call(b.querySelectorAll(\'.num\'));var want=[\'MAP\',\'LVEDP\',\'Native SV\',\'LVEDV\'];var out={};for(var i=0;i<want.length;i++){for(var j=0;j<nums.length;j++){var k=nums[j].querySelector(\'.k\');if(k&&k.textContent.indexOf(want[i])===0){out[want[i]]=nums[j].querySelector(\'.v\').textContent.trim();break;}}}var chain=Array.prototype.map.call(document.querySelectorAll(\'.cstep\'),function(c){return c.textContent.trim();});return {tiles:out,chain:chain,settling:!!document.querySelector(\'.settling\')};})()';
    const CLICK = '(function(){var panes=document.querySelectorAll(\'.pane\');var b=panes[panes.length-1];var nums=Array.prototype.slice.call(b.querySelectorAll(\'.num\'));for(var j=0;j<nums.length;j++){var k=nums[j].querySelector(\'.k\');if(k&&k.textContent.indexOf(\'LVEDP\')===0){var btn=nums[j].querySelector(\'.why\');if(btn){btn.click();return true;}}}return false;})()';
    type Pair = { tiles: Record<string, string>; chain: string[]; settling: boolean };
    const report = async (when: string) => {
      const r = (await page.evaluate(READ)) as Pair;
      console.log(when + '  settling badge: ' + r.settling);
      console.log('  tiles: ' + JSON.stringify(r.tiles));
      console.log('  chain: ' + r.chain.join('  |  '));
      return r;
    };

    await page.keyboard.press('4');
    await sleep(15000);
    await page.evaluate(CLICK);
    await sleep(2200);
    await shot('1-transient');
    await report('AT ~17s ');

    await sleep(45000);
    await page.evaluate(CLICK);
    await sleep(2200);
    await shot('2-settled');
    await report('AT ~62s ');
  } else if (scenario === 'plane') {
    await page.keyboard.press('4');
    await sleep(20000);
    await shot('0-s3-midtransit');
    await sleep(30000);
    await page.keyboard.press('5');
    await sleep(25000);
    await page.keyboard.press('p');
    await sleep(900);
    await shot('1-overlay-trail');
    await sleep(30000);
    await shot('2-overlay-settled');
  } else if (scenario === 'anat') {
    await shot('0-s0');
    await page.keyboard.press('4');
    await sleep(48000);
    await shot('1-s3');
    await page.keyboard.press('5');
    await sleep(40000);
    await shot('2-s4');
    await page.keyboard.press('a');
    await sleep(900);
    await shot('3-overlay');
    await page.keyboard.press('a');
    await sleep(400);
    await page.keyboard.press('2');
    await sleep(35000);
    await shot('4-iabp');
  } else if (scenario === 'anatwhy') {
    const CLICK = '(function(){var panes=document.querySelectorAll(".pane");var b=panes[panes.length-1];var nums=Array.prototype.slice.call(b.querySelectorAll(".num"));for(var j=0;j<nums.length;j++){var k=nums[j].querySelector(".k");if(k&&k.textContent.indexOf("LVEDP")===0){var btn=nums[j].querySelector(".why");if(btn){btn.click();return true;}}}return false;})()';
    await page.keyboard.press('4');
    await sleep(50000);
    await page.evaluate(CLICK);
    await sleep(700);
    await shot('0-step1-ecmo');
    await sleep(700);
    await shot('1-step3-map');
    await sleep(1400);
    await shot('2-final-lvedp');
  } else if (scenario === 'compress') {
    const READ = '(function(){var b=document.querySelector(".ffwd");var s=document.querySelector(".settling");var c=document.querySelector(".clock b");return {ff:b?b.textContent.trim():null,settling:!!s,simT:c?c.textContent:null};})()';
    const t0 = Date.now();
    await page.keyboard.press('4');
    await sleep(600);
    const early = await page.evaluate(READ) as { ff: string | null; simT: string | null };
    console.log('just after keypress: badge =', JSON.stringify(early.ff), ' simT =', early.simT);
    await shot('0-compressing');
    let endWall = -1;
    for (let i = 0; i < 120; i++) {
      await sleep(500);
      const r = (await page.evaluate(READ)) as { ff: string | null; simT: string | null };
      if (!r.ff) { endWall = Date.now() - t0; console.log('compression ended after', (endWall / 1000).toFixed(1), 's wall clock, at simT', r.simT); break; }
    }
    if (endWall < 0) console.log('COMPRESSION NEVER ENDED');
    await shot('1-settled');
    const after = await page.evaluate(READ) as { settling: boolean };
    console.log('equilibrating badge still showing:', after.settling);
  } else if (scenario === 'demo') {
    const READ = '(function(){var b=document.querySelector(".demo-badge");var c=document.querySelector(".caption-bar");var f=document.querySelector(".ffwd");var s=document.querySelector(".settling");var ch=document.querySelectorAll(".cstep").length;return {badge:b?b.textContent.trim():null,cap:c?c.textContent.trim():"",ff:!!f,settling:!!s,chain:ch};})()';
    const t0 = Date.now();
    await page.keyboard.press('d');
    const seen: string[] = [];
    let violations = 0;
    let shots = 0;
    for (let i = 0; i < 400; i++) {
      await sleep(400);
      const r = (await page.evaluate(READ)) as { badge: string | null; cap: string; ff: boolean; settling: boolean; chain: number };
      if (!r.badge) { console.log('demo finished after', ((Date.now() - t0) / 1000).toFixed(1), 's wall clock'); break; }
      if (r.cap && seen[seen.length - 1] !== r.cap) {
        seen.push(r.cap);
        console.log(`  [${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s] ${r.badge.split(' ')[1]}  ${r.cap.slice(0, 92)}`);
        if (shots < 4) { await shot(String(shots)); shots++; }
      }
      // the rule under test: a chain must never be on screen while values still move
      if (r.chain > 0 && r.settling) violations++;
    }
    console.log('captions seen: ' + seen.length);
    console.log('WHY-while-equilibrating violations:', violations);
  } else if (scenario === 'assess') {
    await clickText('Resident session'); await sleep(500);
    await clickText('Start session'); await sleep(1500); await shot('0-question');
    const N = ACTIVE_ITEMS.length;
    for (let i = 0; i < N; i++) {
      await clickText(i % 3 === 0 ? 'Fall' : 'Rise').catch(async () => clickText('Opens less').catch(() => clickText('Closes earlier')));
      await clickText('Lock answer');
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent === 'Lock' ), { timeout: 30000 });
      if (i === 5) await shot('1-revealed');
      await page.evaluate(() => (document.querySelector('.btn.mech') as HTMLButtonElement).click());
      await clickText('Lock');
      await sleep(200);
      if (i === 5) await shot('2-mech');
      if (process.env.STOP && i === +process.env.STOP) { await shot('stop'); break; }
      await clickText(i < N - 1 ? 'Next item' : 'Finish');
      await sleep(300);
    }
    await sleep(500); await shot('3-scorecard');
    const stored = await page.evaluate(() => localStorage.getItem('cardioflow-mcs.sessions.v1'));
    console.log('stored bytes', stored?.length, 'responses', JSON.parse(stored!)[0].responses.length);
  }
  console.log(errors.length ? 'CONSOLE:\n' + errors.join('\n') : 'no console errors');
  await browser.close();
})();
