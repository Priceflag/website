import { chromium } from 'playwright';
import { startServer } from '../../serve.mjs';
const srv = await startServer(); const b = await chromium.launch();
for (const w of [320, 375, 1440]) {
  const pg = await b.newPage({ viewport: { width: w, height: 900 } });
  await pg.goto(srv.url + '/', { waitUntil: 'networkidle' });
  await pg.locator('footer').scrollIntoViewIfNeeded(); await pg.waitForTimeout(800);
  await pg.locator('footer').screenshot({ path: `qa/M1/verify-tmp/foot-${w}.png` });
  const ov = await pg.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); const a = r('.pf-foot-word'), bar = r('.pf-foot-bar'); const art = document.querySelector('.pf-foot-art'); return { wordBottom: a.bottom, barTop: bar.top, artLoaded: art.complete && art.naturalWidth > 0, sw: document.documentElement.scrollWidth, iw: innerWidth }; });
  console.log(w, JSON.stringify(ov));
  await pg.close();
}
await b.close(); await srv.close();
