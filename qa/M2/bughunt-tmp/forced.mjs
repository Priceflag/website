import { chromium } from 'playwright';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.route('https://priceflag.org/uploads/summit-painting-3.webp', r => r.fulfill({ path: 'uploads/summit-painting-3.webp', contentType: 'image/webp' }));
const p = await ctx.newPage(); await p.emulateMedia({ forcedColors: 'active', reducedMotion:'reduce' });
const D = 'qa/M2/bughunt-tmp/shots/';
for (const pg of ['index.html','about.html','contact.html','signin.html','legal.html']) {
  await p.goto('http://localhost:8934/'+pg, { waitUntil: 'networkidle' });
  await p.screenshot({ path: D+'forced-'+pg.replace('.html','')+'.png' });
}
await p.goto('http://localhost:8934/index.html#review', { waitUntil: 'networkidle' });
await p.locator('#review').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
await p.screenshot({ path: D+'forced-index-review.png' });
await p.locator('.pf-foot').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
await p.screenshot({ path: D+'forced-index-foot.png' });
// button colors
console.log(await p.evaluate(() => [...document.querySelectorAll('.pf-btn')].map(e => { const s = getComputedStyle(e); return [e.className, s.backgroundColor, s.color, s.borderTopStyle, s.borderTopWidth, s.borderTopColor, s.forcedColorAdjust].join(' | '); })));
await b.close();
