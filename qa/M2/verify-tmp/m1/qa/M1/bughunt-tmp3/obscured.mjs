import { chromium, webkit } from 'playwright';
const which = process.argv[2] || 'chromium';
const b = await (which === 'webkit' ? webkit : chromium).launch();
for (const [w, h] of [[187, 406], [375, 812], [320, 568]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' }); const page = await ctx.newPage();
  await page.goto('http://localhost:8933/'); await page.waitForTimeout(200);
  const hits = [];
  for (let i = 0; i < 32; i++) {
    await page.keyboard.press(which === 'webkit' ? 'Alt+Tab' : 'Tab'); await page.waitForTimeout(30);
    const r = await page.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return null; const r = a.getBoundingClientRect(); const nb = document.querySelector('.pf-nav').getBoundingClientRect().bottom; return { id: (a.id || a.textContent.trim()).slice(0, 22), top: Math.round(r.top), bottom: Math.round(r.bottom), nb: Math.round(nb), inNav: !!a.closest('.pf-nav'), vh: innerHeight }; });
    if (r && !r.inNav && (r.top < r.nb || r.bottom > r.vh)) hits.push(r);
  }
  console.log(which, w, JSON.stringify(hits));
  await ctx.close();
}
await b.close();
