// Usage: node tools/snap.mjs <outdir> <t1> [t2 ...]  — renders still frames at the given times.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [outDir, ...times] = process.argv.slice(2);
const fmt = process.env.FORMAT === 'vertical' ? '&format=vertical' : '';
const url = pathToFileURL(path.resolve('index.html')).href + '?record' + fmt;
const vp = fmt ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: vp });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.__ready === true);
console.log('duration', await page.evaluate(() => window.__duration));
console.log(JSON.stringify(await page.evaluate(() => window.__segments)));
for (const t of times) {
  await page.evaluate((t) => window.__seek(t), Number(t));
  await page.screenshot({ path: path.join(outDir, `t${String(t).padStart(5, '0')}.png`) });
}
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
await browser.close();
