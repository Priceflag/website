import { chromium, webkit } from 'playwright';
import { startServer } from '../../serve.mjs';
const srv = await startServer();
const out = {};
const pages = ['/', '/about', '/contact', '/legal', '/signin.html'];
for (const bt of [chromium, webkit]) {
  const b = await bt.launch();
  for (const p of pages) {
    for (const rm of ['no-preference', 'reduce']) {
      const ctx = await b.newContext({ viewport: { width: 375, height: 800 }, reducedMotion: rm });
      const pg = await ctx.newPage(); const errs = [];
      pg.on('console', m => { if (['error','warning'].includes(m.type())) errs.push(m.type()+': '+m.text()); });
      pg.on('pageerror', e => errs.push('pageerror: '+e.message));
      pg.on('requestfailed', r => { if (r.url().startsWith(srv.url)) errs.push('reqfail '+r.url()); });
      pg.on('response', r => { if (r.status()>=400) errs.push(r.status()+' '+r.url()); });
      await pg.goto(srv.url + p, { waitUntil: 'networkidle' }); await pg.waitForTimeout(1500);
      const info = await pg.evaluate(() => {
        const sheet = document.querySelector('.pf-sheet'); const bg = document.querySelector('.pf-bg');
        const cs = el => el ? { op: getComputedStyle(el).opacity, tf: getComputedStyle(el).transform, vis: getComputedStyle(el).visibility } : null;
        const imgs = [...document.images].filter(i => i.getBoundingClientRect().width>0).map(i => ({ src: i.currentSrc.split('/').pop(), ok: i.complete && i.naturalWidth>0, alt: i.getAttribute('alt') }));
        return { cls: document.documentElement.className, sheet: cs(sheet), bg: cs(bg), h1: [...document.querySelectorAll('h1')].map(h=>h.textContent.trim()),
          overflow: document.documentElement.scrollWidth > innerWidth, imgs };
      });
      out[`${bt.name()} ${p} rm=${rm}`] = { errs, ...info };
      await ctx.close();
    }
  }
  await b.close();
}
console.log(JSON.stringify(out, null, 1));
await srv.close();
