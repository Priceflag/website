import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
const BASE = 'http://localhost:8932/';
const out = {};
const log = (k, v) => { out[k] = v; console.log('\n##', k, JSON.stringify(v)); };
const SH = 'qa/M1/bughunt-tmp2/shots/';
const engName = process.argv[2] || 'chromium';
const engine = engName === 'webkit' ? webkit : chromium;
const b = await engine.launch();
const pages = ['', 'about', 'contact', 'legal', 'signin.html'];

async function ctxPage(opts = {}) {
  const ctx = await b.newContext(opts);
  await ctx.route('**/script.google.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror:' + e.message));
  return { ctx, page, errs };
}

// 1. Nav focus ring clipping on index (overflow:hidden on first group)
for (const w of [320, 375, 768, 1440]) {
  const { ctx, page } = await ctxPage({ viewport: { width: w, height: 800 } });
  await page.goto(BASE);
  const res = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const a = document.activeElement; if (!a || a === document.body) return null;
      const cs = getComputedStyle(a);
      const ow = parseFloat(cs.outlineWidth) + parseFloat(cs.outlineOffset);
      const rr = a.getBoundingClientRect();
      // find a clipping ancestor
      let p = a.parentElement, clip = null;
      while (p) { const pc = getComputedStyle(p); if (pc.overflow !== 'visible' || pc.overflowX !== 'visible') { clip = p; break; } p = p.parentElement; }
      let clipped = null;
      if (clip && clip !== document.documentElement && clip !== document.body) {
        const c = clip.getBoundingClientRect();
        clipped = { top: Math.max(0, c.top - (rr.top - ow)), bottom: Math.max(0, (rr.bottom + ow) - c.bottom), left: Math.max(0, c.left - (rr.left - ow)), right: Math.max(0, (rr.right + ow) - c.right), by: clip.className };
      }
      return { text: (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 30), outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor, clipped };
    });
    if (!r) continue;
    res.push(r);
    if (i < 6 && w === 375) await page.screenshot({ path: `${SH}${engName}-navfocus-${w}-${i}.png`, clip: { x: 0, y: 0, width: w, height: 70 } });
  }
  log(`navFocus-${w}`, res);
  await ctx.close();
}

// 2. 2x text + long words, at 320 / 375; also Sign in pill height
for (const w of [320, 375, 1920]) {
  const { ctx, page } = await ctxPage({ viewport: { width: w, height: 800 } });
  await page.goto(BASE);
  const before = await page.evaluate(() => {
    const s = document.querySelector('.pf-nav .pf-btn').getBoundingClientRect();
    return { signinH: s.height, signinW: s.width, sw: document.documentElement.scrollWidth };
  });
  await page.evaluate(() => {
    const dbl = el => { for (const n of el.childNodes) { if (n.nodeType === 3 && n.textContent.trim()) n.textContent = n.textContent + ' ' + n.textContent; else if (n.nodeType === 1 && !['SCRIPT', 'STYLE', 'svg'].includes(n.tagName)) dbl(n); } };
    document.querySelectorAll('.pf-btn, .pf-nav a, h1, h2, h3, summary, label, .pf-form-note, .pf-hero-foot, .pf-foot-link, .pf-foot-bar p').forEach(dbl);
    document.querySelector('.pf-statement').append(' Preisänderungsverwaltungsmöglichkeitenübersichtsseitenzusammenfassung');
    document.querySelector('.pf-steps h3').append(' Preisänderungsverwaltungsmöglichkeitenübersicht');
    document.querySelector('#review-title').append(' Preisänderungsverwaltungsmöglichkeitenübersicht');
    document.querySelector('.pf-foot-head').append(' Preisänderungsverwaltungsmöglichkeitenübersicht');
    document.querySelector('.pf-faq summary').append(' Preisänderungsverwaltungsmöglichkeitenübersicht');
  });
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const over = [];
    document.querySelectorAll('body *').forEach(el => {
      const r = el.getBoundingClientRect(); if (!r.width) return;
      if (el.closest('.pf-hp,.pf-visually-hidden,.pf-skip,.pf-hero-media,.pf-foot-art,svg')) return;
      if (r.right > vw + 1 || el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible' && el.clientWidth > 0) over.push({ el: el.tagName + '.' + (el.className.baseVal ?? el.className), right: Math.round(r.right), sw: el.scrollWidth, cw: el.clientWidth });
    });
    const nav = document.querySelector('.pf-nav-group');
    const navLinks = [...nav.querySelectorAll('a')].map(a => { const r = a.getBoundingClientRect(); const n = nav.getBoundingClientRect(); return { t: a.textContent.trim().slice(0, 20), visibleFrac: r.width ? Math.max(0, Math.min(r.right, n.right) - Math.max(r.left, n.left)) / r.width : 0 }; });
    const s = document.querySelector('.pf-nav .pf-btn').getBoundingClientRect();
    return { sw: document.documentElement.scrollWidth, vw, over: over.slice(0, 12), navLinks, signin: { h: s.height, w: s.width } };
  });
  log(`longtext-${w}`, { before, ...r });
  await page.screenshot({ path: `${SH}${engName}-longtext-${w}.png`, fullPage: w !== 1920 });
  await ctx.close();
}

