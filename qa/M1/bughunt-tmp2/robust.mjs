import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
const BASE = 'http://localhost:8932/';
const out = {};
const log = (k, v) => { out[k] = v; console.log('\n##', k, JSON.stringify(v)); };
const SH = 'qa/M1/bughunt-tmp2/shots/';
const b = await chromium.launch();
const pages = ['', 'about', 'contact', 'legal'];
const mock = ctx => ctx.route('**/script.google.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));

// 1. JS disabled: form behaviour
{
  const ctx = await b.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
  await mock(ctx);
  const page = await ctx.newPage();
  const reqs = []; page.on('request', r => reqs.push(r.method() + ' ' + r.url().slice(0, 120)));
  const navs = []; page.on('framenavigated', f => { if (f === page.mainFrame()) navs.push(f.url()); });
  await page.goto(BASE);
  const info = await page.evaluate(() => { const f = document.querySelector('form[data-pf-review]'); return { action: f.action, method: f.method, enctype: f.enctype, noValidate: f.noValidate, noscriptShown: !!document.querySelector('noscript') }; });
  reqs.length = 0; navs.length = 0;
  // empty submit
  await page.click('button[type=submit]').catch(e => reqs.push('clickerr ' + e.message.slice(0, 80)));
  await page.waitForTimeout(800);
  const emptyRes = { url: page.url(), navs: [...navs], reqs: [...reqs] };
  await page.fill('[name=email]', 'me@shop.com'); await page.fill('[name=store]', 'shop.com'); await page.fill('[name=message]', 'secret plan');
  reqs.length = 0; navs.length = 0;
  await page.click('button[type=submit]').catch(e => reqs.push('clickerr ' + e.message.slice(0, 80)));
  await page.waitForTimeout(800);
  const filledRes = { url: page.url(), navs: [...navs], reqs: [...reqs], stillHasValues: await page.inputValue('[name=email]') };
  const noscriptText = await page.evaluate(() => [...document.querySelectorAll('noscript')].map(n => n.textContent.trim()).join(' | '));
  log('nojs-form', { info, emptyRes, filledRes, noscriptText });
  for (const p of pages) {
    await page.goto(BASE + p);
    const r = await page.evaluate(() => ({ h1: document.querySelector('h1') && document.querySelector('h1').textContent.trim(), op: getComputedStyle(document.querySelector('.pf-sheet') || document.body).opacity, ctas: [...document.querySelectorAll('a.pf-btn, a.pf-cta, button.pf-btn')].filter(e => e.getBoundingClientRect().height > 0).map(e => e.textContent.trim().slice(0, 30)) }));
    out['nojs-' + (p || 'index')] = r;
  }
  log('nojs-pages', pages.map(p => out['nojs-' + (p || 'index')]));
  await ctx.close();
}

// 2. Script blocked (JS on): what does the form do?
{
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 } });
  await mock(ctx);
  await ctx.route('**/sections/pf-review.js', r => r.abort());
  const page = await ctx.newPage();
  const navs = []; page.on('framenavigated', f => { if (f === page.mainFrame()) navs.push(f.url()); });
  await page.goto(BASE);
  await page.fill('[name=email]', 'me@shop.com'); await page.fill('[name=store]', 'shop.com');
  navs.length = 0;
  await page.click('button[type=submit]').catch(() => {});
  await page.waitForTimeout(800);
  log('scriptBlocked', { url: page.url(), navs, noscriptVisible: await page.evaluate(() => [...document.querySelectorAll('.pf-form-note')].some(n => n.closest('noscript'))) });
  await ctx.close();
}

