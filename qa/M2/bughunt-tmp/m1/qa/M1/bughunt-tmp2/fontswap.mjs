import { chromium, webkit } from 'playwright';
const eng = process.argv[2] === 'webkit' ? webkit : chromium;
const b = await eng.launch();
for (const w of [375, 1440]) for (const p of ['', 'legal']) {
  const ctx = await b.newContext({ viewport: { width: w, height: 812 } });
  await ctx.route('**/fonts.gstatic.com/**', async r => { await new Promise(x => setTimeout(x, 3000)); return r.continue(); });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__cls = 0; window.__shifts = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), src: (e.sources || []).map(s => s.node ? (s.node.className || s.node.nodeName) : '?').slice(0, 3) }); } }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {} });
  await page.goto('http://localhost:8932/' + p, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const m = () => page.evaluate(() => { const t = document.querySelector('#hero-title, .pf-sheet-title'); const n = document.querySelector('.pf-sub, .pf-lede'); const c = document.querySelector('.pf-cta, .pf-note'); return { titleH: t.getBoundingClientRect().height, titleW: Math.round(t.getBoundingClientRect().width), subTop: n.getBoundingClientRect().top, subH: n.getBoundingClientRect().height, ctaTop: c && c.getBoundingClientRect().top, hv: document.fonts.check('16px "Hedvig Letters Serif"'), inter: document.fonts.check('16px Inter') }; });
  const a = await m();
  await page.waitForTimeout(5000);
  const z = await m();
  console.log(eng.name(), w, p || 'index', JSON.stringify({ before: a, after: z, cls: await page.evaluate(() => window.__cls), shifts: await page.evaluate(() => window.__shifts) }));
  await ctx.close();
}
await b.close();
