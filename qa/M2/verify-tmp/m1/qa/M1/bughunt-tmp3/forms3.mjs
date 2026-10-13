import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
const BASE = 'http://localhost:8933/';
const which = process.argv[2] || 'chromium';
const engine = which === 'webkit' ? webkit : chromium;
const out = {};
const log = (k, v) => { out[k] = v; console.log('\n##', k, JSON.stringify(v).slice(0, 1500)); };
const ACAO = { 'access-control-allow-origin': '*' };

async function setup(browser, mode, opts = {}, url = BASE) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const reqs = [];
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push('console:' + m.text()); });
  page.on('pageerror', e => errs.push('pageerror:' + e.message));
  await ctx.route('**/*', async route => {
    const u = route.request().url();
    if (u.startsWith(BASE) || u.includes('fonts.g')) return route.continue();
    if (!/script\.google\.com/.test(u)) return route.abort();
    const r = route.request();
    reqs.push({ method: r.method(), body: r.postData(), ct: r.headers()['content-type'] });
    const m = typeof mode === 'function' ? mode(reqs.length) : mode;
    const json = b => route.fulfill({ status: 200, contentType: 'application/json', headers: ACAO, body: b });
    if (m === 'ok') return json('{"ok":true}');
    if (m === 'dup') return json('{"ok":true,"duplicate":true}');
    if (m === 'rejected') return json('{"ok":false,"error":"bad"}');
    if (m === 'null') return json('null');
    if (m === 'empty') return json('');
    if (m === 'okstr') return json('"ok"');
    if (m === 'html') return route.fulfill({ status: 200, contentType: 'text/html', headers: ACAO, body: '<html>Sign in</html>' });
    if (m === 'noacao') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    if (m === 'abort') return route.abort('failed');
    if (m === 'reset') return route.abort('connectionreset');
    if (m === '500') return route.fulfill({ status: 500, headers: ACAO, body: 'err' });
    if (m === '302' && which !== 'webkit') return route.fulfill({ status: 302, headers: { ...ACAO, location: 'https://script.googleusercontent.com/macros/echo?x=1' } });
    if (m === 'slow') { await new Promise(r => setTimeout(r, 2500)); return json('{"ok":true}').catch(() => {}); }
    if (m === 'hang') { await new Promise(r => setTimeout(r, 17000)); return json('{"ok":true}').catch(() => {}); }
    return route.abort();
  });
  await page.goto(url);
  return { ctx, page, reqs, errs };
}

async function state(page) {
  return page.evaluate(() => {
    const f = document.querySelector('form[data-pf-review]');
    const s = f.querySelector('[data-pf-status]');
    const again = f.querySelector('[data-pf-again]');
    const live = f.querySelector('[data-pf-live]');
    const btn = f.querySelector('button[type=submit]');
    return {
      formState: f.getAttribute('data-state'), kind: s.getAttribute('data-kind'), status: s.textContent,
      links: [...s.querySelectorAll('a')].map(a => a.getAttribute('href')),
      live: live && live.textContent,
      active: document.activeElement && (document.activeElement.id || document.activeElement.tagName + '.' + document.activeElement.className),
      values: { email: f.elements.email.value, store: f.elements.store.value, name: f.elements.name.value, message: f.elements.message.value.length },
      btn: btn.textContent, btnAria: btn.getAttribute('aria-disabled'), btnDisabled: btn.disabled,
      fieldsVisible: getComputedStyle(f.querySelector('.pf-form-fields')).display !== 'none',
      againVisible: again && !again.hidden && getComputedStyle(again).display !== 'none',
      ss: (() => { try { return sessionStorage.getItem('pf-review-sent'); } catch (e) { return 'ERR'; } })(),
      novalidate: f.noValidate, hpDisabled: f.elements.pf_hp_field.disabled,
      errs: [...f.querySelectorAll('[data-pf-error]')].map(e => e.textContent),
    };
  });
}
async function fill(page, d) { for (const [k, v] of Object.entries(d)) await page.fill(`[name="${k}"]`, v); }
const base = { email: 'me@shop.com', store: 'shop.com' };
const parse = b => { try { return JSON.parse(b); } catch (e) { return b; } };
const dec = s => { try { return decodeURIComponent(s); } catch (e) { return 'DECODE ERROR ' + e.message; } };
const mailBody = l => l && l.includes('&body=') ? dec(l.split('&body=')[1]) : null;

