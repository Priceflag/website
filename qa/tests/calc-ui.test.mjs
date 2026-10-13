// Breakeven calculator in a real browser (Chromium), served by qa/serve.mjs.
// PAGE is the one place to change when the calculator moves into index.html ('/').
// qa/serve.mjs hides qa/ (it is in .vercelignore), so requests under /qa/ are answered from disk here.
// Nothing reaches the network: everything not on the local server is aborted.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from '../serve.mjs';

const PAGE = '/';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };
let srv, browser;

before(async () => {
  srv = await startServer();
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  await srv?.close();
});

async function open({ reducedMotion = 'no-preference', javaScriptEnabled = true, width = 1280 } = {}) {
  const ctx = await browser.newContext({ reducedMotion, javaScriptEnabled, viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== srv.url) return route.abort();
    if (url.pathname.startsWith('/qa/')) {
      const file = path.join(ROOT, decodeURIComponent(url.pathname));
      if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'Not found' });
      return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    }
    return route.continue();
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    window.__calcEvents = [];
    window.addEventListener('pf:calc-used', (e) => window.__calcEvents.push(e.detail));
  });
  await page.goto(srv.url + PAGE);
  return { ctx, page, errors };
}

const answer = (page) => page.locator('[data-pf-calc-answer]').textContent();
const support = (page) => page.locator('[data-pf-calc-support]').textContent();
const events = (page) => page.evaluate(() => window.__calcEvents);

async function setField(page, sel, value) {
  await page.fill(sel, '');
  await page.type(sel, value);
}

