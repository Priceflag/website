import { chromium, webkit } from 'playwright';
const BASE = 'http://localhost:8932/';
const out = {};
const log = (k, v) => { out[k] = v; console.log('\n##', k, JSON.stringify(v)); };
const engine = process.argv[2] === 'webkit' ? webkit : chromium;

async function setup(browser, mode, opts = {}, url = BASE) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const reqs = [];
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push('console:' + m.text()); });
  page.on('pageerror', e => errs.push('pageerror:' + e.message));
  await ctx.route('**/script.google.com/**', async route => {
    const r = route.request();
    reqs.push({ method: r.method(), body: r.postData() });
    const m = typeof mode === 'function' ? mode(reqs.length) : mode;
    if (m === 'ok') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    if (m === 'dup') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"duplicate":true}' });
    if (m === 'abort') return route.abort('failed');
    if (m === '500') return route.fulfill({ status: 500, body: 'err' });
    if (m === 'slow') { await new Promise(r => setTimeout(r, 2500)); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }).catch(() => {}); }
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
    return {
      formState: f.getAttribute('data-state'), kind: s.getAttribute('data-kind'), status: s.textContent,
      links: [...s.querySelectorAll('a')].map(a => a.href),
      live: live && live.textContent,
      active: document.activeElement && (document.activeElement.id || document.activeElement.tagName + '.' + document.activeElement.className),
      values: { email: f.elements.email.value, store: f.elements.store.value, name: f.elements.name.value, message: f.elements.message.value.length },
      btn: f.querySelector('button[type=submit]').textContent, btnDisabled: f.querySelector('button[type=submit]').disabled,
      fieldsVisible: getComputedStyle(f.querySelector('.pf-form-fields')).display !== 'none',
      againVisible: again && !again.hidden && getComputedStyle(again).display !== 'none',
      ss: (() => { try { return sessionStorage.getItem('pf-review-sent'); } catch (e) { return 'ERR'; } })(),
    };
  });
}
async function fill(page, d) { for (const [k, v] of Object.entries(d)) await page.fill(`[name="${k}"]`, v); }
const base = { email: 'me@shop.com', store: 'shop.com' };
const parse = b => { try { return JSON.parse(b); } catch (e) { return b; } };

const b = await engine.launch();

