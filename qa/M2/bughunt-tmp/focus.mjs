// Tab through every page; record focus order, outline, ring clipping by overflow/mask ancestors, offscreen focus.
import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
const BASE = 'http://localhost:8934/';
const PAGES = ['index.html', 'about.html', 'contact.html', 'legal.html', 'signin.html'];
const mode = process.argv[2] || 'normal'; // normal | forced | dark
const vpArg = (process.argv[3] || '1440x900').split('x').map(Number);
const res = {};
const fx = async ctx => {
  await ctx.route(/script\.google\.com/, r => r.fulfill({ status: 200, body: '{"ok":true}' }));
  await ctx.route('https://priceflag.org/uploads/summit-painting-3.webp', r => r.fulfill({ path: 'uploads/summit-painting-3.webp', contentType: 'image/webp' }));
};
for (const bt of [chromium, webkit]) {
  const b = await bt.launch();
  const ctx = await b.newContext({ viewport: { width: vpArg[0], height: vpArg[1] } });
  await fx(ctx);
  for (const p of PAGES) {
    const page = await ctx.newPage();
    if (mode === 'forced') await page.emulateMedia({ forcedColors: 'active' });
    if (mode === 'dark') await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    const seq = [];
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press(bt === webkit ? 'Alt+Tab' : 'Tab');
      const info = await page.evaluate(() => {
        const e = document.activeElement; if (!e || e === document.body) return null;
        const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
        const ow = parseFloat(cs.outlineWidth) || 0, oo = parseFloat(cs.outlineOffset) || 0;
        const ring = { l: r.left - oo - ow, t: r.top - oo - ow, r: r.right + oo + ow, b: r.bottom + oo + ow };
        const clips = [];
        for (let a = e.parentElement; a; a = a.parentElement) {
          const s = getComputedStyle(a);
          const clipping = s.overflowX !== 'visible' || s.overflowY !== 'visible' || (s.maskImage && s.maskImage !== 'none') || (s.webkitMaskImage && s.webkitMaskImage !== 'none');
          if (!clipping || a === document.documentElement || a === document.body && s.overflowY !== 'hidden') continue;
          const ar = a.getBoundingClientRect();
          const cut = [ar.left - ring.l, ar.top - ring.t, ring.r - ar.right, ring.b - ar.bottom].map(v => Math.round(v));
          if (cut.some(v => v > 0.5)) clips.push(`${a.tagName}.${a.className} cut(l,t,r,b)=${cut.join(',')}`);
        }
        const offscreen = r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth;
        return { el: `${e.tagName}${e.id ? '#' + e.id : ''}.${e.className}`.slice(0, 60), text: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30),
          outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} off ${cs.outlineOffset}`, boxShadow: cs.boxShadow.slice(0, 40), border: cs.borderTopColor + ' ' + cs.borderTopWidth, bg: cs.backgroundColor, clips, offscreen, rect: [r.left|0, r.top|0, r.width|0, r.height|0] };
      });
      if (!info) { seq.push({ el: 'BODY/none' }); continue; }
      if (seq.length && seq.some(s => s.el === info.el && s.text === info.text && s.rect?.join() === info.rect.join())) break;
      seq.push(info);
    }
    res[`${bt.name()} ${p}`] = seq;
    await page.close();
  }
  await b.close();
}
fs.writeFileSync(new URL(`./focus-${mode}-${vpArg.join('x')}.json`, import.meta.url), JSON.stringify(res, null, 1));
for (const [k, seq] of Object.entries(res)) {
  console.log('==', k, seq.length);
  for (const s of seq) console.log('  ', s.el, '|', s.text, '|', s.outline, s.clips?.length ? 'CLIP ' + s.clips.join(';') : '', s.offscreen ? 'OFFSCREEN' : '');
}