const b = await engine.launch();
async function run(name, mode, d, after = 900, extra) {
  const { ctx, page, reqs, errs } = await setup(b, mode);
  await fill(page, d);
  if (extra) await extra(page);
  await page.click('button[type=submit]');
  await page.waitForTimeout(after);
  const s = await state(page);
  const p = reqs[0] ? parse(reqs[0].body) : null;
  const r = {
    reqs: reqs.length, kind: s.kind, status: s.status.slice(0, 200), btn: s.btn, btnAria: s.btnAria, active: s.active, errs, fieldErrs: s.errs,
    pageLen: p && p.page && p.page.length, uaLen: p && p.ua && p.ua.length, page: p && p.page, ua: p && p.ua && p.ua.slice(0, 120),
    pageDecodes: p && p.page ? !dec(p.page).startsWith('DECODE') : null, hp: p && p.hp,
    mailto: s.links.map(l => ({ len: l.length, body: (mailBody(l) || '').slice(0, 80), tail: (mailBody(l) || '').slice(-50), decodes: !String(mailBody(l)).startsWith('DECODE') })),
    values: s.values, ss: s.ss, formState: s.formState,
  };
  log(name, r);
  await ctx.close();
  return r;
}

// ---- R2-1 re-test: emoji / astral chars everywhere, at every cut point
const E = '😀', FLAG = '🇮🇳', ZWJ = '👨‍👩‍👧', REPL = '\uD83D'; // lone high surrogate typed via devtools
const emojiCases = {
  msgEmoji: { ...base, message: 'Raise the hoodie 😀 price please' },
  msgEmojiLong: { ...base, message: ('Price idea 💡 ').repeat(120) },
  msgAllEmoji: { ...base, message: E.repeat(600) },
  msgFlagsZWJ: { ...base, message: (FLAG + ZWJ + ' ').repeat(80) },
  nameEmojiAt50: { ...base, name: 'a'.repeat(49) + E + ' rest' },
  nameAllEmoji: { ...base, name: E.repeat(60) },
  storeEmojiAt110: { ...base, store: 'shop.com/' + 'a'.repeat(100) + E + 'x' },
  storeEmojiDomain: { ...base, store: E + E + '.com' },
  loneSurrogate: { ...base, name: 'Jo' + REPL, message: 'x' + REPL + 'y' },
  rtl: { ...base, name: 'محمد العربي', message: 'أريد تغيير سعر المنتج ‏هذا '.repeat(20) },
  cjk: { ...base, name: '山田太郎', message: '価格を変更したい '.repeat(120) },
  combining: { ...base, message: 'é'.repeat(400) },
};
for (const [k, d] of Object.entries(emojiCases)) for (const mode of ['ok', 'abort']) await run(`${k}/${mode}`, mode, d);

// ---- pack boundaries
await run('hpFilled1000', 'ok', { ...base, message: 'z'.repeat(1000) }, 900, p => p.evaluate(() => { document.querySelector('[name=pf_hp_field]').value = 'bot'; }));
await run('maxStoreName', 'ok', { email: 'me@shop.com', store: 'https://shop.myshopify.com/products/x?' + 'a=%20&b=ü&'.repeat(25), name: 'Zoë Ångström-Ñúñez '.repeat(6), message: 'short note' });
await run('storeE110', 'ok', { ...base, store: 'shop.com/' + 'é'.repeat(200) });
await run('longNameNoNote', 'ok', { ...base, name: 'N'.repeat(100) });
// note exactly fits page+ua? find boundary
for (const n of [150, 180, 200, 220, 450, 470, 480, 500]) await run('noteLen' + n, 'ok', { ...base, message: 'q'.repeat(n) });
await run('noteMaxlength5000', 'ok', { ...base, message: 'w'.repeat(6000) });
await run('noteNewlines', 'ok', { ...base, message: 'line\n'.repeat(80) });