// 3. Slow 3G (CDP) CLS / LCP / late content
const conds = { offline: false, latency: 400, downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8 };
for (const p of pages) {
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, deviceScaleFactor: 2 });
  await mock(ctx);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', conds);
  await page.addInitScript(() => {
    window.__cls = 0; window.__shifts = []; window.__lcp = 0;
    new PerformanceObserver(l => { for (const e of l.getEntries()) { if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), src: (e.sources || []).map(s => s.node ? (s.node.className || s.node.nodeName) : '?').slice(0, 3) }); } } }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(l => { const e = l.getEntries().pop(); window.__lcp = Math.round(e.startTime); window.__lcpEl = e.element ? e.element.tagName + '.' + e.element.className : '?'; }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  const t0 = Date.now();
  await page.goto(BASE + p, { waitUntil: 'commit' });
  const snaps = [];
  for (const t of [1500, 3000, 6000]) {
    await page.waitForTimeout(t - (Date.now() - t0) > 0 ? t - (Date.now() - t0) : 0);
    await page.screenshot({ path: `${SH}slow3g-${p || 'index'}-${t}.png` });
    snaps.push(t);
  }
  await page.waitForLoadState('load', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  // scroll to bottom to load lazy images and see if anything shifts
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => ({ cls: +window.__cls.toFixed(4), shifts: window.__shifts, lcp: window.__lcp, lcpEl: window.__lcpEl, fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight) }));
  log('slow3g-' + (p || 'index'), { ...r, loadMs: Date.now() - t0 });
  await ctx.close();
}

// 4. Late web-font swap: hold the font files 4 s so Hedvig swaps in after first paint
for (const p of pages) {
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 } });
  await mock(ctx);
  await ctx.route('**/fonts.gstatic.com/**', async r => { await new Promise(x => setTimeout(x, 4000)); return r.continue(); });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__cls = 0; window.__shifts = []; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), src: (e.sources || []).map(s => s.node ? (s.node.className || s.node.nodeName) : '?').slice(0, 3) }); } }).observe({ type: 'layout-shift', buffered: true }); });
  await page.goto(BASE + p);
  const sel = p ? '.pf-sheet-title' : '#hero-title';
  const h1 = await page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { h: r.height, w: r.width, ff: getComputedStyle(document.querySelector(s)).fontFamily.slice(0, 40) }; }, sel);
  const before = await page.evaluate(() => { const e = document.querySelector('.pf-sub, .pf-lede'); return e ? e.getBoundingClientRect().top : null; });
  await page.waitForTimeout(6000);
  const h2 = await page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { h: r.height, w: r.width }; }, sel);
  const after = await page.evaluate(() => { const e = document.querySelector('.pf-sub, .pf-lede'); return e ? e.getBoundingClientRect().top : null; });
  const fonts = await page.evaluate(() => [...document.fonts].map(f => f.family + ':' + f.status).join(', '));
  log('fontswap-' + (p || 'index'), { titleBefore: h1, titleAfter: h2, nextTopBefore: before, nextTopAfter: after, cls: await page.evaluate(() => +window.__cls.toFixed(4)), shifts: await page.evaluate(() => window.__shifts), fonts });
  await ctx.close();
}

// 5. Link crawl: every href on every page, internal fetch status, in-page anchors exist
{
  const ctx = await b.newContext(); await mock(ctx); const page = await ctx.newPage();
  const res = {};
  for (const p of [...pages, 'signin.html']) {
    await page.goto(BASE + p);
    const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => ({ href: a.getAttribute('href'), abs: a.href, text: (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 30) })));
    const items = [];
    for (const l of links) {
      let st = '';
      if (l.href.startsWith('#')) st = (await page.evaluate(id => !!document.getElementById(id), l.href.slice(1))) ? 'anchor-ok' : 'ANCHOR-MISSING';
      else if (l.abs.startsWith(BASE)) { const r = await page.request.get(l.abs.split('#')[0]); st = r.status(); const h = l.abs.split('#')[1]; if (h) { const html = await r.text(); st += html.includes(`id="${h}"`) ? ' +anchor' : ' ANCHOR-MISSING'; } }
      else st = 'external/' + l.abs.split(':')[0];
      items.push(`${l.href} [${l.text}] -> ${st}`);
    }
    res[p || 'index'] = items;
  }
  log('links', res);
  await ctx.close();
}

fs.writeFileSync('qa/M1/bughunt-tmp2/robust.json', JSON.stringify(out, null, 1));
await b.close();
