// Inlines CSS, fonts and JS into one self-contained HTML file.
// Usage: node tools/bundle.mjs [out.html]
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || 'dist/jakobi-lane-route-tree.html';
const read = (p) => fs.readFileSync(p, 'utf8');

let css = read('css/style.css').replace(/url\('\.\.\/(assets\/fonts\/[^']+\.woff2)'\)/g, (_, p) =>
  `url(data:font/woff2;base64,${fs.readFileSync(p).toString('base64')})`);

let html = read('index.html')
  .replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${css}</style>`)
  .replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, p) => `<script>\n${read(p)}</script>`);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
