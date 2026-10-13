import { chromium } from 'playwright';
import { startServer } from '../../serve.mjs';
const srv = await startServer(); const b = await chromium.launch();
for (const p of ['/', '/about', '/legal']) {
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } }); await pg.goto(srv.url + p);
  const dom = await pg.evaluate(() => [...document.querySelectorAll('a[href],button,input:not([type=hidden]),textarea,summary,[tabindex]')].filter(e => e.tabIndex >= 0 && e.checkVisibility() && e.getBoundingClientRect().width > 0).map(e => e.outerHTML.slice(0, 40)));
  const seq = [];
  for (let i = 0; i < dom.length; i++) { await pg.keyboard.press('Tab'); seq.push(await pg.evaluate(() => document.activeElement.outerHTML.slice(0, 40))); }
  const same = JSON.stringify(seq) === JSON.stringify(dom);
  console.log(p, 'tab order == DOM order:', same, dom.length);
  if (!same) seq.forEach((s, i) => s !== dom[i] && console.log('  ', i, s, '| expected', dom[i]));
  await pg.close();
}
await b.close(); await srv.close();
