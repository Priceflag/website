// "Get a free price review" form, with the Apps Script endpoint mocked.
// Nothing here reaches the network: every request that is not to the local
// server is either fulfilled by a mock or aborted.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from '../serve.mjs';

const ENDPOINT = /script\.google\.com\/macros\//;
let srv, browser;

before(async () => {
  srv = await startServer();
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  await srv?.close();
});

async function openForm(handler) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const calls = [];
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(srv.url)) return route.continue();
    if (ENDPOINT.test(url)) {
      calls.push(route.request().postData());
      return handler(route, calls.length);
    }
    return route.abort();
  });
  await page.goto(srv.url + '/');
  await page.locator('#review').scrollIntoViewIfNeeded();
  return { ctx, page, calls };
}

const ok = (body) => (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

async function fill(page, { email = 'merchant@example.com', store = 'examplestore.com', name = '', message = '' } = {}) {
  await page.fill('#rv-email', email);
  await page.fill('#rv-store', store);
  if (name) await page.fill('#rv-name', name);
  if (message) await page.fill('#rv-message', message);
}

const status = (page) => page.locator('[data-pf-status]');

test('empty submit shows inline errors and sends nothing', async () => {
  const { ctx, page, calls } = await openForm(ok({ ok: true }));
  await page.click('#review button[type=submit]');
  assert.equal(await page.getAttribute('#rv-email', 'aria-invalid'), 'true');
  assert.equal(await page.getAttribute('#rv-store', 'aria-invalid'), 'true');
  assert.match(await page.textContent('#rv-email-err'), /email/i);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'rv-email');
  assert.equal(calls.length, 0);
  await ctx.close();
});

test('invalid email and store are rejected', async () => {
  const { ctx, page, calls } = await openForm(ok({ ok: true }));
  await fill(page, { email: 'not-an-email', store: 'nope' });
  await page.click('#review button[type=submit]');
  assert.equal(await page.getAttribute('#rv-email', 'aria-invalid'), 'true');
  assert.equal(await page.getAttribute('#rv-store', 'aria-invalid'), 'true');
  assert.equal(calls.length, 0);
  await ctx.close();
});

test('success sends text/plain JSON once and shows the success state', async () => {
  const { ctx, page, calls } = await openForm(ok({ ok: true }));
  await fill(page, { name: 'Ada', message: 'Our $24 candle' });
  await page.click('#review button[type=submit]');
  await page.waitForSelector('form[data-state="sent"]');
  assert.match(await status(page).textContent(), /merchant@example\.com.*48 hours/);
  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0]);
  assert.equal(body.email, 'merchant@example.com');
  assert.equal(body.store, 'examplestore.com');
  assert.equal(body.source, 'price-review');
  assert.ok(body.page.startsWith('https://priceflag.org/'), 'page must pass the script prefix guard');
  assert.ok(body.page.length <= 300);
  assert.match(body.page, /store=examplestore\.com/);
  await ctx.close();
});

test('double-click submits only once', async () => {
  const { ctx, page, calls } = await openForm(async (route) => {
    await new Promise((r) => setTimeout(r, 600));
    return ok({ ok: true })(route);
  });
  await fill(page);
  await page.click('#review button[type=submit]');
  await page.locator('#review button[type=submit]').click({ force: true }).catch(() => {});
  await page.evaluate(() => document.querySelector('form[data-pf-review]').requestSubmit());
  await page.waitForSelector('form[data-state="sent"]');
  assert.equal(calls.length, 1);
  await ctx.close();
});

test('endpoint failure keeps the input and offers a prefilled email', async () => {
  const { ctx, page } = await openForm((route) => route.abort('failed'));
  await fill(page, { message: 'keep me' });
  await page.click('#review button[type=submit]');
  await page.waitForSelector('[data-pf-status][data-kind="error"]');
  assert.match(await status(page).textContent(), /couldn’t confirm/);
  const href = await status(page).locator('a').getAttribute('href');
  assert.ok(href.startsWith('mailto:hello@priceflag.org'));
  assert.match(decodeURIComponent(href), /examplestore\.com/);
  assert.equal(await page.inputValue('#rv-email'), 'merchant@example.com');
  assert.equal(await page.inputValue('#rv-message'), 'keep me');
  assert.equal(await page.isDisabled('#review button[type=submit]'), false);
  await ctx.close();
});

test('ok:false from the script is treated as a failure', async () => {
  const { ctx, page } = await openForm(ok({ ok: false, error: 'busy' }));
  await fill(page);
  await page.click('#review button[type=submit]');
  await page.waitForSelector('[data-pf-status][data-kind="error"]');
  assert.equal(await page.inputValue('#rv-store'), 'examplestore.com');
  await ctx.close();
});

