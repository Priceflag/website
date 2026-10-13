import { chromium, webkit, firefox } from 'playwright';
import fs from 'node:fs';
const BASE = 'http://localhost:8931';
const SHOTS = new URL('./shots/', import.meta.url).pathname; fs.mkdirSync(SHOTS, { recursive: true });
const PAGES = ['/', '/about', '/contact', '/legal', '/signin.html'];
const out = {}; const log = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v).slice(0, 1500)); };
const name = p => (p === '/' ? 'index' : p.replace(/\W/g, ''));

// overflow detector: elements whose box extends past viewport, or whose content overflows its own box
const overflowFn = () => {
  const vw = document.documentElement.clientWidth; const res = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.closest('svg') && el.tagName !== 'svg') continue;
    if (el.closest('.pf-hp,.pf-skip,.skip,.pf-bg,.pf-hero-media,.pf-foot-art,.pf-grain,.pf-hero-wash')) continue;
    const r = el.getBoundingClientRect(); if (!r.width) continue;
    if (r.right > vw + 1 || r.left < -1) res.push({ el: el.tagName + '.' + (el.className.baseVal ?? el.className), right: Math.round(r.right), left: Math.round(r.left), text: (el.textContent || '').trim().slice(0, 40) });
    else if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX === 'visible' && el.children.length === 0 && el.clientWidth) res.push({ el: el.tagName + '.' + el.className, self: 'content>box', sw: el.scrollWidth, cw: el.clientWidth, text: (el.textContent || '').trim().slice(0, 40) });
  }
  return { docSW: document.documentElement.scrollWidth, vw, items: res.slice(0, 15) };
};

const b = await chromium.launch();

