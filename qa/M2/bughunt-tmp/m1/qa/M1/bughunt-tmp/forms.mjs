import { chromium, webkit } from 'playwright';
const BASE = 'http://localhost:8931/';
const out = {};
const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)); };

async function setup(browser, mode, opts = {}) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const reqs = [];
  page.on('console', m => { if (m.type() === 'error') reqs.push('console:' + m.text()); });
  page.on('pageerror', e => reqs.push('pageerror:' + e.message));
  await page.route('**/script.google.com/**', async route => {
    const r = route.request();
    reqs.push({ method: r.method(), ct: r.headers()['content-type'], body: r.postData() });
    if (mode === 'ok') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    if (mode === 'dup') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"duplicate":true}' });
    if (mode === 'busy') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false,"error":"busy"}' });
    if (mode === 'abort') return route.abort('failed');
    if (mode === 'html') return route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Script error</html>' });
    if (mode === '500') return route.fulfill({ status: 500, body: 'err' });
    if (mode === 'slow') { await new Promise(r => setTimeout(r, 20000)); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }).catch(() => {}); }
    if (mode === 'slow2') { await new Promise(r => setTimeout(r, 3000)); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
    return route.abort();
  });
  await page.goto(BASE);
  return { ctx, page, reqs };
}

async function state(page) {
  return page.evaluate(() => {
    const f = document.querySelector('form[data-pf-review]');
    const s = f.querySelector('[data-pf-status]');
    return {
      formState: f.getAttribute('data-state'),
      kind: s.getAttribute('data-kind'),
      status: s.textContent,
      statusHTML: s.innerHTML,
      active: document.activeElement && (document.activeElement.id || document.activeElement.tagName + '.' + document.activeElement.className),
      emailInvalid: f.elements.email.getAttribute('aria-invalid'),
      storeInvalid: f.elements.store.getAttribute('aria-invalid'),
      emailErr: document.getElementById('rv-email-err').textContent,
      storeErr: document.getElementById('rv-store-err').textContent,
      values: { email: f.elements.email.value, store: f.elements.store.value, name: f.elements.name.value, message: f.elements.message.value },
      btn: f.querySelector('button').textContent, btnDisabled: f.querySelector('button').disabled,
      fieldsVisible: getComputedStyle(f.querySelector('.pf-form-fields')).display !== 'none',
    };
  });
}

async function fill(page, d) {
  for (const [k, v] of Object.entries(d)) await page.fill(`[name="${k}"]`, v);
}

const b = await chromium.launch();

// 1 empty submit
{ const { ctx, page, reqs } = await setup(b, 'ok');
  await page.click('button[type=submit]');
  log('empty', { ...(await state(page)), reqs }); await ctx.close(); }

// 2 invalid inputs matrix
const emails = ['a', 'a@b', 'a@b.c', 'User+tag@Sub.Example.CO.uk', '  me@shop.com  ', 'ME@SHOP.COM', 'a@b..com', 'a@@b.com', 'a@b.com.', '"quoted"@x.com', 'ü@exämple.de', 'a@localhost', 'a b@c.com'];
const stores = ['https://mystore.myshopify.com/products/blue-shirt?variant=1', 'mystore.com', 'MyStore.COM', 'http://shop.co.uk/', 'shop.com?ref=x', 'www.shop.com:8080', 'café.com', 'shop', 'admin.shopify.com/store/my-store', 'https://', 'shop.com/collections/all#top', 'javascript:alert(1)', 'shop.com.', 'my_store.com', ' shop.com '];
{ const { ctx, page } = await setup(b, 'ok');
  const er = {};
  for (const e of emails) { await page.fill('[name=email]', e); await page.fill('[name=store]', 'shop.com');
    await page.evaluate(() => { const f = document.querySelector('form[data-pf-review]'); f.dispatchEvent(new Event('submit', { cancelable: true })); });
    const s = await state(page); er[e] = { accepted: !s.emailErr, val: s.values.email, err: s.emailErr };
    await page.goto(BASE); }
  log('emailMatrix', er);
  const sr = {};
  await page.unroute('**/script.google.com/**');
  await page.route('**/script.google.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  for (const s0 of stores) { await page.fill('[name=email]', 'me@shop.com'); await page.fill('[name=store]', s0);
    await page.click('button[type=submit]'); await page.waitForTimeout(150);
    const s = await state(page); sr[s0] = { accepted: !s.storeErr, err: s.storeErr }; await page.goto(BASE); }
  log('storeMatrix', sr); await ctx.close(); }

