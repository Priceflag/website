import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.emulateMedia({ forcedColors: 'active', reducedMotion:'reduce' });
for (const port of [8935, 8934]) for (const pg of ['index.html','about.html']) {
  await p.goto(`http://localhost:${port}/${pg}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
  await p.screenshot({ path: `qa/M2/bughunt-tmp/shots/forcedtop-${port}-${pg}.png`, clip: { x: 0, y: 0, width: 1280, height: 220 } });
}
await b.close();
