// Renders the animation frame-by-frame and encodes an MP4 with ffmpeg.
// Usage: node tools/record.mjs [out.mp4] [--fps 30] [--format vertical] [--page bills-matchup.html]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : def;
};
const fps = Number(opt('fps', 30));
const format = opt('format', 'landscape');
const vertical = format === 'vertical';
const pageFile = opt('page', 'index.html');
const out = args[0] || `renders/jakobi-lane-route-tree-2026${vertical ? '-vertical' : ''}.mp4`;
const size = vertical ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };

const url = pathToFileURL(path.resolve(pageFile)).href + `?record${vertical ? '&format=vertical' : ''}`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: size });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(url);
await page.waitForFunction(() => window.__ready === true);
const duration = await page.evaluate(() => window.__duration);
const frames = Math.ceil(duration * fps);

const ff = spawn('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', out,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  await page.evaluate((t) => window.__seek(t), f / fps);
  const buf = await page.screenshot({ type: 'png' });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (f % (fps * 5) === 0) console.log(`frame ${f}/${frames} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await browser.close();
console.log(`wrote ${out} — ${frames} frames, ${duration.toFixed(1)}s @ ${fps}fps`);
