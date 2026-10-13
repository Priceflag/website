import { chromium } from 'playwright';
import fs from 'node:fs';
const pages = ['/', '/about', '/contact', '/legal', '/signin.html'];
const b = await chromium.launch();
const out = {};
async function grab(base, p) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const pg = await ctx.newPage();
  await pg.goto(base + p, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(500);
  const r = await pg.evaluate(() => {
    // all text nodes incl. hidden (textContent) and visible (innerText), plus alt/aria-label/title/placeholder/value
    const attrs = [];
    document.querySelectorAll('[alt],[aria-label],[title],[placeholder],input[value],meta[name=description],meta[property^="og:"],meta[name^="twitter:"]').forEach(e => {
      for (const a of ['alt','aria-label','title','placeholder','content']) if (e.getAttribute(a)) attrs.push(`${e.tagName.toLowerCase()}[${a}]=${e.getAttribute(a)}`);
    });
    return { title: document.title, inner: document.body.innerText, attrs };
  });
  await ctx.close();
  return r;
}
for (const p of pages) {
  out[p] = { m1: await grab('http://localhost:8931', p), now: await grab('http://localhost:8932', p) };
}
await b.close();
fs.writeFileSync('qa/M2/verify-tmp/text.json', JSON.stringify(out, null, 1));
for (const p of pages) {
  const name = p === '/' ? 'index' : p.replace(/\W/g, '');
  for (const k of ['m1', 'now']) {
    const t = out[p][k];
    const norm = s => s.split('\n').map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
    fs.writeFileSync(`qa/M2/verify-tmp/text-${name}-${k}.txt`, 'TITLE: ' + t.title + '\n' + norm(t.inner) + '\n--ATTRS--\n' + t.attrs.join('\n') + '\n');
  }
}