if (!process.env.SKIP1) {
// --- emoji / surrogate pairs in each field
const emojiCases = {
  msgEmoji: { ...base, message: 'Raise the hoodie 😀 price please' },
  msgEmojiLong: { ...base, message: ('Price idea 💡 ').repeat(60) },
  nameEmojiAt60: { ...base, name: 'a'.repeat(59) + '😀 rest' },
  storeEmojiAt120: { ...base, store: 'shop.com/' + 'a'.repeat(110) + '😀x' },
  msgCJK: { ...base, message: '価格を変更したい '.repeat(80) },
};
for (const [k, d] of Object.entries(emojiCases)) {
  for (const mode of ['ok', 'abort']) {
    const { ctx, page, reqs, errs } = await setup(b, mode);
    await fill(page, d);
    await page.click('button[type=submit]');
    await page.waitForTimeout(1200);
    const s = await state(page);
    const p = reqs[0] ? parse(reqs[0].body) : null;
    log(`${k}/${mode}`, { reqs: reqs.length, page: p && p.page && p.page.length, ua: p && p.ua && p.ua.slice(0, 40), s, errs, mailtoLens: s.links.map(l => l.length) });
    await ctx.close();
  }
}

// --- pack(): what reaches page/ua for a long message; hp flag survival
{
  const { ctx, page, reqs } = await setup(b, 'ok');
  await fill(page, { ...base, name: 'Jo', message: 'x'.repeat(1500) });
  await page.evaluate(() => { document.querySelector('[name=pf_hp_field]').value = 'autofilled'; });
  await page.click('button[type=submit]');
  await page.waitForTimeout(800);
  const p = parse(reqs[0].body);
  log('hpLongMsg', { pageLen: p.page.length, pageTail: p.page.slice(-30), hp: p.hp, hpInPage: p.page.includes('hp=1'), uaLen: p.ua.length, s: await state(page) });
  await ctx.close();
}
{
  // store with chars that triple when encoded, max-length name
  const { ctx, page, reqs } = await setup(b, 'ok');
  await fill(page, { email: 'me@shop.com', store: 'https://shop.myshopify.com/products/x?' + 'a=%20&b=ü&'.repeat(10), name: 'Zoë Ångström-Ñúñez '.repeat(3).slice(0, 60), message: 'short note' });
  await page.click('button[type=submit]');
  await page.waitForTimeout(800);
  const p = parse(reqs[0].body);
  let dec = null; try { dec = decodeURIComponent(p.page); } catch (e) { dec = 'DECODE ERROR ' + e.message; }
  log('packOverflow', { pageLen: p.page.length, page: p.page, hasHost: p.page.includes('host='), hasMsg: p.page.includes('msg=') || p.ua.includes('short note'), ua: p.ua.slice(0, 60), decode: dec.slice(0, 80), s: await state(page) });
  await ctx.close();
}
{
  // long name, empty message -> "note was longer" copy?
  const { ctx, page, reqs } = await setup(b, 'ok');
  await fill(page, { ...base, name: 'N'.repeat(100) });
  await page.click('button[type=submit]');
  await page.waitForTimeout(800);
  log('longNameNoNote', await state(page));
  await ctx.close();
}
{
  // percent-escape cut at 300
  const { ctx, page, reqs } = await setup(b, 'ok');
  await fill(page, { ...base, store: 'shop.com/' + 'é'.repeat(110) });
  await page.click('button[type=submit]');
  await page.waitForTimeout(800);
  const p = parse(reqs[0].body);
  let dec; try { dec = decodeURIComponent(p.page).slice(-40); } catch (e) { dec = 'DECODE ERROR ' + e.message; }
  log('escapeCut', { len: p.page.length, tail: p.page.slice(-12), dec, s: (await state(page)).status });
  await ctx.close();
}

// --- mailto cap variants
for (const [k, msg] of Object.entries({ ascii: 'word '.repeat(400), nonascii: 'é'.repeat(2000), emoji: '😀'.repeat(900), newlines: 'a\n'.repeat(1000) })) {
  const { ctx, page, errs } = await setup(b, 'abort');
  await fill(page, { ...base, message: msg });
  await page.click('button[type=submit]');
  await page.waitForTimeout(1000);
  const s = await state(page);
  let body = null;
  if (s.links[0]) { try { body = decodeURIComponent(s.links[0].split('&body=')[1]); } catch (e) { body = 'DECODE ' + e.message; } }
  log('mailto/' + k, { lens: s.links.map(l => l.length), tail: body && body.slice(-60), hasEmail: body && body.includes('Email: me@shop.com'), btn: s.btn, btnDisabled: s.btnDisabled, status: s.status.slice(0, 80), errs });
  await ctx.close();
}

}
// --- sent state, back/forward, reload, send another
{
  const { ctx, page, reqs } = await setup(b, 'ok');
  await fill(page, { ...base, name: 'Jo', message: 'hi' });
  await page.click('button[type=submit]');
  await page.waitForTimeout(800);
  const after = await state(page);
  await page.reload(); await page.waitForTimeout(300);
  const reload = await state(page);
  await page.goto(BASE + 'about'); await page.goBack(); await page.waitForTimeout(400);
  const back = await state(page);
  const bf = await page.evaluate(() => performance.getEntriesByType('navigation')[0].type);
  console.log('PRE', JSON.stringify({ after, reload, back, bf }));
  if (!back.againVisible) { await page.reload(); await page.waitForTimeout(300); console.log('RELOAD2', JSON.stringify(await state(page))); }
  // send another
  await page.click('[data-pf-again]');
  const again1 = await state(page);
  await page.click('button[type=submit]'); await page.waitForTimeout(300);
  const emptyAfterAgain = await state(page);
  console.log('AGAIN', JSON.stringify({again1, emptyAfterAgain}));
  await fill(page, { email: 'me@shop.com', store: 'second.com' }); await page.click('button[type=submit]'); await page.waitForTimeout(800);
  const second = await state(page);
  // send another, then reload without sending
  await page.click('[data-pf-again]'); await page.reload(); await page.waitForTimeout(300);
  const reloadAfterAgain = await state(page);
  // new tab in same context (no sessionStorage share)
  const p2 = await ctx.newPage(); await p2.goto(BASE); const newTab = await state(p2);
  log('sentFlow', { after, reload, back, navType: bf, again1, emptyAfterAgain, second, reloadAfterAgain, newTab, reqs: reqs.length });
  await ctx.close();
}
// bfcache path (chromium honours bfcache in headless only with a flag; check persisted)
{
  const { ctx, page } = await setup(b, 'ok');
  await fill(page, base); await page.click('button[type=submit]'); await page.waitForTimeout(800);
  await page.evaluate(() => { window.__mark = 1; addEventListener('pageshow', e => { window.__persisted = e.persisted; }); });
  await page.goto(BASE + 'legal'); await page.goBack(); await page.waitForTimeout(400);
  const r = await page.evaluate(() => ({ mark: window.__mark, persisted: window.__persisted }));
  log('bfcache', { ...r, s: await state(page) });
  await ctx.close();
}
// sessionStorage blocked
{
  const ctx = await b.newContext(); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('SecurityError'); } }); });
  await ctx.route('**/script.google.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.goto(BASE); await fill(page, base); await page.click('button[type=submit]'); await page.waitForTimeout(800);
  log('ssBlocked', { s: await state(page), errs });
  await ctx.close();
}
// duplicate then send another
{
  const { ctx, page } = await setup(b, 'dup');
  await fill(page, base); await page.click('button[type=submit]'); await page.waitForTimeout(800);
  log('dup', await state(page));
  await ctx.close();
}
// in-flight: navigate away / back during sending; double submit during slow
{
  const { ctx, page, reqs } = await setup(b, 'slow');
  await fill(page, base);
  await page.click('button[type=submit]');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  const mid = await state(page);
  await page.waitForTimeout(3000);
  log('slow', { mid, end: await state(page), reqs: reqs.length });
  await ctx.close();
}
// offline then online
{
  const { ctx, page, reqs } = await setup(b, 'ok');
  await fill(page, base); await ctx.setOffline(true);
  await page.click('button[type=submit]'); await page.waitForTimeout(300);
  const off = await state(page);
  await ctx.setOffline(false);
  await page.click('button[type=submit]'); await page.waitForTimeout(800);
  log('offline', { off, on: await state(page), reqs: reqs.length });
  await ctx.close();
}
// live region / focus sequence
{
  const { ctx, page } = await setup(b, 'slow');
  await fill(page, base);
  await page.focus('button[type=submit]'); await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const mid = await state(page);
  await page.waitForTimeout(2800);
  const end = await state(page);
  const statusRole = await page.evaluate(() => { const s = document.querySelector('[data-pf-status]'); return { role: s.getAttribute('role'), live: s.getAttribute('aria-live'), outline: getComputedStyle(s).outlineStyle + ' ' + getComputedStyle(s).outlineColor }; });
  log('liveFocus', { mid: { live: mid.live, active: mid.active }, end: { live: end.live, active: end.active, status: end.status }, statusRole });
  await page.screenshot({ path: 'qa/M1/bughunt-tmp2/shots/' + (process.argv[2] || 'chromium') + '-sent.png', clip: await page.locator('#review').boundingBox() });
  await ctx.close();
}

await b.close();
import('node:fs').then(fs => fs.writeFileSync(`qa/M1/bughunt-tmp2/forms-${process.argv[2] || 'chromium'}.json`, JSON.stringify(out, null, 1)));
