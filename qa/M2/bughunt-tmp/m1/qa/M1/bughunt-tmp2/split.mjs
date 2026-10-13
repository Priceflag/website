import { chromium } from 'playwright';
const b = await chromium.launch();
const W = 'Preisänderungsverwaltungsmöglichkeitenübersicht';
for (const mode of ['double', 'word-statement', 'word-h3', 'word-summary', 'word-foothead', 'word-review-h2', 'word-label', 'word-btn']) for (const w of [320, 375]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 800 } }); const page = await ctx.newPage();
  await page.goto('http://localhost:8932/');
  await page.evaluate(([mode, W]) => {
    if (mode === 'double') { const dbl = el => { for (const n of el.childNodes) { if (n.nodeType === 3 && n.textContent.trim()) n.textContent = n.textContent + ' ' + n.textContent; else if (n.nodeType === 1 && !['SCRIPT', 'STYLE', 'svg'].includes(n.tagName)) dbl(n); } }; document.querySelectorAll('.pf-btn, .pf-nav a, h1, h2, h3, summary, label, .pf-form-note, .pf-hero-foot, .pf-foot-link, .pf-foot-bar p, .pf-sub, .pf-statement, .pf-lede, .pf-steps p, details p').forEach(dbl); }
    const sel = { 'word-statement': '.pf-statement', 'word-h3': '.pf-steps h3', 'word-summary': '.pf-faq summary', 'word-foothead': '.pf-foot-head', 'word-review-h2': '#review-title', 'word-label': '.pf-field label', 'word-btn': '.pf-cta .pf-btn' }[mode];
    if (sel) document.querySelector(sel).append(' ' + W);
  }, [mode, W]);
  await page.waitForTimeout(100);
  const r = await page.evaluate(() => { const vw = document.documentElement.clientWidth; const o = []; document.querySelectorAll('body *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.right > vw + 1 && !el.closest('.pf-hp,.pf-visually-hidden,.pf-skip,.pf-hero-media,.pf-foot-art,svg')) o.push(el.tagName + '.' + (el.className.baseVal ?? el.className) + '@' + Math.round(r.right)); }); const vis = [...document.querySelectorAll('.pf-nav-group:first-child a')].map(a => { const r = a.getBoundingClientRect(), n = a.parentElement.getBoundingClientRect(); return Math.round(100 * Math.max(0, Math.min(r.right, n.right) - r.left) / r.width) + '%'; }); return { sw: document.documentElement.scrollWidth, o: o.slice(0, 5), navVisible: vis }; });
  console.log(mode, w, JSON.stringify(r));
  await ctx.close();
}
await b.close();
