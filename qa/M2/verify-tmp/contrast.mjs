import { chromium } from 'playwright';
import fs from 'node:fs';
const base = 'http://localhost:8932';
const targets = {
  '/': ['.pf-title-lead', '.pf-title-accent', '.pf-sub', '.pf-hero-foot', '.pf-foot-head', '.pf-foot-bar', '.pf-foot-link'],
  '/signin.html': ['.pf-eyebrow', 'h1', 'label', '.pf-note', '.pf-legal', '.pf-wordmark'],
  '/about': ['.pf-sheet-title', '.pf-lede'],
};
function lum([r, g, b]) { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); }
function cr(a, b) { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + .05) / (y + .05); }
const b = await chromium.launch();
for (const w of [1440, 375]) for (const [p, sels] of Object.entries(targets)) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  await pg.route(/script\.google\.com/, r => r.abort());
  await pg.goto(base + p, { waitUntil: 'networkidle' }); await pg.waitForTimeout(600);
  for (const s of sels) {
    const el = pg.locator(s).first();
    if (!(await el.count())) continue;
    await el.scrollIntoViewIfNeeded();
    const color = await el.evaluate(e => getComputedStyle(e).color);
    const box = await el.boundingBox(); if (!box) continue;
    // hide text (all descendants) then screenshot region
    await el.evaluate(e => { e.dataset.vc = e.style.cssText; e.style.setProperty('color', 'transparent', 'important'); e.style.setProperty('text-shadow', 'none', 'important'); e.querySelectorAll('*').forEach(c => { c.style.setProperty('color', 'transparent', 'important'); c.style.setProperty('text-shadow','none','important'); }); });
    const buf = await pg.screenshot({ clip: box, type: 'png' });
    await el.evaluate(e => { e.style.cssText = e.dataset.vc; e.querySelectorAll('*').forEach(c => { c.style.removeProperty('color'); c.style.removeProperty('text-shadow'); }); });
    // decode PNG via browser canvas
    const px = await pg.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data; const out = [];
      for (let i = 0; i < d.length; i += 4 * 7) out.push([d[i], d[i + 1], d[i + 2]]);
      return out;
    }, buf.toString('base64'));
    const m = color.match(/[\d.]+/g).map(Number); const alpha = m[3] ?? 1;
    let worst = 99, sum = 0;
    for (const bg of px) { const fg = [0, 1, 2].map(i => m[i] * alpha + bg[i] * (1 - alpha)); const c = cr(fg, bg); worst = Math.min(worst, c); sum += c; }
    // 5th percentile
    const arr = px.map(bg => cr([0,1,2].map(i => m[i]*alpha + bg[i]*(1-alpha)), bg)).sort((a,b)=>a-b);
    console.log(`${p} @${w} ${s.padEnd(18)} color ${color.padEnd(28)} min ${worst.toFixed(2)} p5 ${arr[Math.floor(arr.length*.05)].toFixed(2)} median ${arr[Math.floor(arr.length/2)].toFixed(2)}`);
  }
  await ctx.close();
}
await b.close();
