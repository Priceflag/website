import { chromium } from 'playwright';
const b = await chromium.launch();
for (const [m, f] of Object.entries({ s500: r => r.fulfill({ status: 500, body: 'x' }), html: r => r.fulfill({ status: 200, contentType: 'text/html', body: '<html>quota</html>' }), busy: r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false,"error":"busy"}' }), abort: r => r.abort('connectionreset'), okNull: r => r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }) })) {
  const ctx = await b.newContext(); await ctx.route('**/script.google.com/**', f); const page = await ctx.newPage();
  await page.goto('http://localhost:8932/'); await page.fill('[name=email]', 'me@shop.com'); await page.fill('[name=store]', 'shop.com'); await page.fill('[name=message]', 'note');
  await page.click('button[type=submit]'); await page.waitForTimeout(700);
  console.log(m, JSON.stringify(await page.evaluate(() => { const s = document.querySelector('[data-pf-status]'); return { t: s.textContent.slice(0, 90), active: document.activeElement.className, btn: document.querySelector('button[type=submit]').textContent, msg: document.querySelector('[name=message]').value }; })));
  await ctx.close();
}
await b.close();
