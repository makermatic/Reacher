/**
 * Turns the Vite build in dist/ into the page we publish as a Claude artifact:
 * dist-artifact/reacher.html and dist-artifact/reacher-test.html.
 *
 * The artifact host wraps the page in its own <!doctype html><head><body>, so
 * the file is a fragment: title and meta first, then fonts, the inlined CSS,
 * the root element, and the inlined JS. Only Google Fonts may load from
 * outside, so everything else ships inside the file.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const assets = 'dist/assets';
const files = readdirSync(assets);
const pick = (ext) => {
  const matches = files.filter((f) => f.endsWith(ext));
  if (matches.length !== 1)
    throw new Error(`Expected one ${ext} file in ${assets}, found ${matches.length}`);
  return readFileSync(join(assets, matches[0]), 'utf8');
};

const css = pick('.css');
// A literal "</script" inside the bundle would end the inline script early.
const js = pick('.js').replaceAll('</script', '<\\/script');
const fonts = readFileSync('scripts/fonts.html', 'utf8').trim();

// The same app ships as two artifacts: "Reacher Test" gets each round first, "Reacher" holds real data.
const page = (title) => `<title>${title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
${fonts}
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;

mkdirSync('dist-artifact', { recursive: true });
for (const [file, title] of [
  ['reacher.html', 'Reacher'],
  ['reacher-test.html', 'Reacher Test'],
]) {
  const html = page(title);
  writeFileSync(join('dist-artifact', file), html);
  const mb = Buffer.byteLength(html) / 1024 / 1024;
  if (mb > 15) throw new Error(`${file} is ${mb.toFixed(1)} MB; the artifact limit is 16 MB`);
  console.log(`dist-artifact/${file}  ${(mb * 1024).toFixed(0)} kB`);
}