test('default answer shows on load, and matches the math', async () => {
  const { ctx, page, errors } = await open();
  assert.equal(await answer(page), 'You can lose up to 17.2% of orders and still make the same profit.');
  assert.equal(await support(page), 'Profit per order goes from $14.40 to $17.40.');
  assert.equal(await page.locator('[data-pf-calc-figure]').textContent(), '17.2%');
  assert.equal(await page.getAttribute('#calc-price', 'readonly'), null);
  assert.equal(await page.getAttribute('#calc-price', 'inputmode'), 'decimal');
  assert.equal(await page.getAttribute('#calc-price', 'autocomplete'), 'off');
  assert.deepEqual(await events(page), []); // no event for the default
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('with JavaScript off the example answer and a plain #review link are in the HTML', async () => {
  const { ctx, page } = await open({ javaScriptEnabled: false });
  assert.equal(await answer(page), 'You can lose up to 17.2% of orders and still make the same profit.');
  assert.equal(await page.getAttribute('[data-pf-calc-cta]', 'href'), '#review');
  assert.match(await page.textContent('[data-pf-calc-note]'), /Turn on JavaScript/);
  assert.notEqual(await page.getAttribute('#calc-price', 'readonly'), null);
  await ctx.close();
});

test('typing updates the answer live (debounced, no Enter); Enter updates at once', async () => {
  const { ctx, page } = await open();
  await setField(page, '#calc-new', '30');
  await page.waitForFunction(() => /29\.4%/.test(document.querySelector('[data-pf-calc-answer]').textContent));
  assert.equal(await answer(page), 'You can lose up to 29.4% of orders and still make the same profit.');
  assert.equal(await support(page), 'Profit per order goes from $14.40 to $20.40.');
  assert.equal(await page.isVisible('[data-pf-calc-note]'), false); // "example numbers" note goes once you type

  await setField(page, '#calc-price', '27');
  await setField(page, '#calc-new', '24');
  await page.keyboard.press('Enter'); // immediate, no debounce wait
  assert.equal(await answer(page), 'You need 20.9% more orders to make the same profit.');
  assert.equal(await support(page), 'Profit per order goes from $17.40 to $14.40.');
  await ctx.close();
});

test('edge-case messages: same price, below cost, at-or-below cost today, zero cost', async () => {
  const { ctx, page } = await open();
  await setField(page, '#calc-new', '$24.00');
  await page.keyboard.press('Enter');
  assert.equal(await answer(page), 'Same price, so nothing changes.');

  await setField(page, '#calc-new', '8');
  await page.keyboard.press('Enter');
  assert.equal(await answer(page), 'At $8.00 you lose $1.60 on every order, so no number of extra orders makes it profitable.');

  await setField(page, '#calc-new', '27');
  await setField(page, '#calc-price', '9.60');
  await page.keyboard.press('Enter');
  assert.match(await answer(page), /you make \$0\.00 per order today/);
  assert.match(await support(page), /needs a price above your unit cost today/);

  await setField(page, '#calc-price', '24');
  await setField(page, '#calc-cost', '0');
  await page.keyboard.press('Enter');
  assert.equal(await answer(page), 'You can lose up to 11.1% of orders and still make the same profit.');
  assert.equal(await page.locator('[aria-invalid="true"]').count(), 0);
  await ctx.close();
});

test('pasted "$1,234.50" works', async () => {
  const { ctx, page } = await open();
  await page.focus('#calc-price');
  await page.keyboard.press('ControlOrMeta+a');
  // A paste inserts the clipboard text in one input event, which is what insertText does.
  await page.keyboard.insertText('$1,234.50');
  await setField(page, '#calc-new', '$1,299.99');
  await page.keyboard.press('Enter');
  assert.equal(await page.inputValue('#calc-price'), '$1,234.50');
  // m0 = 123450 - 960 = 122490, m1 = 129999 - 960 = 129039: 1 - m0/m1 = 5.075...% -> 5%
  assert.equal(await answer(page), 'You can lose up to 5% of orders and still make the same profit.');
  await ctx.close();
});

test('non-numeric input shows a specific error under the field, and errors clear when fixed', async () => {
  const { ctx, page } = await open();
  const cases = [
    ['abc', /Enter a dollar amount/],
    ['1e5', /Enter a dollar amount/],
    ['--5', /Enter a dollar amount/],
    ['12.345', /at most two decimal places/],
    ['-5', /Enter a price above \$0/],
    ['0', /Enter a price above \$0/],
    ['2000000', /up to \$1,000,000\.00/],
  ];
  for (const [value, re] of cases) {
    await setField(page, '#calc-price', value);
    await page.waitForTimeout(200); // the live (debounced) update, no Enter
    assert.equal(await page.getAttribute('#calc-price', 'aria-invalid'), 'true', value);
    assert.match(await page.textContent('#calc-price-err'), re, value);
    assert.equal(await answer(page), 'Fix the highlighted number to see your breakeven.', value);
    assert.equal(await page.locator('[data-pf-calc-figure]').count(), 0, value);
  }
  const color = await page.$eval('#calc-price-err', (el) => getComputedStyle(el).color);
  assert.equal(color, 'rgb(255, 157, 122)'); // --pf-bad
  await setField(page, '#calc-price', '24');
  await page.keyboard.press('Enter');
  assert.equal(await page.getAttribute('#calc-price', 'aria-invalid'), null);
  assert.equal(await page.textContent('#calc-price-err'), '');
  assert.match(await answer(page), /17\.2%/);
  // Negative unit cost has its own wording.
  await setField(page, '#calc-cost', '-1');
  await page.keyboard.press('Enter');
  assert.match(await page.textContent('#calc-cost-err'), /unit cost of \$0 or more/);
  await ctx.close();
});

test('empty fields prompt without error styling until left or Enter', async () => {
  const { ctx, page } = await open();
  await page.fill('#calc-new', '');
  await page.waitForTimeout(250);
  assert.equal(await answer(page), 'Enter all three numbers to see your breakeven.');
  assert.equal(await page.getAttribute('#calc-new', 'aria-invalid'), null);
  assert.equal(await page.textContent('#calc-new-err'), '');
  await page.keyboard.press('Enter');
  assert.equal(await page.getAttribute('#calc-new', 'aria-invalid'), 'true');
  assert.equal(await page.textContent('#calc-new-err'), 'Enter the new price.');
  await ctx.close();
});

test('an empty field gets its error when focus leaves it', async () => {
  const { ctx, page } = await open();
  await page.fill('#calc-cost', '');
  await page.waitForTimeout(250);
  assert.equal(await page.getAttribute('#calc-cost', 'aria-invalid'), null);
  await page.keyboard.press('Tab');
  assert.equal(await page.textContent('#calc-cost-err'), 'Enter the unit cost.');
  await ctx.close();
});

test('the output region is a polite live region', async () => {
  const { ctx, page } = await open();
  const out = page.locator('[data-pf-calc-out]');
  assert.equal(await out.evaluate((el) => el.tagName), 'OUTPUT');
  assert.equal(await out.getAttribute('aria-live'), 'polite');
  await ctx.close();
});

test('analytics: one pf:calc-used per new result, with direction only', async () => {
  const { ctx, page } = await open();
  await setField(page, '#calc-new', '30');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter'); // same result again: no second event
  await setField(page, '#calc-new', '20');
  await page.keyboard.press('Enter');
  await setField(page, '#calc-new', '24');
  await page.keyboard.press('Enter');
  await setField(page, '#calc-new', 'abc');
  await page.keyboard.press('Enter');
  const ev = await events(page);
  assert.deepEqual(ev, [{ direction: 'up' }, { direction: 'down' }, { direction: 'same' }, { direction: 'invalid' }]);
  await ctx.close();
});

test('CTA prefills the review form, scrolls, and focuses email', async () => {
  const { ctx, page } = await open({ reducedMotion: 'reduce' });
  await setField(page, '#calc-new', '27.50');
  await page.keyboard.press('Enter');
  assert.equal(await page.textContent('[data-pf-calc-cta]'), 'Get the full forecast for my store');
  await page.click('[data-pf-calc-cta]');
  const hidden = await page.$$eval('form[data-pf-review] input[type=hidden]', (els) => els.map((e) => [e.name, e.value, e.disabled]));
  assert.deepEqual(hidden, [['price', '24.00', false], ['newPrice', '27.50', false], ['cost', '9.60', false]]);
  assert.equal(await page.inputValue('#rv-message'), 'Current price $24.00, new price $27.50, unit cost $9.60.');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'rv-email');
  assert.equal(await page.evaluate(() => location.hash), '#review');
  // The email field is on screen, below the sticky nav.
  const box = await page.$eval('#rv-email', (el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
  assert.ok(box.top >= 56 && box.bottom <= 900, `email at ${JSON.stringify(box)}`);

  // Running it again replaces our own line but never a note the visitor wrote.
  await page.evaluate(() => window.scrollTo(0, 0));
  await setField(page, '#calc-new', '30');
  await page.keyboard.press('Enter');
  await page.click('[data-pf-calc-cta]');
  assert.equal(await page.inputValue('#rv-message'), 'Current price $24.00, new price $30.00, unit cost $9.60.');
  await page.fill('#rv-message', 'Our candle line');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('[data-pf-calc-cta]');
  assert.equal(await page.inputValue('#rv-message'), 'Our candle line');
  await ctx.close();
});

test('CTA with an invalid field leaves that hidden input disabled and the note alone', async () => {
  const { ctx, page } = await open();
  await setField(page, '#calc-cost', 'abc');
  await page.click('[data-pf-calc-cta]');
  const hidden = await page.$$eval('form[data-pf-review] input[type=hidden]', (els) => els.map((e) => [e.name, e.value, e.disabled]));
  assert.deepEqual(hidden, [['price', '24.00', false], ['newPrice', '27.00', false], ['cost', '', true]]);
  assert.equal(await page.inputValue('#rv-message'), '');
  await ctx.close();
});

test('prefilled numbers reach the review submission', async () => {
  const { ctx, page } = await open({ reducedMotion: 'reduce' });
  const calls = [];
  await page.route(/script\.google\.com\/macros\//, (route) => {
    calls.push(route.request().postData());
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true}' });
  });
  await page.click('[data-pf-calc-cta]');
  await page.keyboard.type('merchant@example.com');
  await page.fill('#rv-store', 'examplestore.com');
  await page.click('#review button[type=submit]');
  await page.waitForSelector('form[data-state="sent"]');
  const body = JSON.parse(calls[0]);
  assert.equal(body.price, 24);
  assert.equal(body.testPrice, 27);
  assert.equal(body.cost, 9.6);
  assert.equal(body.message, 'Current price $24.00, new price $27.00, unit cost $9.60.');
  await ctx.close();
});

test('the answer number fades in (200ms) only when motion is allowed', async () => {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const { ctx, page } = await open({ reducedMotion });
    await setField(page, '#calc-new', '30');
    await page.keyboard.press('Enter');
    const anim = await page.$eval('[data-pf-calc-figure]', (el) => {
      const s = getComputedStyle(el);
      return { name: s.animationName, dur: s.animationDuration };
    });
    if (reducedMotion === 'reduce') assert.equal(anim.name, 'none');
    else assert.deepEqual(anim, { name: 'pf-calc-in', dur: '0.2s' });
    await ctx.close();
  }
});

test('no horizontal scroll at 320, 375, 768 and 1440', async () => {
  for (const width of [320, 375, 768, 1440]) {
    const { ctx, page } = await open({ width });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(over <= 0, `${width}px overflows by ${over}px`);
    await ctx.close();
  }
});
