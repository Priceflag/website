import { chromium } from 'playwright';
const base = 'http://localhost:8932';
const pages = ['/', '/about', '/contact', '/legal', '/signin.html'];
const b = await chromium.launch();
for (const p of pages) for (const w of [1440, 375]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  const pg = await ctx.newPage();
  await pg.route(/script\.google\.com|dashboard\.priceflag/, r => r.abort());
  await pg.goto(base + p, { waitUntil: 'networkidle' });
  const seen = new Map();
  for (let i = 0; i < 60; i++) {
    await pg.keyboard.press('Tab');
    const info = await pg.evaluate(() => {
      const e = document.activeElement; if (!e || e === document.body) return null;
      const cs = getComputedStyle(e);
      // effective background: walk up for first non-transparent bg
      let n = e, bg = null;
      while (n && n.nodeType === 1) { const c = getComputedStyle(n).backgroundColor; if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') { bg = c; break; } n = n.parentElement; }
      const id = e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '') + ':' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 18);
      return { id, oc: cs.outlineColor, ow: cs.outlineWidth, os: cs.outlineStyle, oo: cs.outlineOffset, bg, bs: cs.boxShadow.slice(0, 40) };
    });
    if (!info) continue;
    if (seen.has(info.id)) break;
    seen.set(info.id, info);
  }
  console.log(`\n${p} @${w}`);
  for (const v of seen.values()) console.log(`  ${v.id.padEnd(42)} ${v.os} ${v.ow} ${v.oc} off ${v.oo}  ground ${v.bg}`);
  await ctx.close();
}
await b.close();
