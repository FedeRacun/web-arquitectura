// JavaScript budget gate for the built site: every script the page can load
// (bundled chunks in dist/_astro plus inline <script> blocks in the HTML),
// measured gzipped. The brief's ceiling is 250 KB; "si se supera, algo sobra".
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 250;
const dist = new URL('../dist/', import.meta.url).pathname;
const gz = (text) => gzipSync(text, { level: 9 }).length;

const rows = readdirSync(join(dist, '_astro'))
  .filter((file) => file.endsWith('.js'))
  .map((file) => ({ name: `_astro/${file}`, bytes: gz(readFileSync(join(dist, '_astro', file))) }));

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]).join('\n');
if (inline.trim()) rows.push({ name: 'index.html inline scripts', bytes: gz(inline) });

rows.sort((a, b) => b.bytes - a.bytes);
const total = rows.reduce((sum, row) => sum + row.bytes, 0);
const kb = (bytes) => (bytes / 1024).toFixed(1).padStart(7);

for (const row of rows) console.log(`${kb(row.bytes)} KB  ${row.name}`);
console.log(`${kb(total)} KB  total gzip (budget ${BUDGET_KB} KB)`);

if (total > BUDGET_KB * 1024) {
  console.error(`JS budget exceeded by ${(total / 1024 - BUDGET_KB).toFixed(1)} KB`);
  process.exit(1);
}
