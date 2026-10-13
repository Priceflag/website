import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
const BASE = 'http://localhost:8933/';
const which = process.argv[2] || 'chromium';
const engine = which === 'webkit' ? webkit : chromium;
const out = {};
const log = (k, v) => { out[k] = v; console.log('##', k, JSON.stringify(v).slice(0, 1200)); };
const PAGES = ['', 'about', 'contact', 'legal', 'signin'];
const b = await engine.launch();

const probe = () => {
  const vw = innerWidth;
  const res = { sw: document.documentElement.scrollWidth, vw };
  const nav = document.querySelector('.pf-nav');
  if (nav) res.navH = Math.round(nav.getBoundingClientRect().height);
  // words broken across lines
  const broken = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = tw.nextNode())) {
    const el = n.parentElement; if (!el || el.closest('script,style,noscript,svg,.pf-visually-hidden,.pf-hp')) continue;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const re = /\S+/g; let m;
    while ((m = re.exec(n.data))) {
      const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
      const rects = [...r.getClientRects()].filter(x => x.width > 0);
      if (rects.length > 1 && new Set(rects.map(x => Math.round(x.top))).size > 1 && !/[-–—/]/.test(m[0])) broken.push(m[0].slice(0, 30) + '@' + el.tagName + '.' + el.className.toString().slice(0, 20));
    }
  }
  res.broken = broken.slice(0, 15); res.brokenN = broken.length;
  // elements sticking out of the viewport horizontally
  const over = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect(); if (!r.width) continue;
    if (el.closest('.pf-hp,.pf-visually-hidden,.pf-skip,svg')) continue;
    if (r.right > vw + 1 || r.left < -1) {
      // ignore if an ancestor clips it
      let p = el.parentElement, clipped = false;
      while (p && p !== document.body) { const s = getComputedStyle(p); if (s.overflowX !== 'visible') { const pr = p.getBoundingClientRect(); if (pr.right <= vw + 1 && pr.left >= -1) { clipped = 'clipped-by:' + p.tagName + '.' + p.className.toString().slice(0, 18); } break; } p = p.parentElement; }
      over.push(el.tagName + '.' + el.className.toString().slice(0, 22) + ' ' + Math.round(r.left) + '..' + Math.round(r.right) + (clipped ? ' ' + clipped : ''));
    }
  }
  res.over = over.slice(0, 12); res.overN = over.length;
  // focusable elements that are invisible (clipped or off-viewport horizontally)
  const hidden = [];
  for (const el of document.querySelectorAll('a[href],button,input,textarea,summary,[tabindex]')) {
    if (el.tabIndex < 0 || el.closest('.pf-hp,[hidden]')) continue;
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || !r.width) continue;
    if (el.classList.contains('pf-skip')) continue;
    if (r.right > vw + 1 || r.left < -1) hidden.push((el.textContent || el.id).trim().slice(0, 20) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
  }
  res.focusOff = hidden;
  // buttons overflowing their own box text
  res.btnOver = [...document.querySelectorAll('.pf-btn')].filter(e => e.offsetParent && e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim().slice(0, 25) + ' ' + e.scrollWidth + '>' + e.clientWidth);
  return res;
};

const double = () => {
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = []; let n; while ((n = tw.nextNode())) if (n.data.trim() && !n.parentElement.closest('script,style,svg')) nodes.push(n);
  for (const n of nodes) n.data = n.data + ' ' + n.data.trim();
};

async function go(page, p) { await page.goto(BASE + p, { waitUntil: 'load' }); await page.evaluate(() => document.fonts && document.fonts.ready); await page.waitForTimeout(150); }

