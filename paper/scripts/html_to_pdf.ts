/** Render paper/submission/SDC1.html to SDC1.pdf with headless Chrome. Usage: npx tsx paper/scripts/html_to_pdf.ts */
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const p = await b.newPage();
  await p.goto(pathToFileURL(resolve('paper/submission/SDC1.html')).href, { waitUntil: 'networkidle0' });
  await p.waitForFunction('window.__katexDone === true', { timeout: 30000 }).catch(() => console.warn('KaTeX did not load; math left as TeX'));
  await p.pdf({ path: 'paper/submission/SDC1.pdf', format: 'Letter', margin: { top: '0.7in', bottom: '0.7in', left: '0.7in', right: '0.7in' },
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="font-size:8pt;width:100%;text-align:center;font-family:Arial">SDC 1 · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>' });
  await b.close();
  console.log('SDC1.pdf written');
})();
