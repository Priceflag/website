import { chromium } from 'playwright';
import { startServer } from '../serve.mjs';
const srv = await startServer(); const b = await chromium.launch();
for (const w of [1440, 375]) {
  const p = await b.newPage({ viewport: { width: w, height: w < 500 ? 812 : 900 } });
  await p.route(/fonts\.g|script\.google/, (r) => r.continue());
  await p.goto(srv.url + '/', { waitUntil: 'networkidle' });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await p.waitForTimeout(800);
  await p.addStyleTag({ content: '.pf-nav{position:static!important}' });
  await p.screenshot({ path: `qa/final/home-${w}.png`, fullPage: true });
}
await b.close(); await srv.close();
