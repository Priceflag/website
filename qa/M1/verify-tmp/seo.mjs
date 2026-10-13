import { chromium } from 'playwright';
import { startServer } from '../../serve.mjs';
const srv = await startServer();
const b = await chromium.launch(); const ctx = await b.newContext({ javaScriptEnabled: false }); const pg = await ctx.newPage();
const norm = s => s.replace(/\s+/g, ' ').trim();
for (const p of ['/', '/about', '/contact', '/legal', '/signin.html']) {
  await pg.goto(srv.url + p);
  const r = await pg.evaluate(() => {
    const m = n => document.querySelector(`meta[name="${n}"],meta[property="${n}"]`)?.content;
    const lds = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => { try { return { ok: true, j: JSON.parse(s.textContent) }; } catch (e) { return { ok: false, e: e.message }; } });
    const faqVisible = [...document.querySelectorAll('details')].map(d => ({ q: d.querySelector('summary').textContent, a: d.querySelector('p').textContent }));
    return { title: document.title, desc: m('description'), ogt: m('og:title'), ogd: m('og:description'), ogalt: m('og:image:alt'), ogurl: m('og:url'), canon: document.querySelector('link[rel=canonical]')?.href, robots: m('robots'), h1: document.querySelectorAll('h1').length, lds, faqVisible,
      hashLinks: [...document.querySelectorAll('a')].filter(a => a.getAttribute('href') === '#' || a.getAttribute('href') === '').length,
      inPageAnchors: [...document.querySelectorAll('a[href^="#"]')].map(a => [a.getAttribute('href'), !!document.getElementById(a.getAttribute('href').slice(1))]) };
  });
  console.log('\n##', p);
  for (const k of ['title', 'desc', 'ogt', 'ogd', 'ogalt']) if (r[k]) console.log(k, r[k].length, JSON.stringify(r[k]));
  console.log('ogurl', r.ogurl, 'canon', r.canon, 'robots', r.robots, 'h1', r.h1, 'hash links', r.hashLinks, 'anchors', JSON.stringify(r.inPageAnchors));
  console.log('desc==ogd', r.desc === r.ogd);
  r.lds.forEach((l, i) => console.log('ld', i, l.ok ? 'valid JSON, types: ' + JSON.stringify((l.j['@graph'] || [l.j]).map(x => x['@type'])) : 'INVALID ' + l.e));
  const faq = r.lds.flatMap(l => l.ok ? (l.j['@graph'] || [l.j]) : []).find(x => x['@type'] === 'FAQPage');
  if (faq) {
    const ld = faq.mainEntity.map(q => ({ q: q.name, a: q.acceptedAnswer.text }));
    console.log('FAQ count ld', ld.length, 'visible', r.faqVisible.length);
    ld.forEach((x, i) => { const v = r.faqVisible[i]; console.log(' Q', i, norm(x.q) === norm(v?.q || '') ? 'q-match' : 'Q MISMATCH', norm(x.a) === norm(v?.a || '') ? 'a-match' : 'A MISMATCH', x.q === v?.q && x.a === v?.a ? '(byte-exact)' : '(ws-normalized)'); });
  }
}
await b.close(); await srv.close();