// 1. real copy across widths
for (const p of PAGES) {
  const ctx = await b.newContext(); const page = await ctx.newPage();
  for (const w of [320, 340, 360, 375, 390, 414, 440, 480, 500, 540, 600, 640, 700, 740, 768, 900, 1024, 1280, 1440, 1920, 2560]) {
    await page.setViewportSize({ width: w, height: 800 }); await go(page, p);
    const r = await page.evaluate(probe);
    if (r.sw > w || r.brokenN || r.overN || r.focusOff.length || r.btnOver.length || (r.navH && r.navH > 57)) log(`real/${p || 'index'}/${w}`, r);
  }
  await ctx.close();
}
// 2. doubled text
for (const p of PAGES) {
  const ctx = await b.newContext(); const page = await ctx.newPage();
  for (const w of [320, 360, 375, 414, 480, 500, 520, 540, 560, 600, 640, 700, 740, 768, 820, 900, 960, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width: w, height: 800 }); await go(page, p);
    await page.evaluate(double); await page.waitForTimeout(50);
    const r = await page.evaluate(probe);
    log(`x2/${p || 'index'}/${w}`, { sw: r.sw, navH: r.navH, overN: r.overN, over: r.over.slice(0, 6), focusOff: r.focusOff, btnOver: r.btnOver });
    if (p === '' && [320, 500, 540, 768].includes(w)) await page.screenshot({ path: `qa/M1/bughunt-tmp3/shots/${which}-x2-${w}.png`, fullPage: false });
  }
  await ctx.close();
}
// 3. long word appended per element type (index)
const LW = 'Preisänderungsüberprüfungsanfrageformularfeldbeschriftung';
const sel = { summary: '.pf-faq summary', footHead: '.pf-foot-head', label: '.pf-field label', heroBtn: '.pf-cta .pf-btn', submitBtn: 'button[type=submit]', footBtn: '.pf-foot .pf-btn', navLink: '.pf-nav a[href="#faq"]', signin: '.pf-nav .pf-btn', footLink: '.pf-foot-link', legal: '.pf-foot-legal a', title: '.pf-title-lead', h3: '.pf-steps h3', lede: '.pf-lede', formNote: '.pf-form-note', heroFoot: '.pf-hero-foot', footMark: '.pf-foot-mark' };
{
  const ctx = await b.newContext(); const page = await ctx.newPage();
  for (const w of [320, 375, 600, 768, 1440]) for (const [k, s] of Object.entries(sel)) {
    await page.setViewportSize({ width: w, height: 800 }); await go(page, '');
    const found = await page.evaluate(([s, LW]) => { const e = document.querySelector(s); if (!e) return false; e.append(' ' + LW); return true; }, [s, LW]);
    if (!found) { log(`lw/${k}/${w}`, 'missing'); continue; }
    const r = await page.evaluate(probe);
    if (r.sw > w || r.overN || r.focusOff.length || r.btnOver.length) log(`lw/${k}/${w}`, { sw: r.sw, over: r.over.slice(0, 4), focusOff: r.focusOff, btnOver: r.btnOver });
  }
  // sub-pages: long word in h1 / paragraphs
  for (const p of ['about', 'contact', 'legal', 'signin']) for (const w of [320, 375]) {
    await page.setViewportSize({ width: w, height: 800 }); await go(page, p);
    await page.evaluate(LW => { for (const e of document.querySelectorAll('h1,h2,p,a,li')) { e.append(' ' + LW); } }, LW);
    const r = await page.evaluate(probe);
    log(`lwsub/${p}/${w}`, { sw: r.sw, overN: r.overN, over: r.over.slice(0, 5), focusOff: r.focusOff.slice(0, 5) });
  }
  await ctx.close();
}
// 4. zoom: emulate 200%/400% by CSS px viewport
for (const [w, h, label] of [[187, 406, 'phone200'], [160, 400, 'w160'], [720, 450, 'desk200'], [360, 225, 'desk400'], [640, 360, 'land200']]) for (const p of PAGES) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 }); const page = await ctx.newPage();
  await go(page, p);
  const r = await page.evaluate(probe);
  log(`zoom/${label}/${p || 'index'}`, { sw: r.sw, vw: r.vw, navH: r.navH, overN: r.overN, over: r.over.slice(0, 5), focusOff: r.focusOff, brokenN: r.brokenN, broken: r.broken.slice(0, 5) });
  if (!p) await page.screenshot({ path: `qa/M1/bughunt-tmp3/shots/${which}-zoom-${label}.png` });
  await ctx.close();
}
// 5. dark + reduced motion
for (const p of PAGES) {
  const ctx = await b.newContext({ colorScheme: 'dark', reducedMotion: 'reduce', viewport: { width: 375, height: 812 } }); const page = await ctx.newPage();
  const errs = []; page.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); }); page.on('pageerror', e => errs.push(e.message));
  await go(page, p);
  const r = await page.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, sb: getComputedStyle(document.documentElement).scrollBehavior, cs: getComputedStyle(document.documentElement).colorScheme, anims: document.getAnimations().map(a => a.animationName || a.constructor.name).slice(0, 5), sw: document.documentElement.scrollWidth }));
  log(`darkRM/${p || 'index'}`, { ...r, errs });
  await page.screenshot({ path: `qa/M1/bughunt-tmp3/shots/${which}-dark-${p || 'index'}.png` });
  await ctx.close();
}
// 6. web fonts blocked: nav wrap, title metrics
{
  for (const blocked of [false, true]) {
    const ctx = await b.newContext(); const page = await ctx.newPage();
    if (blocked) await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    for (const w of [320, 375, 380, 400, 740, 768, 1440]) {
      await page.setViewportSize({ width: w, height: 800 }); await go(page, '');
      const r = await page.evaluate(() => ({ navH: Math.round(document.querySelector('.pf-nav').getBoundingClientRect().height), title: [...document.querySelectorAll('.pf-title span')].map(s => Math.round(s.getBoundingClientRect().width) + 'x' + Math.round(s.getBoundingClientRect().height)), fam: getComputedStyle(document.querySelector('.pf-title')).fontFamily.slice(0, 40), sw: document.documentElement.scrollWidth }));
      log(`fonts/${blocked ? 'blocked' : 'loaded'}/${w}`, r);
    }
    await ctx.close();
  }
}
await b.close();
fs.writeFileSync(`qa/M1/bughunt-tmp3/layout-${which}.json`, JSON.stringify(out, null, 1));
