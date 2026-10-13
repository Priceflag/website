// Double submit + focus while sending, with JS-dispatched clicks (Playwright's click waits on aria-disabled).
import { chromium, webkit } from 'playwright';
import { startServer } from '../../serve.mjs';
const srv = await startServer();
for (const [bn, bt] of [['chromium', chromium], ['webkit', webkit]]) {
  const b = await bt.launch(); const pg = await b.newPage(); let n = 0;
  await pg.route('**/*', async r => { const u = r.request().url(); if (u.startsWith(srv.url) || /fonts\./.test(u)) return r.continue();
    if (/script\.google\.com/.test(u)) { n++; await new Promise(x => setTimeout(x, 1500)); return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true}' }); } return r.abort(); });
  await pg.goto(srv.url + '/'); await pg.fill('#rv-email', 'q@example.com'); await pg.fill('#rv-store', 'shop.com');
  await pg.focus('form button[type=submit]'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(150);
  await pg.keyboard.press('Enter'); await pg.evaluate(() => { const bt = document.querySelector('form button[type=submit]'); bt.click(); bt.click(); document.querySelector('form').requestSubmit(); });
  const mid = await pg.evaluate(() => ({ tag: document.activeElement?.tagName, label: document.querySelector('form button[type=submit]').textContent, aria: document.querySelector('form button[type=submit]').getAttribute('aria-disabled'), live: document.querySelector('[data-pf-live]').textContent, cursor: getComputedStyle(document.querySelector('form button[type=submit]')).cursor, opacity: getComputedStyle(document.querySelector('form button[type=submit]')).opacity }));
  await pg.waitForTimeout(2200);
  const end = await pg.evaluate(() => ({ tag: document.activeElement?.tagName, live: document.querySelector('[data-pf-live]').textContent, state: document.querySelector('form').getAttribute('data-state') }));
  console.log(bn, n === 1 && mid.tag === 'BUTTON' && /Sending/.test(mid.label) && /Sending/.test(mid.live) ? 'PASS' : 'FAIL', JSON.stringify({ n, mid, end }));
  await b.close();
}
await srv.close();
