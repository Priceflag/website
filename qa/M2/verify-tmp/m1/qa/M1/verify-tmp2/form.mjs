// Round-2 verifier: review form with script.google.com mocked. Never hits the network.
import { chromium, webkit } from 'playwright';
import { startServer } from '../../serve.mjs';
const srv = await startServer();
const EP = /script\.google\.com/;
const out = [];
const log = (k, v) => { out.push([k, v]); console.log(k, typeof v === 'string' ? v : JSON.stringify(v)); };
// Mock that behaves like the deployed .gs: keeps page/ua sliced to 300, checks prefix.
function serverLike(rows, opts = {}) {
  return (route) => {
    const d = JSON.parse(route.request().postData());
    if (opts.status) return route.fulfill({ status: opts.status, body: 'oops' });
    if (opts.abort) return route.abort();
    const ok = String(d.page || '').startsWith('https://priceflag.org');
    let body = ok ? { ok: true } : { ok: false, error: 'bad page' };
    if (opts.dup) body = { ok: true, duplicate: true };
    if (opts.rate) body = { ok: false, error: 'rate limited' };
    rows.push({ raw: d, page: String(d.page || '').slice(0, 300), ua: String(d.ua || '').slice(0, 300) });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  };
}
function reconstruct(row) {
  const m = row.page.match(/&msg=(.*)$/); let msg = '';
  if (m) { try { msg = decodeURIComponent(m[1].replace(/&hp=1$/, '')); } catch (e) { msg = '<<decode error>>'; } }
  if (row.ua.startsWith('note: ')) msg += row.ua.slice(6);
  return msg;
}
async function open(bt, opts = {}) {
  const b = await bt.launch(); const ctx = await b.newContext({ javaScriptEnabled: opts.js !== false }); const pg = await ctx.newPage();
  const rows = []; const reqs = [];
  await pg.route('**/*', (r) => { const u = r.request().url(); reqs.push(u);
    if (u.startsWith(srv.url)) { if (opts.blockScript && u.includes('pf-review.js')) return r.abort(); return r.continue(); }
    if (EP.test(u)) return serverLike(rows, opts.mock || {})(r);
    if (/fonts\.(googleapis|gstatic)/.test(u)) return r.continue();
    return r.abort(); });
  await pg.goto(srv.url + '/');
  return { b, ctx, pg, rows, reqs };
}
async function fill(pg, v) { for (const [k, val] of Object.entries(v)) await pg.fill(`[name="${k}"]`, val); }
const statusText = (pg) => pg.locator('[data-pf-status]').innerText();

