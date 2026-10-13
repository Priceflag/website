import { chromium, webkit } from 'playwright';
const [,, page, w, h, out, port='8934', bn='chromium'] = process.argv;
const b = await ({chromium,webkit})[bn].launch(); const p = await b.newPage({ viewport: { width: +w, height: +h } });
await p.goto(`http://localhost:${port}/${page}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
await p.screenshot({ path: out, fullPage: true }); await b.close();
