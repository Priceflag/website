import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext(); const page = await ctx.newPage();
await page.goto('http://localhost:8932/');
await page.fill('[name=email]', 'x@shop.com');
const r = await page.evaluate(() => { sessionStorage.setItem('pf-review-sent', 'x@shop.com'); const ev = new PageTransitionEvent('pageshow', { persisted: true }); dispatchEvent(ev); const f = document.querySelector('form[data-pf-review]'); return { state: f.getAttribute('data-state'), status: f.querySelector('[data-pf-status]').textContent, again: !f.querySelector('[data-pf-again]').hidden }; });
console.log('bf-sim', JSON.stringify(r));
await page.click('[data-pf-again]');
console.log('after again', await page.evaluate(() => ({ active: document.activeElement.id, email: document.querySelector('[name=email]').value })));
// reload path: email blank, focus to store
await page.fill('[name=email]', 'x@shop.com'); await page.fill('[name=store]', 'shop.com');
await ctx.route('**/script.google.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
await page.click('button[type=submit]'); await page.waitForTimeout(500);
await page.reload(); await page.waitForTimeout(300);
await page.click('[data-pf-again]');
console.log('after reload+again', await page.evaluate(() => ({ active: document.activeElement.id, email: document.querySelector('[name=email]').value })));
await b.close();
