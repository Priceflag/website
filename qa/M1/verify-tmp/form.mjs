import { chromium, webkit } from 'playwright';
import { startServer } from '../../serve.mjs';
const srv = await startServer();
for (const bt of [chromium, webkit]) {
const b = await bt.launch();
async function open(handler, opts={}) {
  const ctx = await b.newContext(opts); const pg = await ctx.newPage(); const calls = [];
  await pg.route('**/*', r => { const u = r.request().url(); if (u.startsWith(srv.url)) return r.continue(); if (/script\.google\.com/.test(u)) { calls.push(r.request()); return handler(r); } return r.abort(); });
  await pg.goto(srv.url + '/'); return { ctx, pg, calls };
}
const okr = body => r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
console.log('\n=====', bt.name());
// labels
{ const { ctx, pg } = await open(okr({ ok: true }));
  const lab = await pg.evaluate(() => [...document.querySelectorAll('.pf-form input:not([type=hidden]), .pf-form textarea')].map(i => [i.id, i.labels?.[0]?.textContent.trim(), i.getAttribute('aria-describedby'), i.required, i.closest('[aria-hidden=true]') ? 'in-aria-hidden' : '', i.tabIndex]));
  console.log('labels', JSON.stringify(lab));
  // hp visible?
  console.log('honeypot box', JSON.stringify(await pg.evaluate(() => { const e = document.querySelector('.pf-hp'); const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, x: r.x, cs: getComputedStyle(e).position + ' ' + getComputedStyle(e).clip + ' ' + getComputedStyle(e).left }; })));
  await ctx.close(); }
// success + payload
{ const { ctx, pg, calls } = await open(okr({ ok: true }));
  await pg.fill('#rv-email', 'a@b.co'); await pg.fill('#rv-store', 'https://shop.example.com/x'); await pg.fill('#rv-name', 'Zoë "Q" <b>'); await pg.fill('#rv-message', 'x'.repeat(300));
  await pg.click('#review button[type=submit]'); await pg.waitForSelector('form[data-state=sent]');
  const req = calls[0]; const body = JSON.parse(req.postData());
  console.log('content-type', req.headers()['content-type'], 'method', req.method());
  console.log('page field', body.page.length, body.page);
  console.log('page prefix ok', body.page.startsWith('https://priceflag.org'), 'msg chars carried in page', decodeURIComponent((body.page.match(/msg=([^&]*)/) || [, ''])[1]).length, 'of 300');
  console.log('status', await pg.textContent('[data-pf-status]'), '| focused', await pg.evaluate(() => document.activeElement.getAttribute('data-pf-status') !== null), '| role', await pg.getAttribute('[data-pf-status]', 'role'));
  console.log('form fields after success still present/enabled?', await pg.isVisible('#rv-email'), await pg.inputValue('#rv-email'));
  await ctx.close(); }
// long store pushes msg out
{ const { ctx, pg, calls } = await open(okr({ ok: true }));
  await pg.fill('#rv-email', 'a@b.co'); await pg.fill('#rv-store', 'a'.repeat(150) + '.com'); await pg.fill('#rv-name', 'n'.repeat(100)); await pg.fill('#rv-message', 'important message');
  await pg.click('#review button[type=submit]'); await pg.waitForSelector('form[data-state=sent]');
  const body = JSON.parse(calls[0].postData()); console.log('long store: page has msg?', /msg=important/.test(body.page), 'has name complete?', body.page.includes('n'.repeat(100)), body.page.length);
  await ctx.close(); }
// failure -> mailto content
{ const { ctx, pg } = await open(r => r.fulfill({ status: 500, body: 'x' }));
  await pg.fill('#rv-email', 'a@b.co'); await pg.fill('#rv-store', 'shop.com'); await pg.fill('#rv-name', 'Ada'); await pg.fill('#rv-message', 'line1\nline2 & $24 → $27');
  await pg.click('#review button[type=submit]'); await pg.waitForSelector('[data-kind=error]');
  const href = await pg.getAttribute('[data-pf-status] a', 'href'); console.log('500 status text:', await pg.textContent('[data-pf-status]'));
  const u = new URL(href); console.log('mailto to', u.pathname, '| subject', u.searchParams.get('subject'), '| body', JSON.stringify(u.searchParams.get('body')), '| email in body?', /a@b\.co/.test(href));
  await ctx.close(); }
// timeout path via clock
{ const ctx = await b.newContext(); const pg = await ctx.newPage(); await pg.clock.install();
  await pg.route('**/*', r => { const u = r.request().url(); if (u.startsWith(srv.url)) return r.continue(); if (/script\.google/.test(u)) return new Promise(() => {}); return r.abort(); });
  await pg.goto(srv.url + '/'); await pg.fill('#rv-email', 'a@b.co'); await pg.fill('#rv-store', 'shop.com');
  await pg.click('#review button[type=submit]'); console.log('busy label', await pg.textContent('#review button[type=submit]'), 'disabled', await pg.isDisabled('#review button[type=submit]'));
  await pg.clock.runFor(16000); await pg.waitForSelector('[data-kind=error]', { timeout: 5000 }).catch(() => {});
  console.log('timeout status:', await pg.textContent('[data-pf-status]'), '| button re-enabled', !(await pg.isDisabled('#review button[type=submit]')));
  await ctx.close(); }
// invalid -> errors & aria
{ const { ctx, pg } = await open(okr({ ok: true }));
  await pg.fill('#rv-email', 'bad'); await pg.fill('#rv-store', 'shop.com'); await pg.click('#review button[type=submit]');
  console.log('invalid email:', await pg.textContent('#rv-email-err'), '| aria-invalid', await pg.getAttribute('#rv-email', 'aria-invalid'), '| store aria-invalid', await pg.getAttribute('#rv-store', 'aria-invalid'), '| status', await pg.textContent('[data-pf-status]'));
  await pg.fill('#rv-email', 'good@x.com'); console.log('after fix aria-invalid', await pg.getAttribute('#rv-email', 'aria-invalid'), 'err', JSON.stringify(await pg.textContent('#rv-email-err')));
  // email edge: valid but unusual
  await pg.fill('#rv-email', 'a@b.c'); await pg.click('#review button[type=submit]'); console.log('a@b.c ->', await pg.textContent('#rv-email-err'));
  await pg.fill('#rv-email', 'x@shop.com'); await pg.fill('#rv-store', 'my-store.myshopify.com'); await pg.click('#review button[type=submit]'); await pg.waitForTimeout(300); console.log('myshopify store ->', JSON.stringify(await pg.textContent('#rv-store-err')), await pg.getAttribute('form', 'data-state'));
  await ctx.close(); }
// CTA clicks scroll to form
{ const { ctx, pg } = await open(okr({ ok: true }));
  for (const sel of ['.pf-hero .pf-btn:not(.pf-btn--ghost)', '.pf-foot .pf-btn--dark']) { await pg.click(sel); await pg.waitForTimeout(800); console.log('CTA', sel, '-> hash', await pg.evaluate(() => location.hash), 'form in view', await pg.evaluate(() => { const r = document.querySelector('#review').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })); }
  await ctx.close(); }
await b.close(); }
await srv.close();
