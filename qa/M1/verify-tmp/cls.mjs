import { chromium } from 'playwright';
import { startServer } from '../../serve.mjs';
const srv = await startServer(); const b = await chromium.launch();
for (const p of ['/legal','/about','/contact','/']) { const r=[];
 for (let i=0;i<4;i++){ const pg = await b.newPage({ viewport: { width: 375, height: 900 } });
  await pg.addInitScript(() => { window.__s=[]; new PerformanceObserver(l => { for (const e of l.getEntries()) if(!e.hadRecentInput) window.__s.push([Math.round(e.startTime), +e.value.toFixed(4), e.sources.map(s=>s.node?.nodeName+'.'+(s.node?.className||''))]); }).observe({ type: 'layout-shift', buffered: true }); });
  await pg.goto(srv.url + p, { waitUntil: 'networkidle' }); await pg.waitForTimeout(1000);
  r.push(await pg.evaluate(() => [window.__s.reduce((a,x)=>a+x[1],0).toFixed(4), JSON.stringify(window.__s).slice(0,200)])); await pg.close(); }
 console.log(p, JSON.stringify(r)); }
await b.close(); await srv.close();
