import { chromium } from 'playwright';
const b = await chromium.launch();
for (const base of ['http://localhost:8931','http://localhost:8932']) for (const [w,h] of [[844,390],[667,375],[720,450],[568,320],[187,406],[320,256]]) {
  const pg = await b.newPage({ viewport: { width: w, height: h } });
  await pg.goto(base + '/signin.html', { waitUntil: 'networkidle' });
  const r = await pg.evaluate(() => { const q = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); }; return { word: q('.pf-wordmark'), eyebrow: q('.pf-eyebrow'), h1: q('h1'), form: q('.pf-form'), legal: q('.pf-legal'), docH: document.documentElement.scrollHeight }; });
  const ov = r.word && r.eyebrow ? r.eyebrow[1] - r.word[3] : null;
  console.log(base.slice(-4), w+'x'+h, 'gap wordmark->eyebrow', ov, JSON.stringify(r));
  await pg.close();
}
await b.close();
