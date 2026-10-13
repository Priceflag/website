import { chromium } from 'playwright';
const b = await chromium.launch();
for (const w of [187, 240, 256, 280, 300]) for (const p of ['', 'contact']) {
  const ctx = await b.newContext({ viewport: { width: w, height: 400 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); await page.goto('http://localhost:8932/' + p, { waitUntil: 'networkidle' });
  const r = await page.evaluate(() => { const vw = document.documentElement.clientWidth; const o = []; document.querySelectorAll('body *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.right > vw + 1 && !el.closest('.pf-hp,.pf-visually-hidden,.pf-skip,.skip,.pf-hero-media,.pf-foot-art,svg')) o.push(el.tagName + '.' + (el.className.baseVal ?? el.className) + ':' + (el.textContent||'').trim().slice(0,25) + '@' + Math.round(r.right)); }); return { sw: document.documentElement.scrollWidth, o: o.slice(-8) }; });
  console.log(w, p || 'index', JSON.stringify(r));
  await ctx.close();
}
await b.close();