if(!process.env.PART2){
// widths
for (const [w, h] of [[320, 640], [375, 812], [1920, 1080], [2560, 1440], [844, 390]]) {
  for (const p of PAGES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage();
    await page.goto(BASE + p); await page.waitForTimeout(1800);
    const o = await page.evaluate(overflowFn);
    let navInfo = null;
    if (p === '/') navInfo = await page.evaluate(() => {
      const items = [...document.querySelectorAll('.pf-nav a')].filter(a => getComputedStyle(a).display !== 'none').map(a => { const r = a.getBoundingClientRect(); return { t: a.textContent.trim() || a.getAttribute('aria-label'), l: Math.round(r.left), r: Math.round(r.right), top: Math.round(r.top), h: Math.round(r.height) }; });
      let overlap = false; for (let i = 1; i < items.length; i++) if (items[i].top === items[i - 1].top && items[i].l < items[i - 1].r) overlap = true;
      const nav = document.querySelector('.pf-nav').getBoundingClientRect();
      const hero = document.querySelector('.pf-hero'); const copy = document.querySelector('.pf-hero-copy');
      const cta = document.querySelector('.pf-cta .pf-btn').getBoundingClientRect();
      return { items, overlap, navH: Math.round(nav.height), heroH: hero.offsetHeight, ctaBottom: Math.round(cta.bottom), vh: innerHeight };
    });
    if (p === '/about' || p === '/contact' || p === '/legal') navInfo = await page.evaluate(() => {
      const s = document.querySelector('.pf-sheet').getBoundingClientRect(); const m = document.querySelector('main');
      const cta = document.querySelector('.pf-cta'); const c = cta && cta.getBoundingClientRect();
      return { sheet: [Math.round(s.top), Math.round(s.bottom), Math.round(s.height)], mainH: m.clientHeight, mainScroll: m.scrollHeight, cta: c ? [Math.round(c.top), Math.round(c.bottom)] : null, vh: innerHeight, cls: document.documentElement.className };
    });
    log(`w${w}x${h}_${name(p)}`, { o, navInfo });
    await page.screenshot({ path: `${SHOTS}${name(p)}-${w}x${h}.png` });
    await ctx.close();
  }
}

// 200% zoom: viewport 640x400 css px at DSF 2 ~ 1280x800 window at 200%; also CSS zoom on 1280
for (const p of PAGES) {
  const ctx = await b.newContext({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 }); const page = await ctx.newPage();
  await page.goto(BASE + p); await page.waitForTimeout(1800);
  const o = await page.evaluate(overflowFn);
  let extra = await page.evaluate(() => { const m = document.querySelector('main'); const nav = document.querySelector('.pf-nav'); return { navH: nav && nav.offsetHeight, mainClient: m.clientHeight, mainScroll: m.scrollHeight, vh: innerHeight }; });
  log('zoom200_' + name(p), { o, extra });
  await page.screenshot({ path: `${SHOTS}${name(p)}-zoom200.png` });
  await ctx.close();
}
// 400% zoom (WCAG reflow: 320x256)
for (const p of PAGES) {
  const ctx = await b.newContext({ viewport: { width: 320, height: 256 } }); const page = await ctx.newPage();
  await page.goto(BASE + p); await page.waitForTimeout(1800);
  const ex = await page.evaluate(() => { const m = document.querySelector('main'); const nav = document.querySelector('.pf-nav'); const hdr = document.querySelector('header,.pf-sheet-top'); return { navH: nav && nav.offsetHeight, hdrH: hdr && hdr.offsetHeight, mainClient: m.clientHeight, mainScroll: m.scrollHeight, vh: innerHeight, docSW: document.documentElement.scrollWidth }; });
  log('reflow320x256_' + name(p), ex);
  await page.screenshot({ path: `${SHOTS}${name(p)}-320x256.png` });
  await ctx.close();
}

// long text injection (2x) on index at 320, 375, 1440
for (const w of [320, 375, 1440]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 800 } }); const page = await ctx.newPage();
  await page.goto(BASE + '/'); await page.waitForTimeout(500);
  await page.evaluate(() => {
    const dbl = el => { for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) n.textContent = n.textContent + ' ' + n.textContent; };
    document.querySelectorAll('h1 span,h2,h3,summary,.pf-btn,.pf-nav a,.pf-foot-link,label,.pf-form-note').forEach(dbl);
    document.querySelector('.pf-statement').textContent += ' Preisänderungsverwaltungsmöglichkeitenübersicht';
    document.querySelector('.pf-steps h3').textContent += ' Rückgängigmachungsgarantieversprechen';
  });
  await page.waitForTimeout(200);
  log('longtext_' + w, await page.evaluate(overflowFn));
  await page.screenshot({ path: `${SHOTS}index-longtext-${w}.png`, fullPage: true });
  await ctx.close();
}
// long text on sub-page
for (const p of ['/about', '/contact']) {
  const ctx = await b.newContext({ viewport: { width: 320, height: 640 } }); const page = await ctx.newPage();
  await page.goto(BASE + p); await page.waitForTimeout(1800);
  await page.evaluate(() => { document.querySelectorAll('h1,h2,h3,.pf-cta,.pf-say').forEach(el => { el.textContent = el.textContent + ' ' + el.textContent + ' Datenschutzgrundverordnung'; }); });
  log('longtext_' + name(p), await page.evaluate(overflowFn));
  await page.screenshot({ path: `${SHOTS}${name(p)}-longtext-320.png` });
  await ctx.close();
}

// reduced motion + dark scheme
for (const opts of [{ reducedMotion: 'reduce' }, { colorScheme: 'dark' }, { forcedColors: 'active' }]) {
  for (const p of PAGES) {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, ...opts }); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(BASE + p); await page.waitForTimeout(300);
    const vis = await page.evaluate(() => { const s = document.querySelector('.pf-sheet,main'); return { op: getComputedStyle(s).opacity, smooth: getComputedStyle(document.documentElement).scrollBehavior, cls: document.documentElement.className }; });
    const k = Object.keys(opts)[0];
    log(`${k}_${name(p)}`, { vis, errs });
    await page.screenshot({ path: `${SHOTS}${name(p)}-${k}.png` });
    await ctx.close();
  }
}

}
// anchors on index: click, check heading not under sticky nav
{
  for (const w of [375, 1440]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 } }); const page = await ctx.newPage();
    await page.goto(BASE + '/');
    const res = [];
    const links = await page.$$eval('a[href^="#"]:not(.pf-skip)', as => as.map((a, i) => ({ i, href: a.getAttribute('href'), t: a.textContent.trim().slice(0, 30), inFoot: !!a.closest('footer') })));
    for (const l of links) {
      await page.goto(BASE + '/'); await page.waitForTimeout(100);
      const loc = page.locator('a[href^="#"]:not(.pf-skip)').nth(l.i);
      await loc.scrollIntoViewIfNeeded(); await loc.click();
      await page.waitForTimeout(1200);
      const r = await page.evaluate(h => {
        const t = document.querySelector(h); if (!t) return { missing: true };
        const head = t.querySelector('h2') || t; const hr = head.getBoundingClientRect(); const nav = document.querySelector('.pf-nav').getBoundingClientRect();
        return { hash: location.hash, headTop: Math.round(hr.top), navBottom: Math.round(nav.bottom), covered: hr.top < nav.bottom, focus: document.activeElement.tagName + '#' + document.activeElement.id };
      }, l.href);
      res.push({ ...l, ...r });
    }
    log('anchors_' + w, res);
    // skip link
    await page.goto(BASE + '/'); await page.keyboard.press('Tab');
    const skipVis = await page.evaluate(() => { const r = document.querySelector('.pf-skip').getBoundingClientRect(); return { top: r.top, h: r.height }; });
    await page.keyboard.press('Enter'); await page.waitForTimeout(500); await page.keyboard.press('Tab');
    const afterSkip = await page.evaluate(() => document.activeElement.outerHTML.slice(0, 80));
    log('skip_' + w, { skipVis, afterSkip });
    await ctx.close();
  }
}

