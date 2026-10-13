// Round-3 verifier: review form, script.google.com always mocked (never real network).
import { chromium, webkit } from 'playwright';
import { startServer } from '../../serve.mjs';
const srv = await startServer();
const EP = /script\.google\.com/;
const results = []; let fails = 0;
const check = (name, cond, info) => { results.push({ name, pass: !!cond, info }); if (!cond) fails++; console.log(cond ? 'PASS' : 'FAIL', name, info === undefined ? '' : JSON.stringify(info).slice(0, 400)); };

function mock(rows, o = {}) {
  return async (route) => {
    const raw = route.request().postData(); let d = {};
    try { d = JSON.parse(raw); } catch (e) {}
    rows.push({ d, raw, ct: route.request().headers()['content-type'], page: String(d.page || '').slice(0, 300), ua: String(d.ua || '').slice(0, 300) });
    if (o.delay) await new Promise(r => setTimeout(r, o.delay));
    if (o.abort) return route.abort(o.abort);
    if (o.status) return route.fulfill({ status: o.status, body: 'oops' });
    if (o.html) return route.fulfill({ status: 200, contentType: 'text/html', body: '<html>sign in</html>' });
    if (o.nullBody) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: 'null' });
    const pfx = String(d.page || '').startsWith('https://priceflag.org');
    let body = pfx ? { ok: true } : { ok: false, error: 'bad page' };
    if (o.dup) body = { ok: true, duplicate: true };
    if (o.rate) body = { ok: false, error: 'rate limited' };
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  };
}
function recon(row) {
  const m = row.page.match(/&msg=(.*)$/); let msg = '';
  if (m) { try { msg = decodeURIComponent(m[1]); } catch (e) { return '<<decode error>>'; } }
  if (row.ua.startsWith('note: ')) msg += row.ua.slice(6);
  return msg;
}
async function open(bt, o = {}) {
  const b = await bt.launch(); const ctx = await b.newContext({ javaScriptEnabled: o.js !== false }); const pg = await ctx.newPage();
  const rows = []; const errors = [];
  pg.on('pageerror', e => errors.push(String(e))); pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await pg.route('**/*', (r) => { const u = r.request().url();
    if (u.startsWith(srv.url)) { if (o.blockScript && u.includes('pf-review.js')) return r.abort(); return r.continue(); }
    if (EP.test(u)) return mock(rows, o.mock || {})(r);
    if (/fonts\.(googleapis|gstatic)/.test(u)) return r.continue();
    return r.abort(); });
  await pg.goto(srv.url + (o.path || '/'));
  return { b, ctx, pg, rows, errors };
}
async function fill(pg, v) { for (const [k, val] of Object.entries(v)) await pg.locator(`[name="${k}"]`).fill(val); }
const st = (pg) => pg.locator('[data-pf-status]').innerText();
const submit = (pg) => pg.click('form[data-pf-review] button[type=submit]');
async function settle(pg, ms = 3000) { try { await pg.waitForFunction(() => !document.querySelector('form[data-pf-review] button[type=submit]').hasAttribute('aria-disabled') && document.querySelector('[data-pf-status]').textContent.trim().length > 0, null, { timeout: ms }); return true; } catch (e) { return false; } }
async function mailto(pg) { return pg.evaluate(() => { const a = document.querySelector('[data-pf-status] a[href^="mailto:"]'); return a ? a.getAttribute('href') : null; }); }
function mailOk(h) { if (!h) return { ok: false, why: 'none' }; let body = ''; try { body = decodeURIComponent(h.split('&body=')[1] || ''); decodeURIComponent(h.split('subject=')[1].split('&')[0]); } catch (e) { return { ok: false, why: 'decode', len: h.length }; } return { ok: h.length <= 1800 && h.startsWith('mailto:hello@priceflag.org') && /^Email: /.test(body), len: h.length, bodyHead: body.slice(0, 60), hasEmail: /^Email: /.test(body) }; }
function pageOk(row) { let dec = true; try { decodeURIComponent(row.d.page); } catch (e) { dec = false; } return { prefix: String(row.d.page).startsWith('https://priceflag.org/'), len: [...String(row.d.page)].length, u16: String(row.d.page).length, uaLen: String(row.d.ua).length, dec }; }
const okPage = (p) => p.prefix && p.u16 <= 300 && p.uaLen <= 300 && p.dec;

