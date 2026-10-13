import { chromium, webkit } from 'playwright';
const base = process.env.BASE || 'http://localhost:8932';
const pages = ['/', '/about', '/contact', '/legal', '/signin.html'];
const widths = [375, 1440];
const b = await chromium.launch();
for (const p of pages) for (const w of widths) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  const pg = await ctx.newPage();
  await pg.goto(base + p, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(400);
  const r = await pg.evaluate(() => {
    const EX = '.pf-nav-logo,.pf-foot-mark,.pf-foot-word,.pf-hiker,.pf-arrow,.pf-mark,[class*="wordmark"],[class*="logo"],svg';
    const res = {};
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (!el || !el.checkVisibility || !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const rect = el.getBoundingClientRect(); if (rect.width === 0 || rect.height === 0) continue;
      if (el.closest('.pf-visually-hidden,.pf-hp,.skip,.pf-skip,[class*="sr-only"]')) continue;
      const exempt = !!el.closest(EX);
      const sec = el.closest('section,header,footer,nav,aside,form,main,article') ;
      let key = sec ? sec.tagName.toLowerCase() + (sec.id ? '#' + sec.id : '') + (sec.className && typeof sec.className === 'string' ? '.' + sec.className.split(' ')[0] : '') : 'body';
      // prefer the outermost section-level element under main
      const outer = el.closest('section,footer,nav,header');
      if (outer) key = outer.tagName.toLowerCase() + (outer.id ? '#' + outer.id : '') + (typeof outer.className === 'string' && outer.className ? '.' + outer.className.split(' ')[0] : '');
      const fs = getComputedStyle(el).fontSize;
      res[key] ??= {};
      const k = fs + (exempt ? ' (exempt)' : '');
      res[key][k] ??= [];
      if (res[key][k].length < 2) res[key][k].push(n.textContent.trim().slice(0, 30));
    }
    return res;
  });
  for (const [k, v] of Object.entries(r)) {
    const counted = Object.keys(v).filter(x => !x.includes('exempt'));
    const flag = counted.length > 3 ? '  <-- >3' : '';
    console.log(`${p} @${w} ${k}: ${counted.length} sizes${flag} :: ` + Object.entries(v).map(([s, t]) => `${s}[${t.join('|')}]`).join('  '));
  }
  await ctx.close();
}
await b.close();
