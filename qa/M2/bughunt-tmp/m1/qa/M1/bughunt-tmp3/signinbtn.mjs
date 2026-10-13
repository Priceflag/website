import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 320, height: 700 }, deviceScaleFactor: 2 })).newPage();
await p.goto('http://localhost:8933/signin'); await p.evaluate(() => document.fonts.ready);
const r = await p.evaluate(() => { const e = document.querySelector('#pf-submit'); const cs = getComputedStyle(e); return { sw: e.scrollWidth, cw: e.clientWidth, ws: cs.whiteSpace, ov: cs.overflow, pad: cs.padding, kids: [...e.children].map(c => c.tagName + ' ' + Math.round(c.getBoundingClientRect().right) ), right: Math.round(e.getBoundingClientRect().right) }; });
console.log(JSON.stringify(r));
await (await p.$('#pf-submit')).screenshot({ path: 'qa/M1/bughunt-tmp3/shots/signin-btn-320.png' });
await b.close();