// 3 long input
{ const { ctx, page, reqs } = await setup(b, 'abort');
  const long = 'x'.repeat(5000);
  await fill(page, { email: 'a'.repeat(300) + '@shop.com', store: 'shop.com/' + 'p'.repeat(400), name: long, message: ('ünïcødé ' + long) });
  const vals = await page.evaluate(() => { const f = document.querySelector('form[data-pf-review]'); return { e: f.elements.email.value.length, s: f.elements.store.value.length, n: f.elements.name.value.length, m: f.elements.message.value.length }; });
  log('longLengths', vals);
  await page.fill('[name=email]', 'me@shop.com'); await page.fill('[name=store]', 'shop.com');
  await page.fill('[name=message]', 'é'.repeat(2000));
  await page.click('button[type=submit]'); await page.waitForTimeout(300);
  const href = await page.evaluate(() => document.querySelector('[data-pf-status] a')?.href);
  log('longMailto', { len: href && href.length, decodedBodyLen: href && decodeURIComponent(href.split('body=')[1]).length });
  const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  log('longOverflow', ov);
  await ctx.close(); }

// 4 success
{ const { ctx, page, reqs } = await setup(b, 'ok');
  await fill(page, { email: 'Me+test@Sub.Shop.com ', store: 'https://mystore.myshopify.com/products/x', name: 'Jo', message: 'Raise the $40 tee to $44' });
  await page.click('button[type=submit]'); await page.waitForTimeout(500);
  log('success', { ...(await state(page)), reqs });
  // back/forward after success: navigate away and back
  await page.goto(BASE + 'about'); await page.goBack(); await page.waitForTimeout(500);
  log('successBack', await state(page));
  await ctx.close(); }

// 5 duplicate, busy, abort, html, 500
for (const m of ['dup', 'busy', 'abort', 'html', '500']) {
  const { ctx, page, reqs } = await setup(b, m);
  await fill(page, { email: 'me@shop.com', store: 'shop.com', name: 'A', message: 'hello' });
  await page.click('button[type=submit]'); await page.waitForTimeout(800);
  const s = await state(page);
  const href = await page.evaluate(() => document.querySelector('[data-pf-status] a')?.getAttribute('href'));
  log('mode_' + m, { ...s, mailto: href && decodeURIComponent(href), reqCount: reqs.filter(x => x.method).length });
  await ctx.close();
}

// 6 offline
{ const { ctx, page, reqs } = await setup(b, 'ok');
  await fill(page, { email: 'me@shop.com', store: 'shop.com' });
  await ctx.setOffline(true);
  await page.click('button[type=submit]'); await page.waitForTimeout(500);
  log('offline', { ...(await state(page)), reqs });
  await ctx.setOffline(false);
  await page.click('button[type=submit]'); await page.waitForTimeout(500);
  log('offlineRetry', { kind: (await state(page)).kind, formState: (await state(page)).formState, reqs: reqs.length });
  await ctx.close(); }

// 7 double submit: rapid clicks + Enter spam
{ const { ctx, page, reqs } = await setup(b, 'slow2');
  await fill(page, { email: 'me@shop.com', store: 'shop.com' });
  await page.click('button[type=submit]', { clickCount: 5, delay: 0 });
  await page.focus('[name=store]');
  for (let i = 0; i < 10; i++) await page.keyboard.press('Enter');
  const mid = await state(page);
  await page.waitForTimeout(3500);
  log('doubleSubmit', { reqCount: reqs.filter(x => x.method).length, mid: { btn: mid.btn, dis: mid.btnDisabled, status: mid.status }, end: await state(page) });
  await ctx.close(); }

// 7b submit then edit fields mid-flight then submit again after success? (fields hidden)
// 8 timeout (20 s slow response)
{ const { ctx, page, reqs } = await setup(b, 'slow');
  await fill(page, { email: 'me@shop.com', store: 'shop.com' });
  const t0 = Date.now();
  await page.click('button[type=submit]');
  await page.waitForFunction(() => document.querySelector('[data-pf-status]').getAttribute('data-kind') === 'error', null, { timeout: 25000 });
  log('timeout', { ms: Date.now() - t0, ...(await state(page)) });
  await ctx.close(); }

// 9 XSS
{ const { ctx, page, reqs } = await setup(b, 'dup');
  let dialog = false; page.on('dialog', d => { dialog = true; d.dismiss(); });
  await fill(page, { email: '"><img src=x onerror=alert(1)>@x.com', store: 'shop.com/"><svg/onload=alert(2)>', name: '<script>alert(3)</script>', message: '</a><img src=x onerror=alert(4)>' });
  await page.click('button[type=submit]'); await page.waitForTimeout(600);
  const s1 = await state(page);
  await page.goto(BASE);
  await fill(page, { email: 'x"onmouseover="alert(1)@x.com', store: 'shop.com/x"onclick="alert(5)', name: '"><b>', message: "'\"<>" });
  await page.click('button[type=submit]'); await page.waitForTimeout(600);
  const s2 = await state(page);
  const imgs = await page.evaluate(() => document.querySelectorAll('[data-pf-status] img, [data-pf-status] svg, [data-pf-status] script, [data-pf-status] b').length);
  log('xss', { dialog, s1kind: s1.kind, s1html: s1.statusHTML.slice(0, 400), s2html: s2.statusHTML.slice(0, 400), injectedNodes: imgs });
  await ctx.close(); }