// ---- mailto cap
for (const [k, d] of Object.entries({
  ascii: { ...base, message: 'word '.repeat(600) },
  nonascii: { ...base, message: 'é'.repeat(2000) },
  emoji: { ...base, message: E.repeat(900) },
  longEmailStore: { email: 'a'.repeat(240) + '@shop.com', store: 'shop.com/' + E.repeat(140), name: E.repeat(120), message: E.repeat(900) },
  quotesHtml: { ...base, store: 'shop.com/"><img src=x onerror=alert(1)>', message: '"><script>alert(1)</script>\'' },
})) await run('mailto/' + k, 'abort', d);

// ---- every response shape
for (const m of ['ok', 'dup', 'rejected', 'null', 'empty', 'okstr', 'html', 'noacao', 'abort', 'reset', '500', '302']) await run('resp/' + m, m, { ...base, name: 'Jo', message: 'hello' }, 1200);

// ---- validation edge cases
const vcases = {
  empty: { email: '', store: '' },
  spaces: { email: '   ', store: '   ' },
  rlmEmail: { email: 'me@shop.com‏', store: 'shop.com' },
  lrmStore: { email: 'me@shop.com', store: '‎shop.com' },
  nbspEmail: { email: 'me@shop.com ', store: 'shop.com' },
  softHyphen: { email: 'me@sh­op.com', store: 'shop.com' },
  zwspEmail: { email: 'me@shop.com​', store: 'shop.com​' },
  punycode: { ...base, store: 'shop.xn--p1ai' },
  storeHtml: { ...base, store: 'x.<script>' },
  storeComma: { ...base, store: 'shop.com,' },
  storeSpaceInside: { ...base, store: 'my shop.com' },
  storeEmail: { ...base, store: 'me@shop.com' },
  storeLong400: { ...base, store: 'https://shop.com/products/x?' + 'utm_source=aaaaaa&'.repeat(21) },
  email255: { email: 'a'.repeat(246) + '@shop.com', store: 'shop.com' },
  emailIDN: { email: 'me@магазин.рф', store: 'shop.com' },
  emailUnicodeLocal: { email: 'zoë@shop.com', store: 'shop.com' },
  emailFullwidthAt: { email: 'me＠shop.com', store: 'shop.com' },
};
for (const [k, d] of Object.entries(vcases)) await run('valid/' + k, 'ok', d, 600);

