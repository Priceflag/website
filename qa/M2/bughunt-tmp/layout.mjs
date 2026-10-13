// Layout sweep: viewports x pages x browsers. Checks h-overflow, clipped/offscreen interactive elements,
// overlaps between key boxes, console errors/CSP violations. Screens to ./shots
import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
const BASE = 'http://localhost:8934/';
const PAGES = ['index.html', 'about.html', 'contact.html', 'legal.html', 'signin.html'];
const VPS = [
  [320, 568], [375, 812], [768, 1024], [1440, 900], [1920, 1080], [2560, 1440],
  [844, 390], [390, 844], [720, 450] /*200% of 1440x900*/, [360, 225] /*400% of 1440x900*/, [320, 256] /*400% of 1280x1024*/,
  [640, 400] /*200% of 1280x800*/, [1024, 560], [1024, 561], [1024, 559], [500, 600], [600, 520], [1280, 300],
];
const out = [];
fs.mkdirSync(new URL('./shots/', import.meta.url), { recursive: true });
const routeBlock = async (ctx) => {
  await ctx.route(/script\.google\.com/, r => r.fulfill({ status: 200, contentType: 'text/plain', body: '{"ok":true}' }));
  await ctx.route(/dashboard\.priceflag\.org/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
};
const probe = () => {
  const vw = document.documentElement.clientWidth, vh = innerHeight;
  const res = { sw: document.documentElement.scrollWidth, vw, sh: document.documentElement.scrollHeight, vh, issues: [] };
  const els = [...document.querySelectorAll('a,button,input,textarea,h1,h2,h3,p,li,summary,label')].filter(e => {
    const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
    return cs.visibility !== 'hidden' && cs.display !== 'none' && r.width > 0 && r.height > 0 && !e.closest('.pf-hp,.pf-visually-hidden,[hidden]') && !e.matches('.pf-skip,.skip');
  });
  for (const e of els) {
    const r = e.getBoundingClientRect();
    const ax = r.left + scrollX, right = r.right + scrollX;
    if (right > Math.max(vw, document.documentElement.scrollWidth) + 1 || ax < -1) res.issues.push(`offscreen-x ${e.tagName}.${e.className} "${(e.textContent||'').trim().slice(0,30)}" l=${ax|0} r=${right|0}`);
    // clipped by scroll ancestor with overflow hidden?
    if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === 'visible' && ['P','H1','H2','H3','A','BUTTON','LABEL'].includes(e.tagName) && e.children.length === 0) res.issues.push(`text-overflow ${e.tagName} "${e.textContent.trim().slice(0,30)}" sw=${e.scrollWidth} cw=${e.clientWidth}`);
  }
  // reachability: all focusables within document scroll range
  const docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  for (const e of document.querySelectorAll('a[href],button,input:not([type=hidden]),textarea,[tabindex="0"]')) {
    const cs = getComputedStyle(e); if (cs.display === 'none' || e.closest('[hidden],.pf-hp')) continue;
    const r = e.getBoundingClientRect(); if (!r.width) continue;
    const top = r.top + scrollY;
    // inside a scroll container? fine. Otherwise must be within doc
    let sc = e.parentElement, scrollable = false;
    while (sc && sc !== document.body) { const o = getComputedStyle(sc).overflowY; if ((o === 'auto' || o === 'scroll') && sc.scrollHeight > sc.clientHeight) { scrollable = true; break; } sc = sc.parentElement; }
    if (!scrollable && (top + r.height > Math.max(docH, vh) + 1 || top < -1)) res.issues.push(`unreachable-y ${e.tagName} "${(e.textContent||e.id).trim().slice(0,25)}" top=${top|0} h=${r.height|0} docH=${docH}`);
    // body overflow hidden + element below fold and not in scroller
    if (!scrollable && getComputedStyle(document.body).overflowY === 'hidden' && getComputedStyle(document.documentElement).overflowY !== 'auto' && top + r.height > vh + 1) res.issues.push(`below-fold-noscroll ${e.tagName} "${(e.textContent||e.id).trim().slice(0,25)}" bottom=${(top+r.height)|0} vh=${vh}`);
  }
  // overlap: header marks vs title; signin wordmark vs eyebrow; legal vs form; arrow vs title
  const pairs = [['.pf-arrow', '.pf-sheet-title'], ['.pf-mark', '.pf-sheet-title'], ['.pf-wordmark', '.pf-eyebrow'], ['.pf-wordmark', 'h1'], ['.pf-legal', '.pf-form'], ['.pf-legal', '.pf-note'], ['.pf-nav-logo', '.pf-nav .pf-btn']];
  for (const [a, b] of pairs) {
    const A = document.querySelector(a), B = document.querySelector(b); if (!A || !B) continue;
    const ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect();
    // use inner content box for text: shrink by line height slack? use raw boxes
    const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (ox > 1 && oy > 1) res.issues.push(`overlap ${a} [${ra.left|0},${ra.top|0},${ra.right|0},${ra.bottom|0}] x ${b} [${rb.left|0},${rb.top|0},${rb.right|0},${rb.bottom|0}]`);
  }
  // sub-page sheet visible within viewport
  const sh = document.querySelector('.pf-sheet');
  if (sh) { const r = sh.getBoundingClientRect(); res.sheet = [r.left|0, r.top|0, r.width|0, r.height|0]; const m = document.querySelector('main'); res.mainClient = m.clientHeight; res.mainScroll = m.scrollHeight; }
  return res;
};
for (const [bname, bt] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await bt.launch();
  for (const [w, h] of VPS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await routeBlock(ctx);
    for (const p of PAGES) {
      const page = await ctx.newPage();
      const msgs = [];
      page.on('console', m => { if (['error', 'warning'].includes(m.type())) msgs.push(m.type() + ': ' + m.text()); });
      page.on('pageerror', e => msgs.push('pageerror: ' + e.message));
      await page.goto(BASE + p, { waitUntil: 'networkidle' }).catch(e => msgs.push('goto ' + e.message));
      await page.waitForTimeout(150);
      const r = await page.evaluate(probe);
      if (r.sw > r.vw + 1) r.issues.unshift(`h-scroll sw=${r.sw} vw=${r.vw}`);
      if (bname === 'chromium' && ['320x568', '844x390', '360x225', '320x256', '1920x1080', '720x450'].includes(`${w}x${h}`)) await page.screenshot({ path: new URL(`./shots/${p.replace('.html', '')}-${w}x${h}.png`, import.meta.url).pathname, fullPage: true });
      out.push({ b: bname, p, vp: `${w}x${h}`, ...r, msgs });
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
}
fs.writeFileSync(new URL('./layout.json', import.meta.url), JSON.stringify(out, null, 1));
for (const o of out) if (o.issues.length || o.msgs.length) console.log(o.b, o.p, o.vp, JSON.stringify(o.issues.slice(0, 6)), o.msgs.slice(0, 3).join(' | '));