// 10 keyboard-only + SR semantics
{ const { ctx, page, reqs } = await setup(b, 'ok');
  await page.focus('#rv-email');
  await page.keyboard.type('bad');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  const onBtn = await page.evaluate(() => document.activeElement.tagName + ':' + document.activeElement.textContent);
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  const afterInvalid = await state(page);
  const ax = await page.evaluate(() => {
    const e = document.getElementById('rv-email');
    return { describedby: e.getAttribute('aria-describedby'), required: e.required, ariaRequired: e.getAttribute('aria-required'), errId: document.getElementById(e.getAttribute('aria-describedby'))?.textContent };
  });
  await page.keyboard.press('Control+A'); await page.keyboard.type('me@shop.com');
  await page.keyboard.press('Tab'); await page.keyboard.type('shop.com'); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  const snap = await page.accessibility?.snapshot?.({ root: await page.$('form') }).catch(() => null);
  log('keyboard', { onBtn, afterInvalid: { active: afterInvalid.active, status: afterInvalid.status, emailErr: afterInvalid.emailErr }, ax, done: await state(page) });
  // tab order inside page
  await page.goto(BASE);
  const order = [];
  for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => { const a = document.activeElement; return (a.id || a.getAttribute('href') || a.tagName) + (a.textContent ? '|' + a.textContent.trim().slice(0, 25) : ''); })); }
  log('tabOrder', order);
  await ctx.close(); }

// 11 bfcache off: back after success with no-store? check nav to about and back with bfcache disabled via CDP
{ const ctx = await b.newContext(); const page = await ctx.newPage();
  await page.route('**/script.google.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  const cdp = await ctx.newCDPSession(page);
  await page.goto(BASE);
  await page.addInitScript(() => { window.addEventListener('unload', () => {}); }); // unload handler blocks bfcache
  await page.evaluate(() => window.addEventListener('unload', () => {}));
  await fill(page, { email: 'me@shop.com', store: 'shop.com', message: 'my note' });
  await page.goto(BASE + 'legal'); await page.goBack(); await page.waitForTimeout(500);
  log('backBeforeSubmitNoBfcache', (await state(page)).values);
  await fill(page, { email: 'me@shop.com', store: 'shop.com', message: 'my note' });
  await page.click('button[type=submit]'); await page.waitForTimeout(400);
  await page.goto(BASE + 'legal'); await page.goBack(); await page.waitForTimeout(500);
  log('backAfterSubmitNoBfcache', await state(page));
  await ctx.close(); }

// 12 honeypot autofill risk
{ const { ctx, page, reqs } = await setup(b, 'ok');
  await fill(page, { email: 'me@shop.com', store: 'shop.com', company_website: 'https://acme.com' });
  await page.click('button[type=submit]'); await page.waitForTimeout(400);
  log('honeypot', { ...(await state(page)), sent: reqs.filter(x => x.method).length });
  await ctx.close(); }

// 13 payload check
{ const { ctx, page, reqs } = await setup(b, 'ok');
  await fill(page, { email: 'me@shop.com', store: 'shop.com', name: 'N', message: 'm'.repeat(3000) });
  await page.click('button[type=submit]'); await page.waitForTimeout(400);
  const body = JSON.parse(reqs.find(x => x.method).body);
  log('payload', { ct: reqs.find(x => x.method).ct, keys: Object.keys(body), pageLen: body.page.length, page: body.page.slice(0, 160), msgLen: body.message.length, price: body.price });
  await ctx.close(); }

await b.close();

// webkit success + error
const w = await webkit.launch();
for (const m of ['ok', 'abort']) {
  const { ctx, page, reqs } = await setup(w, m);
  await fill(page, { email: 'me@shop.com', store: 'shop.com' });
  await page.click('button[type=submit]'); await page.waitForTimeout(800);
  const s = await state(page); log('webkit_' + m, { kind: s.kind, status: s.status, active: s.active, reqs: reqs.length });
  await ctx.close();
}
await w.close();
import('node:fs').then(fs => fs.writeFileSync(new URL('./forms.json', import.meta.url), JSON.stringify(out, null, 2)));
