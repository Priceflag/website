import { chromium, webkit } from 'playwright';
const base = 'http://localhost:8932';
const pages = ['/', '/about', '/contact', '/legal', '/signin.html'];
const vps = [[320,640,'320'],[375,812,'375'],[768,1024,'768'],[1440,900,'1440'],[1920,1080,'1920'],[844,390,'844x390 landscape'],[720,450,'1440@200%'],[187,406,'375@200%'],[320,256,'1280@400%']];
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
const b = await engine.launch();
for (const p of pages) for (const [w,h,label] of vps) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const pg = await ctx.newPage();
  await pg.route(/script\.google\.com/, r => r.abort());
  await pg.goto(base + p, { waitUntil: 'networkidle' }); await pg.waitForTimeout(300);
  const r = await pg.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    const off = [];
    const clipped = [];
    for (const e of document.querySelectorAll('body *')) {
      if (!e.checkVisibility()) continue;
      if (e.closest('.pf-visually-hidden,.pf-hp,.pf-skip,.skip,.pf-bg,.pf-media,svg')) continue;
      const rc = e.getBoundingClientRect(); if (!rc.width || !rc.height) continue;
      const hasText = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if ((hasText || e.matches('a,button,input,.pf-hiker')) && (rc.right > vw + 1 || rc.left < -1)) off.push(e.tagName + '.' + (e.className||'') + ' ' + Math.round(rc.left) + '-' + Math.round(rc.right));
      const cs = getComputedStyle(e);
      if (hasText && (cs.overflowX === 'hidden' || cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis') && e.scrollWidth > e.clientWidth + 1) clipped.push(e.tagName + '.' + e.className);
    }
    const main = document.querySelector('main');
    let copy = null;
    if (main && document.querySelector('.pf-sheet')) { const mr = main.getBoundingClientRect(); copy = { mainVisibleH: Math.round(Math.min(mr.bottom, innerHeight) - Math.max(mr.top, 0)), mainScrolls: main.scrollHeight > main.clientHeight + 1, bodyScrolls: document.documentElement.scrollHeight > innerHeight + 1 }; }
    const mark = document.querySelector('.pf-mark,.pf-nav-logo,.pf-wordmark');
    const mr = mark && mark.getBoundingClientRect();
    return { vw, sw, off: off.slice(0, 6), offN: off.length, clipped: clipped.slice(0,4), copy, mark: mr ? `${Math.round(mr.left)}-${Math.round(mr.right)}` : null };
  });
  const bad = r.sw > r.vw || r.offN || r.clipped.length;
  console.log(`${bad ? 'XX' : 'ok'} ${p} ${label}: sw ${r.sw}/${r.vw} mark ${r.mark} off ${r.offN} ${r.off.join(' ; ')} clipped ${r.clipped.join(',')} ${r.copy ? JSON.stringify(r.copy) : ''}`);
  await ctx.close();
}
await b.close();