test('offline shows an error without sending', async () => {
  const { ctx, page, calls } = await openForm(ok({ ok: true }));
  await fill(page);
  await ctx.setOffline(true);
  await page.click('#review button[type=submit]');
  await page.waitForSelector('[data-pf-status][data-kind="error"]');
  assert.match(await status(page).textContent(), /offline/i);
  assert.equal(calls.length, 0);
  await ctx.close();
});

test('duplicate email is acknowledged honestly', async () => {
  const { ctx, page } = await openForm(ok({ ok: true, duplicate: true }));
  await fill(page);
  await page.click('#review button[type=submit]');
  await page.waitForSelector('form[data-state="sent"]');
  assert.match(await status(page).textContent(), /already had a request/);
  await ctx.close();
});

test('very long input is capped and still submits', async () => {
  const { ctx, page, calls } = await openForm(ok({ ok: true }));
  await fill(page, { name: 'n'.repeat(500), message: 'm'.repeat(6000) });
  assert.equal((await page.inputValue('#rv-name')).length, 120);
  assert.equal((await page.inputValue('#rv-message')).length, 6000, 'no silent cut on paste');
  await page.click('#review button[type=submit]');
  await page.waitForSelector('form[data-state="sent"]');
  assert.ok(JSON.parse(calls[0]).page.length <= 300);
  await ctx.close();
});

test('a note that fits is stored whole; a longer one is flagged with a mailto', async () => {
  const short = await openForm(ok({ ok: true }));
  await fill(short.page, { message: 'Thinking of moving our $24 candle to $27.' });
  await short.page.click('#review button[type=submit]');
  await short.page.waitForSelector('form[data-state="sent"]');
  const sb = JSON.parse(short.calls[0]);
  assert.match(decodeURIComponent(sb.page), /\$24 candle to \$27\./);
  assert.doesNotMatch(await status(short.page).textContent(), /longer than/);
  await short.ctx.close();

  const long = await openForm(ok({ ok: true }));
  const note = Array.from({ length: 80 }, (_, i) => 'word' + i).join(' ');
  await fill(long.page, { message: note });
  await long.page.click('#review button[type=submit]');
  await long.page.waitForSelector('form[data-state="sent"]');
  const lb = JSON.parse(long.calls[0]);
  assert.ok(lb.page.length <= 300 && lb.ua.length <= 300);
  assert.ok(lb.ua.startsWith('note: '));
  assert.match(await status(long.page).textContent(), /longer than our form can store/);
  const href = await status(long.page).locator('a').getAttribute('href');
  assert.ok(decodeURIComponent(href).includes('word79'), 'mailto carries the full note');
  await long.ctx.close();
});

test('a filled honeypot still sends, flagged, instead of a fake thanks', async () => {
  const { ctx, page, calls } = await openForm(ok({ ok: true }));
  await fill(page);
  await page.evaluate(() => { document.querySelector('[name=pf_hp_field]').value = 'autofilled'; });
  await page.click('#review button[type=submit]');
  await page.waitForSelector('form[data-state="sent"]');
  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0]);
  assert.equal(body.hp, 1);
  assert.ok(body.page.length <= 300);
  await ctx.close();
});

test('mailto fallback stays under 1,800 characters and carries the email', async () => {
  const { ctx, page } = await openForm((route) => route.abort('failed'));
  await fill(page, { message: 'é'.repeat(2000) });
  await page.click('#review button[type=submit]');
  await page.waitForSelector('[data-pf-status][data-kind="error"]');
  const href = await status(page).locator('a').getAttribute('href');
  assert.ok(href.length <= 1800, `mailto is ${href.length} chars`);
  const decoded = decodeURIComponent(href);
  assert.match(decoded, /Email: merchant@example\.com/);
  assert.match(decoded, /Note shortened/);
  await ctx.close();
});

test('coming back after a successful request shows it was sent, with a way to send another', async () => {
  const { ctx, page } = await openForm(ok({ ok: true }));
  await fill(page);
  await page.click('#review button[type=submit]');
  await page.waitForSelector('form[data-state="sent"]');
  await page.reload();
  await page.waitForSelector('form[data-state="sent"]');
  assert.match(await status(page).textContent(), /already have your request/);
  await page.click('[data-pf-again]');
  assert.equal(await page.getAttribute('form[data-pf-review]', 'data-state'), null);
  assert.equal(await page.isVisible('#rv-store'), true);
  await ctx.close();
});

