import { chromium } from 'playwright';
import { startServer } from '../../serve.mjs';
const srv = await startServer(); const b = await chromium.launch(); const pg = await b.newPage();
await pg.route('**/*', r => r.request().url().startsWith(srv.url) || /fonts\./.test(r.request().url()) ? r.continue() : r.abort());
for (const p of ['/', '/about', '/contact', '/legal', '/signin.html']) {
  await pg.goto(srv.url + p);
  const r = await pg.evaluate(() => {
    const m = (s) => document.querySelector(s)?.getAttribute('content') ?? null;
    const out = { title: document.title, tlen: [...document.title].length, h1: [...document.querySelectorAll('h1')].map(h => h.textContent.trim()), desc: m('meta[name=description]'), ogt: m('meta[property="og:title"]'), ogd: m('meta[property="og:description"]'), ogalt: m('meta[property="og:image:alt"]'), canon: document.querySelector('link[rel=canonical]')?.href, robots: m('meta[name=robots]'), imgsNoAlt: [...document.querySelectorAll('img')].filter(i => !i.hasAttribute('alt')).map(i => i.src) };
    out.dlen = out.desc ? [...out.desc].length : null; out.ogdlen = out.ogd ? [...out.ogd].length : null;
    const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => { try { return JSON.parse(s.textContent); } catch (e) { return 'PARSE ERROR'; } });
    out.ld = ld.length;
    const faq = ld.flatMap(x => (x['@graph'] || [x])).find(n => n['@type'] === 'FAQPage');
    if (faq) { const vis = [...document.querySelectorAll('#faq details')].map(d => [d.querySelector('summary').textContent.trim(), d.querySelector('p').textContent.trim()]);
      out.faq = { ld: faq.mainEntity.length, vis: vis.length, match: faq.mainEntity.every((q, i) => vis[i] && q.name === vis[i][0] && q.acceptedAnswer.text === vis[i][1]) }; }
    out.anchors = [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(h => h.length < 2 || !document.getElementById(h.slice(1)));
    out.emptyHref = document.querySelectorAll('a[href="#"],a[href=""]').length;
    return out;
  });
  console.log(p, JSON.stringify(r));
}
await b.close(); await srv.close();