// ---- double submit, aria-disabled state, focus during sending
{
  const { ctx, page, reqs } = await setup(b, 'slow');
  await fill(page, base);
  await page.focus('button[type=submit]');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await page.click('button[type=submit]', { force: true });
  await page.dblclick('button[type=submit]', { force: true });
  await page.focus('#rv-email'); await page.keyboard.press('Enter');
  const mid = await state(page);
  // editing fields while sending: changes after send?
  await page.fill('#rv-store', 'changed-mid.com');
  await page.waitForTimeout(3200);
  const end = await state(page);
  log('doubleSubmit', { reqs: reqs.length, mid: { btn: mid.btn, aria: mid.btnAria, active: mid.active, live: mid.live }, end: { kind: end.kind, status: end.status, active: end.active, ss: end.ss } });
  await ctx.close();
}
// sending state: click focus stays on button?
{
  const { ctx, page } = await setup(b, 'slow');
  await fill(page, base);
  await page.focus('button[type=submit]'); await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const a1 = await page.evaluate(() => document.activeElement.textContent);
  await page.keyboard.press('Tab');
  const a2 = await page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
  await page.waitForTimeout(3000);
  log('focusWhileSending', { a1, nextTab: a2, end: (await state(page)).active });
  await ctx.close();
}
// ---- timeout (15 s)
{
  const { ctx, page, reqs } = await setup(b, 'hang');
  await fill(page, base);
  await page.click('button[type=submit]');
  await page.waitForTimeout(16000);
  const s = await state(page);
  log('timeout', { reqs: reqs.length, kind: s.kind, status: s.status, btn: s.btn, aria: s.btnAria, values: s.values, active: s.active });
  await ctx.close();
}
// ---- offline then online
{
  const { ctx, page, reqs } = await setup(b, 'ok');
  await fill(page, base); await ctx.setOffline(true);
  await page.click('button[type=submit]'); await page.waitForTimeout(300);
  const off = await state(page);
  await ctx.setOffline(false);
  await page.click('button[type=submit]'); await page.waitForTimeout(900);
  log('offline', { off: { status: off.status, kind: off.kind, values: off.values, links: off.links.length }, on: (await state(page)).status, reqs: reqs.length });
  await ctx.close();
}
// ---- failure then retry success (one request each)
{
  const { ctx, page, reqs } = await setup(b, n => n === 1 ? 'abort' : 'ok');
  await fill(page, base);
  await page.click('button[type=submit]'); await page.waitForTimeout(800);
  const f1 = await state(page);
  await page.click('button[type=submit]'); await page.waitForTimeout(800);
  log('retry', { f1: f1.status, f2: (await state(page)).status, reqs: reqs.length });
  await ctx.close();
}
// ---- sent state: reload, back (bfcache and not), send another, duplicate
{
  const { ctx, page, reqs } = await setup(b, 'ok');
  await fill(page, { ...base, name: 'Jo', message: 'hi' });
  await page.click('button[type=submit]'); await page.waitForTimeout(800);
  const after = await state(page);
  await page.reload(); await page.waitForTimeout(400);
  const reload = await state(page);
  await page.goto(BASE + 'about'); await page.goBack(); await page.waitForTimeout(500);
  const back = await state(page);
  const navType = await page.evaluate(() => performance.getEntriesByType('navigation')[0].type);
  await page.goForward(); await page.goBack(); await page.waitForTimeout(400);
  const back2 = await state(page);
  // home via about's logo (fresh navigation, same tab)
  await page.goto(BASE + 'about'); await page.click('a.pf-mark, header a[href="/"]').catch(() => {}); await page.waitForTimeout(500);
  const viaLogo = await state(page);
  await page.click('[data-pf-again]'); await page.waitForTimeout(100);
  const again1 = await state(page);
  await page.click('button[type=submit]'); await page.waitForTimeout(300);
  const emptyAfterAgain = await state(page);
  await fill(page, { email: 'me@shop.com', store: 'second.com' }); await page.click('button[type=submit]'); await page.waitForTimeout(800);
  const second = await state(page);
  log('sentFlow', { reqs: reqs.length, after: [after.formState, after.status, after.active, after.againVisible], reload: [reload.formState, reload.status, reload.againVisible], back: [back.formState, back.status], navType, back2: back2.formState, viaLogo: [viaLogo.formState, viaLogo.status], again1: [again1.active, again1.values, again1.formState, again1.ss], emptyAfterAgain: [emptyAfterAgain.active, emptyAfterAgain.status], second: [second.status, second.ss] });
  await ctx.close();
}
// bfcache: does the page come back persisted? state after back with pending request
{
  const { ctx, page } = await setup(b, 'ok');
  await fill(page, base); await page.click('button[type=submit]'); await page.waitForTimeout(800);
  await page.evaluate(() => { window.__mark = 1; addEventListener('pageshow', e => { window.__persisted = e.persisted; }); });
  await page.goto(BASE + 'legal'); await page.goBack(); await page.waitForTimeout(500);
  const r = await page.evaluate(() => ({ mark: window.__mark, persisted: window.__persisted }));
  log('bfcache', { ...r, s: (await state(page)).formState });
  await ctx.close();
}
// navigate away mid-send, then back
{
  const { ctx, page, reqs } = await setup(b, 'slow');
  await fill(page, base); await page.click('button[type=submit]'); await page.waitForTimeout(200);
  await page.goto(BASE + 'about'); await page.waitForTimeout(3000); await page.goBack(); await page.waitForTimeout(600);
  const s = await state(page);
  log('awayMidSend', { reqs: reqs.length, formState: s.formState, kind: s.kind, status: s.status, btn: s.btn, aria: s.btnAria, values: s.values, ss: s.ss });
  await ctx.close();
}
// simulated bfcache restore while "Sending…" was showing (pageshow persisted)
{
  const { ctx, page } = await setup(b, 'slow');
  await fill(page, base); await page.click('button[type=submit]'); await page.waitForTimeout(200);
  await page.evaluate(() => { const e = new PageTransitionEvent('pageshow', { persisted: true }); dispatchEvent(e); });
  const mid = await state(page);
  await page.waitForTimeout(3000);
  log('pageshowWhileSending', { mid: [mid.formState, mid.btn], end: [(await state(page)).formState, (await state(page)).status] });
  await ctx.close();
}
// duplicate then send another; again focus when email empty (reload)
{
  const { ctx, page } = await setup(b, 'dup');
  await fill(page, base); await page.click('button[type=submit]'); await page.waitForTimeout(800);
  const d = await state(page);
  await page.reload(); await page.waitForTimeout(300);
  const r = await state(page);
  await page.click('[data-pf-again]');
  log('dup', { d: [d.status, d.links.length, d.againVisible, d.ss], reload: [r.formState, r.status], againActive: (await state(page)).active });
  await ctx.close();
}
// sessionStorage blocked
{
  const ctx = await b.newContext(); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('SecurityError'); } }); });
  await ctx.route('**/script.google.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: ACAO, body: '{"ok":true}' }));
  await page.goto(BASE); await fill(page, base); await page.click('button[type=submit]'); await page.waitForTimeout(800);
  const s = await state(page);
  await page.click('[data-pf-again]');
  log('ssBlocked', { s: [s.formState, s.status], errs, again: (await state(page)).active });
  await ctx.close();
}
// sessionStorage full / setItem throws (quota)
{
  const ctx = await b.newContext(); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException('QuotaExceededError', 'QuotaExceededError'); }; });
  await ctx.route('**/script.google.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: ACAO, body: '{"ok":true}' }));
  await page.goto(BASE); await fill(page, base); await page.click('button[type=submit]'); await page.waitForTimeout(800);
  log('ssQuota', { s: (await state(page)).status, errs });
  await ctx.close();
}
// form state on load: noValidate, honeypot enabled, hidden inputs disabled
{
  const { ctx, page } = await setup(b, 'ok');
  const s = await page.evaluate(() => { const f = document.querySelector('form[data-pf-review]'); return { nv: f.noValidate, attr: f.hasAttribute('novalidate'), hp: f.elements.pf_hp_field.disabled, hidden: ['price', 'newPrice', 'cost'].map(n => f.elements[n].disabled), hpTab: f.elements.pf_hp_field.tabIndex }; });
  // tab order through the form
  await page.focus('#rv-email');
  const order = [];
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => document.activeElement.id || document.activeElement.textContent.trim().slice(0, 30))); }
  log('initState', { ...s, order });
  await ctx.close();
}
// script blocked but JS on: what happens on submit?
{
  const ctx = await b.newContext(); const page = await ctx.newPage();
  await ctx.route('**/pf-review.js', r => r.abort());
  await page.goto(BASE);
  await page.click('button[type=submit]');
  const v = await page.evaluate(() => ({ valid: document.querySelector('#rv-email').validity.valid, msg: document.querySelector('#rv-email').validationMessage, url: location.href }));
  log('scriptBlocked', v);
  await ctx.close();
}

await b.close();
fs.writeFileSync(`qa/M1/bughunt-tmp3/forms-${which}.json`, JSON.stringify(out, null, 1));
