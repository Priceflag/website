import { chromium, webkit } from 'playwright';
import { startServer } from '../../serve.mjs';
const srv = await startServer();
for (const [n, bt] of [['chromium', chromium], ['webkit', webkit]]) for (const p of ['/', '/about', '/legal']) {
  const b = await bt.launch(); const pg = await b.newPage(); await pg.goto(srv.url + p, { waitUntil: 'networkidle' }); await pg.waitForTimeout(800);
  const r = await pg.evaluate(() => ({ inter: document.fonts.check('16px Inter'), hedvig: document.fonts.check('16px "Hedvig Letters Serif"'), loaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).filter((v, i, a) => a.indexOf(v) === i) }));
  // second load (warm cache)
  await pg.reload({ waitUntil: 'networkidle' }); const r2 = await pg.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).filter((v, i, a) => a.indexOf(v) === i));
  console.log(n, p, JSON.stringify(r), 'warm:', JSON.stringify(r2)); await b.close();
}
await srv.close();