for (const [bn, bt] of [['chromium', chromium], ['webkit', webkit]]) {
  // 1. CTAs
  { const { b, pg } = await open(bt);
    for (const sel of ['.pf-hero .pf-btn[href="#review"]', '.pf-foot .pf-btn[href="#review"]']) {
      await pg.goto(srv.url + '/'); await pg.click(sel); await pg.waitForTimeout(400);
      log(`${bn} cta ${sel}`, { hash: await pg.evaluate(() => location.hash), formInView: await pg.evaluate(() => { const r = document.querySelector('#rv-email').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }) });
    }
    await b.close(); }
  // 2. success, payload prefix, short note intact
  { const { b, pg, rows } = await open(bt); const note = 'Thinking of moving the blue tee from $24 to $27 & testing "quotes" é ✓';
    await fill(pg, { email: 'qa-verify2@example.com', store: 'shop.example.com', name: 'QA', message: note });
    await pg.click('form button[type=submit]'); await pg.waitForTimeout(600);
    const r = rows[0];
    log(`${bn} success`, { n: rows.length, pageStarts: r.page.slice(0, 40), prefixOK: r.page.startsWith('https://priceflag.org/'), noteRecovered: reconstruct(r) === note, status: await statusText(pg), focused: await pg.evaluate(() => document.activeElement?.hasAttribute('data-pf-status')), state: await pg.getAttribute('form', 'data-state'), again: await pg.isVisible('[data-pf-again]') });
    // reload keeps sent state
    await pg.reload(); await pg.waitForTimeout(300);
    log(`${bn} reload after success`, { state: await pg.getAttribute('form', 'data-state'), status: await statusText(pg) });
    await pg.click('[data-pf-again]');
    log(`${bn} send another`, { state: await pg.getAttribute('form', 'data-state'), focus: await pg.evaluate(() => document.activeElement?.id), emailKept: await pg.inputValue('#rv-email') });
    await b.close(); }
  // 3. long note (2000 chars) -> cut flagged with mailto; check what server keeps
  { const { b, pg, rows } = await open(bt); const note = ('Long note word ' + 'x'.repeat(10) + ' ').repeat(80).slice(0, 2000);
    await fill(pg, { email: 'qa-verify2@example.com', store: 'shop.example.com', message: note });
    await pg.click('form button[type=submit]'); await pg.waitForTimeout(600);
    const r = rows[0]; const rec = reconstruct(r);
    const href = await pg.locator('[data-pf-status] a').first().getAttribute('href').catch(() => null);
    log(`${bn} long note`, { kept: rec.length, of: note.length, prefixOK: r.page.startsWith('https://priceflag.org/'), status: await statusText(pg), mailtoLen: href && href.length, mailtoHasEmail: href && decodeURIComponent(href).includes('qa-verify2@example.com') });
    await b.close(); }
  // 4. note that just fits (~400 chars) should be whole and no cut message
  { const { b, pg, rows } = await open(bt); const note = 'a'.repeat(400);
    await fill(pg, { email: 'qa-verify2@example.com', store: 'shop.example.com', message: note });
    await pg.click('form button[type=submit]'); await pg.waitForTimeout(600);
    log(`${bn} 400-char note`, { whole: reconstruct(rows[0]) === note, status: await statusText(pg) });
    await b.close(); }
  // 5. max-length store/name + short message: is msg lost silently?
  { const { b, pg, rows } = await open(bt); const store = 'https://' + 'a'.repeat(280) + '.com'; const note = 'important message';
    await fill(pg, { email: 'qa-verify2@example.com', store, name: 'N'.repeat(120), message: note });
    await pg.click('form button[type=submit]'); await pg.waitForTimeout(600);
    log(`${bn} long store+name`, { sent: rows.length, rec: reconstruct(rows[0] || { page: '', ua: '' }), status: await statusText(pg) });
    await b.close(); }
  // 6. non-ASCII store (IDN) + non-ASCII note
  { const { b, pg, rows } = await open(bt); const note = 'é'.repeat(300);
    await fill(pg, { email: 'qa-verify2@example.com', store: 'café-' + 'é'.repeat(100) + '.com', message: note });
    await pg.click('form button[type=submit]'); await pg.waitForTimeout(600);
    const r = rows[0];
    log(`${bn} IDN store`, { sent: rows.length, pageLen: r && r.page.length, rec: r && reconstruct(r).length, status: await statusText(pg) });
    await b.close(); }
  // 7. failures: 500, abort, ok:false rate limit, duplicate
  for (const [name, mock] of [['500', { status: 500 }], ['abort', { abort: true }], ['rate', { rate: true }], ['dup', { dup: true }]]) {
    const { b, pg } = await open(bt, { mock });
    await fill(pg, { email: 'qa-verify2@example.com', store: 'shop.example.com', message: 'hello' });
    await pg.click('form button[type=submit]'); await pg.waitForTimeout(700);
    const href = await pg.locator('[data-pf-status] a').first().getAttribute('href').catch(() => null);
    log(`${bn} fail-${name}`, { status: await statusText(pg), mailto: href && href.slice(0, 60), inputKept: await pg.inputValue('#rv-message'), btnEnabled: await pg.isEnabled('form button[type=submit]'), focusedStatus: await pg.evaluate(() => document.activeElement?.hasAttribute('data-pf-status')) });
    await b.close();
  }
  // 8. honeypot with full page
  { const { b, pg, rows } = await open(bt);
    await fill(pg, { email: 'qa-verify2@example.com', store: 'shop.example.com', message: 'z'.repeat(1000) });
    await pg.evaluate(() => { document.querySelector('[name=pf_hp_field]').value = 'http://bot'; });
    await pg.click('form button[type=submit]'); await pg.waitForTimeout(600);
    log(`${bn} honeypot+full page`, { sent: rows.length, rawHp: rows[0]?.raw.hp, hpInStoredPage: rows[0]?.page.includes('&hp=1'), hpInStoredUa: rows[0]?.ua.includes('hp') });
    await b.close(); }
  // 9. invalid inputs
  { const { b, pg, rows } = await open(bt);
    for (const [e, s] of [['', ''], ['a@b..com', 'shop.com'], ['a@b.co', 'shop'], ['a@b.co', 'javascript:alert(1)']]) {
      await fill(pg, { email: e, store: s }); await pg.click('form button[type=submit]'); await pg.waitForTimeout(150);
      log(`${bn} invalid ${e}|${s}`, { sent: rows.length, emailInvalid: await pg.getAttribute('#rv-email', 'aria-invalid'), storeInvalid: await pg.getAttribute('#rv-store', 'aria-invalid'), status: await statusText(pg) });
    }
    await b.close(); }
  // 10. no JS and script blocked: what does submit do?
  for (const mode of ['nojs', 'blocked']) {
    const { b, pg, rows, reqs } = await open(bt, mode === 'nojs' ? { js: false } : { blockScript: true });
    await fill(pg, { email: 'qa-verify2@example.com', store: 'shop.example.com', message: 'secret' });
    const before = pg.url();
    await pg.click('form button[type=submit]').catch(e => log('click err', e.message)); await pg.waitForTimeout(800);
    log(`${bn} ${mode} submit`, { urlBefore: before, urlAfter: pg.url(), leakedInUrl: /secret|qa-verify2/.test(pg.url()), anyReqWithData: reqs.filter(u => /secret|qa-verify2/.test(u)).length, endpointCalls: rows.length, noscriptVisible: mode === 'nojs' ? await pg.isVisible('noscript p').catch(() => 'n/a') : 'n/a' });
    await b.close();
  }
}
await srv.close();
import fs from 'fs'; fs.writeFileSync(new URL('./form.json', import.meta.url), JSON.stringify(out, null, 1));