// every link on every page: status
{
  const ctx = await b.newContext(); const page = await ctx.newPage(); const res = {};
  for (const p of PAGES) {
    await page.goto(BASE + p);
    const hrefs = await page.$$eval('a[href]', as => as.map(a => ({ h: a.getAttribute('href'), abs: a.href, t: (a.textContent.trim() || a.getAttribute('aria-label') || '').slice(0, 30), target: a.target })));
    res[p] = [];
    for (const l of hrefs) {
      let st = '';
      if (l.abs.startsWith(BASE)) {
        const u = new URL(l.abs); const r = await fetch(BASE + u.pathname); st = r.status;
        if (u.hash) { const html = await (await fetch(BASE + u.pathname)).text(); if (!html.includes(`id="${u.hash.slice(1)}"`)) st += ' MISSING-ANCHOR'; }
      } else if (l.abs.startsWith('https://priceflag.org')) { const u = new URL(l.abs); const r = await fetch(BASE + u.pathname); st = 'local:' + r.status; if (u.hash) { const html = await (await fetch(BASE + u.pathname)).text(); if (!html.includes(`id="${u.hash.slice(1)}"`)) st += ' MISSING-ANCHOR'; } }
      else st = 'external';
      res[p].push({ ...l, st });
    }
  }
  log('links', res);
  await ctx.close();
}

// subpage keyboard: scroll legal main with keyboard; tab order on sub pages
for (const p of ['/about', '/contact', '/legal']) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage();
  await page.goto(BASE + p); await page.waitForTimeout(1800);
  const order = [];
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => { const a = document.activeElement; return a.tagName + (a.id ? '#' + a.id : '') + '|' + (a.getAttribute('href') || '') + '|' + (a.textContent || '').trim().slice(0, 20); })); }
  // skip link then PageDown
  await page.goto(BASE + p); await page.waitForTimeout(1800);
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  const before = await page.evaluate(() => document.querySelector('main').scrollTop);
  await page.keyboard.press('PageDown'); await page.keyboard.press('Space'); await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ st: document.querySelector('main').scrollTop, active: document.activeElement.tagName + '#' + document.activeElement.id, focusVisible: getComputedStyle(document.activeElement).outlineStyle }));
  log('subkbd_' + name(p), { order, before, after });
  await ctx.close();
}

// legal #terms deep link
{
  const ctx = await b.newContext({ viewport: { width: 375, height: 700 } }); const page = await ctx.newPage();
  await page.goto(BASE + '/legal#terms'); await page.waitForTimeout(2000);
  log('legalTermsDeepLink', await page.evaluate(() => { const t = document.getElementById('terms').getBoundingClientRect(); const m = document.querySelector('main').getBoundingClientRect(); return { termsTop: Math.round(t.top), mainTop: Math.round(m.top), mainBottom: Math.round(m.bottom), visible: t.top >= m.top - 2 && t.top < m.bottom }; }));
  await page.screenshot({ path: `${SHOTS}legal-terms-deeplink.png` });
  await ctx.close();
}

