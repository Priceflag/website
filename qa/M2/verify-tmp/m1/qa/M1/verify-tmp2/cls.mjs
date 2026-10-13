import { chromium, webkit } from 'playwright';
import { startServer } from '../../serve.mjs';
const srv = await startServer();
const init = () => { window.__cls = 0; window.__sh = []; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__sh.push([Math.round(e.startTime), +e.value.toFixed(4), e.sources?.map(s => s.node?.nodeName + '.' + (s.node?.className || '')).join(',')]); } }).observe({ type: 'layout-shift', buffered: true }); };
const res = {};
for (const throttle of [false, true]) for (const p of ['/', '/about', '/contact', '/legal']) for (const w of [375, 1440]) {
  const vals = [];
  for (let i = 0; i < 3; i++) {
    const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: w, height: 800 } }); const pg = await ctx.newPage();
    await pg.addInitScript(init);
    if (throttle) { const c = await ctx.newCDPSession(pg); await c.send('Network.enable'); await c.send('Network.setCacheDisabled', { cacheDisabled: true }); await c.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 50000, uploadThroughput: 50000 }); }
    await pg.goto(srv.url + p, { waitUntil: 'load', timeout: 90000 }); await pg.waitForTimeout(throttle ? 6000 : 1500);
    vals.push(await pg.evaluate(() => [+window.__cls.toFixed(4), window.__sh]));
    await b.close();
  }
  const k = `${throttle ? 'slow3g' : 'fast'} ${p}@${w}`; res[k] = vals; console.log(k, JSON.stringify(vals.map(v => v[0])), JSON.stringify(vals.flatMap(v => v[1]).slice(0, 3)));
}
// webkit fast
for (const p of ['/', '/about', '/contact', '/legal']) { const b = await webkit.launch(); const pg = await b.newPage({ viewport: { width: 375, height: 800 } }); await pg.addInitScript(init); await pg.goto(srv.url + p); await pg.waitForTimeout(1500); console.log('webkit', p, await pg.evaluate(() => typeof PerformanceObserver.supportedEntryTypes !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('layout-shift') ? window.__cls : 'unsupported')); await b.close(); }
await srv.close();
