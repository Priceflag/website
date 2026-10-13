import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
const BASE = 'http://localhost:8933/';
const which = process.argv[2] || 'chromium';
const engine = which === 'webkit' ? webkit : chromium;
const out = {};
const log = (k, v) => { out[k] = v; console.log('##', k, JSON.stringify(v).slice(0, 1500)); };
const PAGES = ['', 'about', 'contact', 'legal', 'signin'];
const ACAO = { 'access-control-allow-origin': '*' };
const b = await engine.launch();
const mock = ctx => ctx.route('**/script.google.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: ACAO, body: '{"ok":true}' }));

// 1. JS disabled
{
  const ctx = await b.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } }); await mock(ctx);
  const page = await ctx.newPage(); await page.goto(BASE);
  const navs = []; page.on('framenavigated', f => { if (f === page.mainFrame()) navs.push(f.url()); });
  const info = await page.evaluate(() => {
    const f = document.querySelector('form[data-pf-review]');
    const fd = n => [...new FormData(f).keys()];
    const r = { novalidate: f.noValidate, action: f.action, method: f.method, enctype: f.enctype, emptyValid: f.checkValidity(), fieldsSubmitted: fd() };
    f.elements.email.value = 'not-an-email'; f.elements.store.value = 'x'; r.badEmailValid = f.checkValidity(); r.emailMsg = f.elements.email.validationMessage;
    f.elements.email.value = 'me@shop.com'; r.storeAnything = f.checkValidity();
    r.noscript = [...document.querySelectorAll('noscript')].map(n => n.textContent.trim().slice(0, 140));
    r.ctas = [...document.querySelectorAll('a.pf-btn, button.pf-btn')].filter(e => e.getBoundingClientRect().height > 0).map(e => e.textContent.trim().slice(0, 30));
    r.h1op = getComputedStyle(document.querySelector('h1')).opacity;
    return r;
  });
  await page.click('button[type=submit]').catch(e => navs.push('clickerr'));
  await page.waitForTimeout(500);
  info.afterBadSubmit = { url: page.url(), navs: [...navs] };
  log('nojs/index', info);
  for (const p of PAGES.slice(1)) {
    await page.goto(BASE + p);
    log('nojs/' + p, await page.evaluate(() => ({ h1: document.querySelector('h1') && document.querySelector('h1').textContent.trim().slice(0, 40), op: getComputedStyle(document.querySelector('main') || document.body).opacity, vis: getComputedStyle(document.querySelector('main') || document.body).visibility, sw: document.documentElement.scrollWidth })));
  }
  await ctx.close();
}
// 2. ZWNJ / ZWJ preservation (Persian, Hindi, emoji)
{
  const ctx = await b.newContext(); await mock(ctx);
  const reqs = []; ctx.on('request', r => { if (/script\.google/.test(r.url())) reqs.push(r.postData()); });
  const page = await ctx.newPage(); await page.goto(BASE);
  const name = 'علی‌رضا', msg = 'می‌خواهم قیمت را تغییر دهم. क्‍ष 👨‍👩‍👧';
  await page.fill('#rv-email', 'me@shop.com'); await page.fill('#rv-store', 'shop.com'); await page.fill('#rv-name', name); await page.fill('#rv-message', msg);
  await page.click('button[type=submit]'); await page.waitForTimeout(800);
  const p = JSON.parse(reqs[0]);
  log('zwnj', { sentName: JSON.stringify(p.name), expected: JSON.stringify(name), nameKept: p.name === name, msgKept: p.message === msg, sentMsg: JSON.stringify(p.message) });
  await ctx.close();
}
// 3. mailto href with quotes/brackets in store (no spaces)
{
  const ctx = await b.newContext();
  await ctx.route('**/script.google.com/**', r => r.abort('failed'));
  const page = await ctx.newPage(); await page.goto(BASE);
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => { errs.push('DIALOG ' + d.message()); d.dismiss(); });
  await page.fill('#rv-email', 'me@shop.com'); await page.fill('#rv-store', 'shop.com/"><img/src=x/onerror=alert(1)>'); await page.fill('#rv-message', '"><svg/onload=alert(2)>');
  await page.click('button[type=submit]'); await page.waitForTimeout(800);
  const s = await page.evaluate(() => ({ html: document.querySelector('[data-pf-status]').innerHTML.slice(0, 300), imgs: document.querySelectorAll('[data-pf-status] img, [data-pf-status] svg').length }));
  log('injection', { ...s, errs });
  await ctx.close();
}
// 4. slow 3G + CLS + late content (chromium only, CDP)
if (which === 'chromium') {
  for (const p of PAGES) {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true }); await mock(ctx);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.addInitScript(() => {
      window.__cls = 0; window.__shifts = [];
      new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), src: (e.sources || []).map(s => s.node ? (s.node.nodeName + '.' + (s.node.className || '')).slice(0, 30) : '?') }); } }).observe({ type: 'layout-shift', buffered: true });
      window.__lcp = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    const t0 = Date.now();
    await page.goto(BASE + p, { waitUntil: 'load', timeout: 120000 });
    const loadMs = Date.now() - t0;
    await page.waitForTimeout(2500);
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } });
    await page.waitForTimeout(2500);
    const r = await page.evaluate(() => ({ cls: +window.__cls.toFixed(4), shifts: window.__shifts.slice(0, 6), lcp: Math.round(window.__lcp), fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).filter((v, i, a) => a.indexOf(v) === i) }));
    log('slow3g/' + (p || 'index'), { loadMs, ...r });
    await ctx.close();
  }
}
// 5. font fallback metrics: Hedvig vs fallback face, and per local() candidate
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage(); await page.goto(BASE);
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate(async () => {
    const t = document.querySelector('.pf-title');
    const measure = fam => { const s = document.createElement('span'); s.textContent = t.textContent.trim().replace(/\s+/g, ' '); s.style.cssText = `font-family:${fam};font-size:88px;line-height:1.04;letter-spacing:-.022em;white-space:nowrap;position:absolute;visibility:hidden`; document.body.append(s); const r = s.getBoundingClientRect(); s.remove(); return Math.round(r.width) + 'x' + Math.round(r.height); };
    const faces = {};
    for (const [n, src] of [['FB-Georgia', "local('Georgia')"], ['FB-Times', "local('Times New Roman')"], ['FB-NotoSerif', "local('Noto Serif')"], ['FB-DejaVu', "local('DejaVu Serif')"]]) {
      const f = new FontFace(n, src, { sizeAdjust: '103%', ascentOverride: '104%', descentOverride: '28%' }); try { await f.load(); document.fonts.add(f); faces[n] = 'ok'; } catch (e) { faces[n] = 'missing'; }
    }
    return { hedvigLoaded: document.fonts.check('88px "Hedvig Letters Serif"'), hedvig: measure("'Hedvig Letters Serif'"), fallbackFace: measure("'Hedvig Fallback'"), georgiaRaw: measure('Georgia'), faces, georgiaAdj: measure("'FB-Georgia'"), timesAdj: measure("'FB-Times'") };
  });
  log('fontMetrics', r);
  await ctx.close();
}
// 6. nav focus ring: clipped? screenshot each nav link focused at 375
{
  const ctx = await b.newContext({ viewport: { width: 375, height: 300 } }); const page = await ctx.newPage(); await page.goto(BASE);
  const res = [];
  for (const sel of ['.pf-nav-logo', '.pf-nav a[href="#how-it-works"]', '.pf-nav a[href="#faq"]', '.pf-nav a[href="/contact"]', '.pf-nav .pf-btn']) {
    await page.focus(sel); await page.keyboard.press('Shift+Tab'); await page.keyboard.press(which === 'webkit' ? 'Alt+Tab' : 'Tab');
    const r = await page.evaluate(sel => { const a = document.querySelector(sel); const cs = getComputedStyle(a); let p = a.parentElement, clip = []; while (p) { const s = getComputedStyle(p); if (s.overflow !== 'visible') clip.push(p.className || p.tagName); p = p.parentElement; } return { fv: a.matches(':focus-visible'), focused: document.activeElement === a, outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineOffset, clippers: clip }; }, sel);
    res.push([sel, r]);
  }
  await page.focus('.pf-nav a[href="#how-it-works"]');
  await page.screenshot({ path: `qa/M1/bughunt-tmp3/shots/${which}-navfocus.png`, clip: { x: 0, y: 0, width: 375, height: 70 } });
  log('navRing', res);
  await ctx.close();
}
await b.close();
fs.writeFileSync(`qa/M1/bughunt-tmp3/robust-${which}.json`, JSON.stringify(out, null, 1));
