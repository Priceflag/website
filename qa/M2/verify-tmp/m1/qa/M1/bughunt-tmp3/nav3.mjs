import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
const BASE = 'http://localhost:8933/';
const which = process.argv[2] || 'chromium';
const engine = which === 'webkit' ? webkit : chromium;
const out = {};
const log = (k, v) => { out[k] = v; console.log('##', k, JSON.stringify(v).slice(0, 1500)); };
const PAGES = ['', 'about', 'contact', 'legal', 'signin'];
const b = await engine.launch();

// 1. every link on every page: status / target exists
{
  const ctx = await b.newContext(); const page = await ctx.newPage();
  for (const p of PAGES) {
    await page.goto(BASE + p);
    const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => ({ href: a.getAttribute('href'), abs: a.href, text: (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 30), target: a.target, rel: a.rel })));
    const res = [];
    for (const l of links) {
      let st = '';
      if (l.href.startsWith('#')) st = await page.evaluate(id => !!document.getElementById(decodeURIComponent(id)), l.href.slice(1)) ? 'anchor-ok' : 'ANCHOR-MISSING';
      else if (l.abs.startsWith(BASE)) { const u = new URL(l.abs); const r = await page.request.get(u.origin + u.pathname); st = r.status(); if (u.hash) { const html = await r.text(); st += html.includes('id="' + u.hash.slice(1) + '"') ? ' #ok' : ' #MISSING'; } }
      else if (l.abs.startsWith('mailto:')) st = 'mailto';
      else st = 'ext' + (l.target === '_blank' && !/noopener/.test(l.rel) ? ' NO-NOOPENER' : '');
      res.push(`${l.text} -> ${l.href} [${st}]`);
    }
    log('links/' + (p || 'index'), res);
  }
  await ctx.close();
}
// 2. in-page anchors: after click, is the target visible below the sticky nav? (various widths, zoom, 2x text)
for (const [w, h, dbl] of [[375, 812, false], [1440, 900, false], [187, 406, false], [320, 640, true], [768, 1024, false]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' }); const page = await ctx.newPage();
  await page.goto(BASE);
  if (dbl) await page.evaluate(() => { for (const a of document.querySelectorAll('.pf-nav a')) a.textContent = a.textContent + ' ' + a.textContent; });
  const r = {};
  for (const sel of ['.pf-nav a[href="#how-it-works"]', '.pf-nav a[href="#faq"]', '.pf-cta a[href="#review"]', '.pf-cta a[href="#how-it-works"]', '.pf-foot a[href="#review"]', '.pf-foot a[href="#faq"]']) {
    await page.evaluate(() => scrollTo(0, 0));
    const el = await page.$(sel); if (!el || !(await el.isVisible())) { r[sel] = 'hidden'; continue; }
    await el.click(); await page.waitForTimeout(400);
    r[sel] = await page.evaluate(() => { const id = location.hash.slice(1); const t = document.getElementById(id); const navB = document.querySelector('.pf-nav').getBoundingClientRect().bottom; const h = t.querySelector('h2') || t; const hr = h.getBoundingClientRect(); return { hash: id, navBottom: Math.round(navB), headTop: Math.round(hr.top), obscured: hr.top < navB - 2, active: document.activeElement.tagName + (document.activeElement.id ? '#' + document.activeElement.id : '') }; });
  }
  // Tab after activating #review: where does focus go?
  await page.evaluate(() => scrollTo(0, 0));
  await page.focus('.pf-cta a[href="#review"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(300); await page.keyboard.press('Tab');
  r.tabAfterReview = await page.evaluate(() => document.activeElement.id || document.activeElement.textContent.trim().slice(0, 30));
  log(`anchors/${w}x${h}${dbl ? '/x2' : ''}`, r);
  await ctx.close();
}
// 3. focus order + visible focus + obscured by sticky nav, every page, 375 & 1440 & 187
for (const [w, h] of [[375, 812], [1440, 900], [187, 406]]) for (const p of PAGES) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage();
  await page.goto(BASE + p); await page.waitForTimeout(200);
  const seq = []; const issues = [];
  for (let i = 0; i < 45; i++) {
    await page.keyboard.press(which === 'webkit' ? 'Alt+Tab' : 'Tab');
    const info = await page.evaluate(() => {
      const a = document.activeElement; if (!a || a === document.body) return null;
      const r = a.getBoundingClientRect(); const cs = getComputedStyle(a);
      const nav = document.querySelector('.pf-nav, header'); const navR = nav && getComputedStyle(nav).position.match(/sticky|fixed/) ? nav.getBoundingClientRect() : null;
      const ring = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 || cs.boxShadow !== 'none';
      return { id: (a.id || a.getAttribute('aria-label') || a.textContent.trim()).slice(0, 24), tag: a.tagName, fv: a.matches(':focus-visible'), ring, outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor + ' off' + cs.outlineOffset, top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, underNav: navR && !a.closest('.pf-nav,header') ? r.top < navR.bottom - 1 : false, navBottom: navR ? Math.round(navR.bottom) : null, inView: r.bottom > 0 && r.top < innerHeight };
    });
    if (!info) { seq.push('BODY'); continue; }
    seq.push(info.id);
    if (!info.ring || !info.fv) issues.push(['noring', info.id, info.outline, info.fv]);
    if (info.underNav) issues.push(['under-sticky-nav', info.id, info.top, info.navBottom]);
    if (!info.inView) issues.push(['offscreen', info.id, info.top]);
    if (seq.length > 3 && seq[seq.length - 1] === seq[0] && i > 3) break;
  }
  log(`focus/${w}/${p || 'index'}`, { seq, issues });
  await ctx.close();
}
// 4. skip links
for (const p of PAGES) {
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 } }); const page = await ctx.newPage();
  await page.goto(BASE + p);
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => ({ t: document.activeElement.textContent.trim().slice(0, 20), vis: (() => { const r = document.activeElement.getBoundingClientRect(); return r.top >= 0 && r.left >= 0 && r.right <= innerWidth; })() }));
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  const afterEnter = await page.evaluate(() => ({ active: document.activeElement.tagName + '#' + document.activeElement.id, fv: document.activeElement.matches(':focus-visible'), hash: location.hash }));
  await page.keyboard.press(which === 'webkit' ? 'Alt+Tab' : 'Tab');
  const next = await page.evaluate(() => document.activeElement.textContent.trim().slice(0, 30) || document.activeElement.id);
  if (p && p !== 'signin') await page.screenshot({ path: `qa/M1/bughunt-tmp3/shots/${which}-mainfocus-${p}.png` });
  log('skip/' + (p || 'index'), { first, afterEnter, next });
  // main:focus-visible ring screenshot
  if (p && p !== 'signin') {
    await page.goto(BASE + p); await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
    const ring = await page.evaluate(() => { const m = document.querySelector('main'); const cs = getComputedStyle(m); const r = m.getBoundingClientRect(); return { fv: m.matches(':focus-visible'), outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor + ' ' + cs.outlineOffset, rect: [r.left, r.top, r.right, r.bottom].map(Math.round), bg: getComputedStyle(m.closest('.pf-sheet') || m.parentElement).backgroundColor }; });
    await page.screenshot({ path: `qa/M1/bughunt-tmp3/shots/${which}-mainring-${p}.png` });
    // mouse click on main -> ring?
    await page.mouse.click(200, 400);
    const click = await page.evaluate(() => document.activeElement.tagName + ' fv=' + document.activeElement.matches(':focus-visible'));
    log('mainring/' + p, { ...ring, click });
  }
  await ctx.close();
}
// 5. FAQ details keyboard
{
  const ctx = await b.newContext(); const page = await ctx.newPage(); await page.goto(BASE);
  await page.focus('.pf-faq summary'); await page.keyboard.press('Enter'); const o1 = await page.evaluate(() => document.querySelector('.pf-faq details').open);
  await page.keyboard.press('Space'); const o2 = await page.evaluate(() => document.querySelector('.pf-faq details').open);
  log('faqKeys', { enterOpens: o1, spaceCloses: !o2 });
  await ctx.close();
}
await b.close();
fs.writeFileSync(`qa/M1/bughunt-tmp3/nav-${which}.json`, JSON.stringify(out, null, 1));