const E = 'qa-verify3@example.com';
for (const [bn, bt] of [['chromium', chromium], ['webkit', webkit]]) {
  // CTAs
  { const { b, pg } = await open(bt);
    for (const sel of ['.pf-hero a[href="#review"]', '.pf-foot a[href="#review"]']) {
      await pg.goto(srv.url + '/'); await pg.click(sel); await pg.waitForTimeout(700);
      const r = await pg.evaluate(() => ({ hash: location.hash, inView: (() => { const r = document.querySelector('#rv-email').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })() }));
      check(`${bn} CTA ${sel} -> #review, form in view`, r.hash === '#review' && r.inView, r);
    }
    await b.close(); }
  // success short note
  { const { b, pg, rows, errors } = await open(bt); const note = 'Blue tee $24 → $27 & "quotes" é ✓ <b>x</b>';
    await fill(pg, { email: E, store: 'shop.example.com', name: 'QA', message: note }); await submit(pg); await settle(pg);
    const p = pageOk(rows[0]);
    check(`${bn} success: 1 req, text/plain, page ok, note recoverable`, rows.length === 1 && /text\/plain/.test(rows[0].ct) && okPage(p) && recon(rows[0]) === note, { p, ct: rows[0]?.ct, rec: recon(rows[0]) });
    const s = await st(pg); const foc = await pg.evaluate(() => document.activeElement?.hasAttribute('data-pf-status'));
    check(`${bn} success copy/focus/again`, /Thanks\. We have your request/.test(s) && s.includes(E) && foc && await pg.isVisible('[data-pf-again]') && !/longer/.test(s), { s, foc });
    await pg.reload(); await pg.waitForTimeout(400);
    check(`${bn} reload after success shows sent state`, (await pg.getAttribute('form', 'data-state')) === 'sent' && /already have your request/.test(await st(pg)), await st(pg));
    await pg.click('[data-pf-again]');
    const a = await pg.evaluate(() => ({ id: document.activeElement?.id, email: document.querySelector('#rv-email').value, state: document.querySelector('form').getAttribute('data-state') }));
    check(`${bn} send another after reload focuses empty email`, a.id === (a.email ? 'rv-store' : 'rv-email') && a.state === null, a);
    check(`${bn} success no console errors`, errors.length === 0, errors);
    await b.close(); }
  // emoji / astral in every field and at every cut point
  const emojiCases = {
    noteEmoji: { email: E, store: 'shop.com', name: 'Zoë 😀', message: 'Raise the hoodie 😀 price please 👍🏽 🇺🇸' },
    noteEmojiLong: { email: E, store: 'shop.com', message: '😀'.repeat(3000) },
    nameEmojiCut: { email: E, store: 'shop.com', name: 'a'.repeat(45) + '😀'.repeat(30), message: 'hi' },
    storeEmojiCut: { email: E, store: 'shop.com/' + 'b'.repeat(95) + '😀'.repeat(60), message: 'x' },
    zwjMix: { email: E, store: 'магазин.рф', name: '👨‍👩‍👧‍👦'.repeat(10), message: ('𝔘𝔫𝔦𝔠𝔬𝔡𝔢 ' + '中文'.repeat(5)).repeat(80) },
    loneSurrogate: { email: E, store: 'shop.com', message: 'bad \uD83D here \uDE00 end' },
  };
  for (const [k, v] of Object.entries(emojiCases)) {
    const { b, pg, rows, errors } = await open(bt); await fill(pg, v); await submit(pg); const done = await settle(pg);
    const p = rows[0] ? pageOk(rows[0]) : null; const s = await st(pg);
    check(`${bn} emoji ${k}: sent, page ok, no hang`, done && rows.length === 1 && p && okPage(p) && /Thanks/.test(s) && errors.length === 0, { p, s: s.slice(0, 160), errors });
    // recoverable prefix of note: reconstruct must be a prefix of the note
    if (rows[0]) { const rec = recon(rows[0]); const full = v.message; check(`${bn} emoji ${k}: stored note is a clean prefix (and cut flagged if partial)`, full.replace(/[\uD800-\uDFFF]/g, (c) => c).startsWith(rec) || k === 'loneSurrogate', { recLen: rec.length, fullLen: full.length, cutMsg: /longer/.test(s) }); 
      if (rec.length < (v.message || '').length && k !== 'loneSurrogate') check(`${bn} emoji ${k}: cut note -> notice + mailto`, /note was longer/.test(s) && mailOk(await mailto(pg)).ok, mailOk(await mailto(pg))); }
    await b.close();
  }
  // emoji under failure -> mailto
  { const { b, pg } = await open(bt, { mock: { status: 500 } }); await fill(pg, { email: E, store: 'shop.com/' + '😀'.repeat(40), name: '😀'.repeat(60), message: '😀 '.repeat(2000) }); await submit(pg); const done = await settle(pg);
    const m = mailOk(await mailto(pg)); check(`${bn} emoji+500 -> error + mailto ≤1800 decodable with Email`, done && m.ok && /couldn’t confirm/.test(await st(pg)), m); await b.close(); }
  // long input
  { const { b, pg, rows } = await open(bt); await fill(pg, { email: E, store: 'https://shop.myshopify.com/products/x?utm=' + 'q%20é&'.repeat(40), name: 'Zoë Ångström-Ñúñez'.repeat(7).slice(0, 120), message: 'Long note. '.repeat(500).slice(0, 5000) });
    await submit(pg); await settle(pg); const p = rows[0] && pageOk(rows[0]); const s = await st(pg);
    check(`${bn} long inputs: page ≤300, prefix, decodable; notice shown`, p && okPage(p) && /longer/.test(s) && mailOk(await mailto(pg)).ok, { p, s: s.slice(0, 200), m: mailOk(await mailto(pg)) }); await b.close(); }
  // honeypot + long note
  { const { b, pg, rows } = await open(bt); await fill(pg, { email: E, store: 'shop.com', message: 'z'.repeat(1000) }); await pg.evaluate(() => { document.querySelector('#rv-hp').value = 'bot'; }); await submit(pg); await settle(pg);
    const r = rows[0]; check(`${bn} honeypot + 1000-char note: hp=1 survives server slice`, r && /[?&]hp=1&/.test(r.page) && r.d.hp === 1, { page: r?.page.slice(0, 80) }); await b.close(); }
  // failure modes
  const fm = { s500: [{ status: 500 }, /couldn’t confirm/], html: [{ html: 1 }, /couldn’t confirm/], abort: [{ abort: 'failed' }, /couldn’t confirm/], reset: [{ abort: 'connectionreset' }, /couldn’t confirm/], nullb: [{ nullBody: 1 }, /couldn’t confirm/], rejected: [{ rate: 1 }, /turned the request down/] };
  for (const [k, [mo, re]] of Object.entries(fm)) {
    const { b, pg, rows } = await open(bt, { mock: mo }); const v = { email: E, store: 'shop.com', name: 'N', message: 'keep me' }; await fill(pg, v); await submit(pg); const done = await settle(pg);
    const kept = await pg.evaluate(() => ['rv-email', 'rv-store', 'rv-name', 'rv-message'].map(i => document.getElementById(i).value));
    const m = mailOk(await mailto(pg)); const foc = await pg.evaluate(() => document.activeElement?.hasAttribute('data-pf-status'));
    check(`${bn} fail ${k}: copy, input kept, mailto, focus, button back`, done && re.test(await st(pg)) && kept.join('|') === 'qa-verify3@example.com|shop.com|N|keep me' && m.ok && foc && (await pg.getAttribute('form', 'data-state')) !== 'sent', { s: (await st(pg)).slice(0, 120), m, foc }); await b.close(); }
  // offline
  { const { b, ctx, pg, rows } = await open(bt); await fill(pg, { email: E, store: 'shop.com' }); await ctx.setOffline(true); await submit(pg); await settle(pg);
    check(`${bn} offline: nothing sent, says so, mailto`, rows.length === 0 && /offline/.test(await st(pg)) && mailOk(await mailto(pg)).ok, await st(pg));
    await ctx.setOffline(false); await submit(pg); await settle(pg); check(`${bn} back online retry succeeds`, rows.length === 1 && /Thanks/.test(await st(pg)), rows.length); await b.close(); }
  // double submit + focus while sending
  { const { b, pg, rows } = await open(bt, { mock: { delay: 1500 } }); await fill(pg, { email: E, store: 'shop.com' }); await pg.focus('form button[type=submit]'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(100); await pg.keyboard.press('Enter'); await submit(pg).catch(() => {});
    const mid = await pg.evaluate(() => ({ tag: document.activeElement?.tagName, label: document.querySelector('form button[type=submit]').textContent, live: document.querySelector('[data-pf-live]').textContent }));
    await settle(pg, 5000); check(`${bn} double-submit -> 1 request; focus stays on button; live 'Sending'`, rows.length === 1 && mid.tag === 'BUTTON' && /Sending/.test(mid.label) && /Sending/.test(mid.live), { n: rows.length, mid }); await b.close(); }
  // duplicate
  { const { b, pg } = await open(bt, { mock: { dup: 1 } }); await fill(pg, { email: E, store: 'shop.com' }); await submit(pg); await settle(pg);
    check(`${bn} duplicate copy + mailto`, /already had a request/.test(await st(pg)) && mailOk(await mailto(pg)).ok, await st(pg)); await b.close(); }
  // validation
  for (const [k, v, bad] of [['empty', { email: '', store: '' }, 'email'], ['dbldot', { email: 'a@b..com', store: 'shop.com' }, 'email'], ['zwsp', { email: 'me@shop.com​', store: 'shop.com​' }, null], ['js', { email: E, store: 'javascript:alert(1)' }, 'store'], ['puny', { email: E, store: 'shop.xn--p1ai' }, null], ['tooLongStore', { email: E, store: 'shop.com/' + 'a'.repeat(400) }, 'store'], ['spaces', { email: '  me@shop.com  ', store: ' shop.com ' }, null]]) {
    const { b, pg, rows } = await open(bt); await fill(pg, v); await submit(pg); await pg.waitForTimeout(600);
    const inv = await pg.evaluate(() => ['rv-email', 'rv-store'].filter(i => document.getElementById(i).getAttribute('aria-invalid') === 'true'));
    if (bad) check(`${bn} validate ${k} rejected`, rows.length === 0 && inv[0] === 'rv-' + bad && (await pg.evaluate(() => document.activeElement.id)) === 'rv-' + bad, inv);
    else check(`${bn} validate ${k} accepted and cleaned`, rows.length === 1 && rows[0].d.email === 'me@shop.com'.replace('me@shop.com', rows[0].d.email.includes('qa-verify3') ? E : 'me@shop.com') && !/​/.test(rows[0].raw), { n: rows.length, e: rows[0]?.d.email, s: rows[0]?.d.store });
    await b.close(); }
  // mailto with absurd CJK email (edge)
  { const { b, pg } = await open(bt, { mock: { status: 500 } }); await fill(pg, { email: '中'.repeat(200) + '@例え.jp', store: 'shop.com', message: 'x' }); await submit(pg); await settle(pg);
    const h = await mailto(pg); check(`${bn} (edge) 200-char CJK email: mailto still carries Email line`, mailOk(h).hasEmail, mailOk(h)); await b.close(); }
  // index.html path variant
  { const { b, pg, rows } = await open(bt, { path: '/index.html' }); await fill(pg, { email: E, store: 'shop.com', message: 'n' }); await submit(pg); await settle(pg);
    check(`${bn} /index.html path: page prefix ok`, rows[0] && okPage(pageOk(rows[0])), rows[0]?.d.page); await b.close(); }
  // no-JS and blocked script
  for (const mode of ['nojs', 'blocked']) {
    const { b, pg, rows } = await open(bt, mode === 'nojs' ? { js: false } : { blockScript: true });
    const info = await pg.evaluate(() => { const f = document.querySelector('form[data-pf-review]'); return { action: f.getAttribute('action'), method: f.method, enctype: f.enctype, novalidate: f.noValidate, emptyValid: f.checkValidity(), disabledExtras: [...f.querySelectorAll('input[type=hidden],#rv-hp')].every(i => i.disabled) }; });
    const reqs = []; pg.on('request', r => reqs.push(r.url()));
    await submit(pg); await pg.waitForTimeout(500); const urlAfter = pg.url();
    const noscript = mode === 'nojs' ? await pg.locator('noscript p, .pf-form noscript').count() : null;
    check(`${bn} ${mode}: mailto POST text/plain, native validation blocks empty, extras disabled, no endpoint call, URL unchanged`, info.action.startsWith('mailto:hello@priceflag.org') && info.method === 'post' && info.enctype === 'text/plain' && !info.novalidate && !info.emptyValid && info.disabledExtras && rows.length === 0 && !reqs.some(u => EP.test(u)) && !/[?&]email=/.test(urlAfter), { info, urlAfter, noscript });
    await b.close(); }
}
import fs from 'fs';
fs.writeFileSync(new URL('./form.json', import.meta.url), JSON.stringify(results, null, 1));
console.log(`\nTOTAL ${results.length} checks, ${fails} FAIL`);
await srv.close(); process.exit(0);