// 3. 320 / 1920 / 2560 / 200% zoom per page, dark + reduced motion
for (const [name, opts] of Object.entries({
  w320: { viewport: { width: 320, height: 640 } },
  w1920: { viewport: { width: 1920, height: 1080 } },
  w2560: { viewport: { width: 2560, height: 1440 } },
  zoom200: { viewport: { width: 720, height: 450 }, deviceScaleFactor: 2 },
  zoom200m: { viewport: { width: 187, height: 406 }, deviceScaleFactor: 4 },
  dark: { viewport: { width: 375, height: 812 }, colorScheme: 'dark', reducedMotion: 'reduce' },
})) {
  const r = {};
  for (const p of pages) {
    const { ctx, page, errs } = await ctxPage(opts);
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    r[p || 'index'] = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, smooth: getComputedStyle(document.documentElement).scrollBehavior, bodyBg: getComputedStyle(document.body).backgroundColor }));
    r[p || 'index'].errs = errs;
    if (['zoom200m', 'w320'].includes(name)) await page.screenshot({ path: `${SH}${engName}-${name}-${p || 'index'}.png` });
    await ctx.close();
  }
  log('sizes-' + name, r);
}

// 4. Sub-page skip link + main tabindex focus
for (const p of ['about', 'contact', 'legal']) {
  const { ctx, page } = await ctxPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(BASE + p);
  const order = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    order.push(await page.evaluate(() => { const a = document.activeElement; return a.tagName + (a.id ? '#' + a.id : '') + ':' + (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 18); }));
  }
  // skip link path
  await page.goto(BASE + p);
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  const skip = await page.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { active: a.tagName + '#' + a.id, focusVisible: a.matches(':focus-visible'), outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor + ' off ' + cs.outlineOffset }; });
  await page.screenshot({ path: `${SH}${engName}-${p}-mainfocus.png` });
  await page.keyboard.press('PageDown'); await page.waitForTimeout(300);
  const st = await page.evaluate(() => document.querySelector('main').scrollTop);
  // clipping of the main outline by the masked sheet
  const clip = await page.evaluate(() => { const m = document.querySelector('main').getBoundingClientRect(); const s = document.querySelector('.pf-sheet').getBoundingClientRect(); return { mainL: m.left, sheetL: s.left, mainR: m.right, sheetR: s.right, mainB: m.bottom, sheetB: s.bottom }; });
  // mouse click into main: does focus land on main (no ring) and does the next Tab go to the first link inside main?
  await page.goto(BASE + p);
  await page.mouse.click(640, 400);
  const afterClick = await page.evaluate(() => { const a = document.activeElement; return a.tagName + ' fv=' + a.matches(':focus-visible'); });
  await page.keyboard.press('Tab');
  const tabAfterClick = await page.evaluate(() => { const a = document.activeElement; return a.tagName + ':' + (a.textContent || '').trim().slice(0, 20); });
  log('subfocus-' + p, { order, skip, pageDownScroll: st, clip, afterClick, tabAfterClick });
  await ctx.close();
}

fs.writeFileSync(`qa/M1/bughunt-tmp2/layout-${engName}.json`, JSON.stringify(out, null, 1));
await b.close();