test('a 5xx or non-JSON reply says we could not confirm, and keeps the input', async () => {
  const { ctx, page } = await openForm((route) => route.fulfill({ status: 200, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>oops</html>' }));
  await fill(page);
  await page.click('#review button[type=submit]');
  await page.waitForSelector('[data-pf-status][data-kind="error"]');
  assert.match(await status(page).textContent(), /couldn’t confirm/);
  assert.equal(await page.inputValue('#rv-email'), 'merchant@example.com');
  await ctx.close();
});

test('email and store validation edge cases', async () => {
  const { ctx, page, calls } = await openForm(ok({ ok: true }));
  for (const email of ['a@b..com', 'a@b.com.']) {
    await fill(page, { email });
    await page.click('#review button[type=submit]');
    assert.equal(await page.getAttribute('#rv-email', 'aria-invalid'), 'true', email);
  }
  for (const store of ['shop.com?ref=x', 'www.shop.com:8080', 'café.com', 'https://shop.myshopify.com/products/a']) {
    await fill(page, { email: 'not-valid', store }); // invalid email keeps the form from sending
    await page.click('#review button[type=submit]');
    assert.equal(await page.getAttribute('#rv-store', 'aria-invalid'), null, store);
  }
  assert.equal(calls.length, 0);
  await ctx.close();
});

test('without JavaScript the form is replaced by an email link and never puts data in a URL', async () => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(srv.url + '/');
  const f = await page.$eval('form[data-pf-review]', (el) => ({ action: el.getAttribute('action'), method: el.method }));
  assert.equal(f.action, null, 'no mailto action (mixed-content warning on https)');
  assert.equal(f.method, 'post');
  assert.equal(await page.isVisible('#rv-email'), false);
  const href = await page.getAttribute('#review noscript ~ *, #review .pf-form-note a[href^="mailto:"]', 'href').catch(() => null);
  assert.ok(await page.isVisible('#review a[href^="mailto:hello@priceflag.org"]'));
  await ctx.close();
});

test('emoji and other astral characters never hang the form', async () => {
  for (const [label, data] of [
    ['note', { message: 'Candles 🕯️ are our best sellers 🔥'.repeat(20) }],
    ['name at the cut', { name: 'n'.repeat(49) + '😀😀' }],
    ['store', { store: 'x'.repeat(100) + '😀.com' }],
  ]) {
    const { ctx, page, calls } = await openForm(ok({ ok: true }));
    await fill(page, data);
    await page.click('#review button[type=submit]');
    await page.waitForSelector('form[data-state="sent"], [data-pf-status][data-kind="error"]', { timeout: 5000 });
    assert.equal(await page.textContent('#review button[type=submit]'), 'Get a free price review', label);
    if (calls.length) {
      const b = JSON.parse(calls[0]);
      assert.ok(b.page.length <= 300 && b.ua.length <= 300, label);
      assert.doesNotThrow(() => decodeURIComponent(b.page), label);
    }
    await ctx.close();
  }
  // Failure path with an emoji-heavy note still offers a valid mailto.
  const { ctx, page } = await openForm((route) => route.abort('failed'));
  await fill(page, { message: '🕯️'.repeat(1500) });
  await page.click('#review button[type=submit]');
  await page.waitForSelector('[data-pf-status][data-kind="error"]');
  const href = await status(page).locator('a').getAttribute('href');
  assert.ok(href.length <= 1800);
  assert.doesNotThrow(() => decodeURIComponent(href));
  await ctx.close();
});

test('honeypot flag survives a long note', async () => {
  const { ctx, page, calls } = await openForm(ok({ ok: true }));
  await fill(page, { message: 'm'.repeat(1000) });
  await page.evaluate(() => { document.querySelector('[name=pf_hp_field]').value = 'bot'; });
  await page.click('#review button[type=submit]');
  await page.waitForSelector('form[data-state="sent"]');
  const b = JSON.parse(calls[0]);
  assert.match(b.page, /#review\?hp=1&host=/);
  assert.ok(b.page.length <= 300);
  await ctx.close();
});

test('focus stays on the button while sending, and "too long" names the right field', async () => {
  const { ctx, page } = await openForm(async (route) => { await new Promise((r) => setTimeout(r, 400)); return ok({ ok: true })(route); });
  await fill(page, { name: 'n'.repeat(80) });
  await page.focus('#review button[type=submit]');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('type')), 'submit');
  await page.waitForSelector('form[data-state="sent"]');
  const t = await status(page).textContent();
  assert.doesNotMatch(t, /note was longer/);
  assert.match(t, /store address or name was longer/);
  await ctx.close();
});

test('joiners survive in name and note; marks are stripped from email', async () => {
  const { ctx, page, calls } = await openForm(ok({ ok: true }));
  await fill(page, { email: 'merchant@example.com‏', name: 'علی‌رضا', message: 'family 👨‍👩‍👧' });
  await page.click('#review button[type=submit]');
  await page.waitForSelector('form[data-state="sent"]');
  const b = JSON.parse(calls[0]);
  assert.equal(b.email, 'merchant@example.com');
  assert.equal(b.name, 'علی‌رضا');
  assert.equal(b.message, 'family 👨‍👩‍👧');
  await ctx.close();
});

test('leaving mid-send and coming back says the request may have arrived', async () => {
  const { ctx, page } = await openForm(() => new Promise(() => {})); // never answers
  await fill(page);
  await page.click('#review button[type=submit]');
  await page.waitForTimeout(150);
  await page.reload();
  assert.match(await status(page).textContent(), /may already have reached us/);
  await ctx.close();
});