// JS disabled
for (const p of PAGES) {
  const ctx = await b.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } }); const page = await ctx.newPage();
  await page.goto(BASE + p);
  const r = await page.evaluate(() => ({ cls: document.documentElement.className, op: getComputedStyle(document.querySelector('.pf-sheet') || document.body).opacity, noscript: [...document.querySelectorAll('noscript')].length }));
  log('nojs_' + name(p), r);
  await ctx.close();
}
{
  const ctx = await b.newContext({ javaScriptEnabled: false }); const page = await ctx.newPage();
  await page.goto(BASE + '/#review');
  await page.fill('[name=email]', 'me@shop.com'); await page.fill('[name=store]', 'shop.com'); await page.fill('[name=message]', 'secret plan');
  await Promise.all([page.waitForNavigation().catch(() => {}), page.click('button[type=submit]')]);
  log('nojs_submit', { url: page.url(), noscriptVisible: await page.isVisible('noscript p').catch(() => 'n/a') });
  await page.screenshot({ path: `${SHOTS}nojs-after-submit.png` });
  await ctx.close();
}
// JS blocked for pf-review.js only (script fails to load)
{
  const ctx = await b.newContext(); const page = await ctx.newPage();
  await page.route('**/sections/pf-review.js', r => r.abort());
  await page.goto(BASE + '/');
  await page.fill('[name=email]', 'me@shop.com'); await page.fill('[name=store]', 'shop.com');
  await Promise.all([page.waitForNavigation().catch(() => {}), page.click('button[type=submit]')]);
  log('scriptblocked_submit', { url: page.url(), noscriptShown: false });
  await ctx.close();
}

// slow 3G
for (const p of ['/', '/about', '/legal']) {
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 } }); const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8 });
  await page.addInitScript(() => { window.__cls = 0; window.__shifts = []; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), src: (e.sources || []).map(s => s.node && (s.node.nodeName + '.' + (s.node.className || ''))).join(',') }); } }).observe({ type: 'layout-shift', buffered: true });
    window.__lcp = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = { t: Math.round(e.startTime), el: e.element && e.element.tagName + '.' + e.element.className }; }).observe({ type: 'largest-contentful-paint', buffered: true }); });
  const t0 = Date.now();
  await page.goto(BASE + p, { waitUntil: 'load', timeout: 120000 });
  const loadMs = Date.now() - t0;
  const shots = [];
  await page.waitForTimeout(3000);
  const r = await page.evaluate(() => ({ cls: +window.__cls.toFixed(4), shifts: window.__shifts.slice(0, 8), lcp: window.__lcp, fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + f.weight).slice(0, 6) }));
  log('slow3g_' + name(p), { loadMs, ...r });
  await ctx.close();
}
// slow 3G screenshots over time on index
{
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 } }); const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8 });
  page.goto(BASE + '/', { timeout: 120000 }).catch(() => {});
  for (const t of [1500, 3000, 6000, 12000]) { await page.waitForTimeout(t === 1500 ? 1500 : t / 2); await page.screenshot({ path: `${SHOTS}index-slow3g-${t}.png` }).catch(() => {}); }
  await ctx.close();
}

// console errors / failed requests per page in chromium + webkit
for (const [bn, bt] of [['chromium', b], ['webkit', await webkit.launch()]]) {
  for (const p of PAGES) {
    const ctx = await bt.newContext(); const page = await ctx.newPage(); const errs = [];
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ':' + m.text().slice(0, 160)); });
    page.on('pageerror', e => errs.push('pageerror:' + e.message));
    page.on('requestfailed', r => errs.push('reqfailed:' + r.url().slice(0, 100) + ' ' + r.failure()?.errorText));
    page.on('response', r => { if (r.status() >= 400) errs.push('http' + r.status() + ':' + r.url()); });
    await page.goto(BASE + p); await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollTo(0, 1e6)); await page.waitForTimeout(800);
    log(`console_${bn}_${name(p)}`, errs);
    await ctx.close();
  }
}
try { const f = await firefox.launch(); await f.close(); log('firefox', 'launched OK'); } catch (e) { log('firefox', String(e.message).slice(0, 300)); }

await b.close();
fs.writeFileSync(new URL(process.env.PART2?'./layout2.json':'./layout.json', import.meta.url), JSON.stringify(out, null, 2));
process.exit(0);
