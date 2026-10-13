import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 187, height: 406 }, reducedMotion: 'reduce' }); const page = await ctx.newPage();
await page.goto('http://localhost:8933/'); await page.focus('.pf-foot-legal a:last-child');
const hits = [];
for (let i = 0; i < 28; i++) {
  await page.keyboard.press('Shift+Tab'); await page.waitForTimeout(30);
  const r = await page.evaluate(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); const nb = document.querySelector('.pf-nav').getBoundingClientRect().bottom; return { id: (a.id || a.textContent.trim()).slice(0, 22), top: Math.round(r.top), bottom: Math.round(r.bottom), nb: Math.round(nb), inNav: !!a.closest('.pf-nav') }; });
  if (!r.inNav && r.top < r.nb) hits.push(r);
}
console.log(JSON.stringify(hits));
await page.screenshot({ path: 'qa/M1/bughunt-tmp3/shots/chromium-187-shifttab.png' });
await b.close();
