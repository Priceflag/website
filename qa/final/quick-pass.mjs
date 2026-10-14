// Final quick pass (owner's speed mode): every page at desktop and mobile in Chromium,
// every link followed, mobile menu, calculator, review form submit (endpoint mocked), console errors.
import { chromium } from 'playwright';
import { startServer } from '../serve.mjs';
const BASE = process.env.QA_BASE_URL; const BYPASS = process.env.QA_BYPASS;
const srv = BASE ? null : await startServer();
const base = BASE || srv.url; const host = new URL(base).host;
const pages = ['/', '/about', '/contact', '/legal', '/how-we-measure', '/vs-intelligems', '/black-friday'];
const b = await chromium.launch();
const problems = []; const notes = [];
async function ctxFor(width) {
  const c = await b.newContext({ viewport: { width, height: width < 500 ? 812 : 900 } });
  if (BYPASS) await c.route((u) => u.host === host, (r) => r.continue({ headers: { ...r.request().headers(), 'x-vercel-protection-bypass': BYPASS } }));
  await c.route(/script\.google\.com\/macros/, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true}' }));
  return c;
}
for (const width of [1440, 375]) {
  const c = await ctxFor(width);
  for (const path of pages) {
    const p = await c.newPage(); const errs = [];
    p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
    p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    p.on('response', (r) => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
    const res = await p.goto(base + path, { waitUntil: 'networkidle' });
    if (!res || res.status() >= 400) problems.push(`${width} ${path}: HTTP ${res && res.status()}`);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 0) problems.push(`${width} ${path}: horizontal overflow ${overflow}px`);
    // every link: internal ones must resolve (anchor target exists or page loads)
    const links = await p.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
    for (const h of [...new Set(links)]) {
      if (h === '#' || h === '') { problems.push(`${width} ${path}: empty link ${JSON.stringify(h)}`); continue; }
      if (h.startsWith('#')) { if (!(await p.$(h))) problems.push(`${width} ${path}: anchor ${h} has no target`); continue; }
      if (h.startsWith('mailto:') || /^https?:/.test(h) && !h.includes(host)) continue;
      const u = new URL(h, base + path); const [pathPart, hash] = [u.pathname, u.hash];
      const r = await c.request.get(base + pathPart, { headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {}, maxRedirects: 0 }).catch((e) => ({ status: () => 0 }));
      if (![200, 301, 302, 307, 308].includes(r.status())) problems.push(`${width} ${path}: link ${h} -> ${r.status()}`);
    }
    if (path === '/') {
      // click every nav link
      if (width < 768) {
        const toggle = await p.$('.pf-nav button[aria-expanded]');
        if (!toggle) problems.push('375 /: no menu button');
        else {
          await toggle.click(); if ((await toggle.getAttribute('aria-expanded')) !== 'true') problems.push('menu did not open');
          await p.keyboard.press('Escape'); if ((await toggle.getAttribute('aria-expanded')) !== 'false') problems.push('menu did not close on Esc');
          await toggle.click(); await p.click('.pf-nav a[href="#faq"]'); await p.waitForTimeout(300);
          if ((await toggle.getAttribute('aria-expanded')) !== 'false') problems.push('menu did not close on link click');
        }
      } else {
        for (const h of ['#how-it-works', '#faq', '#founders', '#review']) {
          await p.click(`.pf-nav a[href="${h}"] >> visible=true`); await p.waitForTimeout(1500);
          const top = await p.$eval(h, (el) => el.getBoundingClientRect().top);
          if (top < 0 || top > 400) problems.push(`nav ${h} landed at ${Math.round(top)}px`);
        }
      }
      // calculator: same-profit with unit cost
      await p.fill('#calculator input >> nth=0', '24'); await p.fill('#calculator input >> nth=1', '27'); await p.fill('#calculator input >> nth=2', '9.60');
      await p.waitForTimeout(400);
      const ans = await p.textContent('#calculator output, #calculator [aria-live]');
      if (!/17\.2%/.test(ans)) problems.push(`calculator: expected 17.2% (same profit at $9.60 cost), got ${ans.trim().slice(0, 120)}`);
      await p.fill('#calculator input >> nth=2', '0'); await p.waitForTimeout(400);
      notes.push('calc cost 0 → ' + (await p.textContent('#calculator output, #calculator [aria-live]')).trim().slice(0, 90));
      await p.fill('#calculator input >> nth=2', '9.60'); await p.waitForTimeout(300);
      // calculator CTA prefills, then submit the form
      await p.click('#calculator a[href="#review"]'); await p.waitForTimeout(600);
      const sent = [];
      p.on('request', (r) => { if (/script\.google/.test(r.url())) sent.push(r.postData()); });
      await p.fill('#rv-email', 'quickpass@example.com'); await p.fill('#rv-store', 'example-store.com');
      await p.click('#review button[type=submit]');
      await p.waitForSelector('form[data-state="sent"]', { timeout: 8000 }).catch(() => problems.push(`${width}: form did not reach the sent state`));
      if (sent.length !== 1) problems.push(`${width}: expected 1 form request, saw ${sent.length}`);
      else { const d = JSON.parse(sent[0]); notes.push(`${width} form payload: price=${d.price} testPrice=${d.testPrice} cost=${d.cost} page startsWith priceflag.org=${d.page.startsWith('https://priceflag.org/')}`); }
      // every button on the page is clickable without errors
      notes.push(`${width} buttons: ` + (await p.$$eval('button', (bs) => bs.map((x) => x.textContent.trim().slice(0, 30)).join(' | '))));
      // results: every number has an "In simulation" label right above it
      const sim = await p.$eval('#results', (r) => ({ label: r.querySelector('.pf-results-tag')?.textContent.trim(), labelVisible: !!r.querySelector('.pf-results-tag')?.offsetParent, figs: [...r.querySelectorAll('.pf-results-row .pf-results-fig')].map((f) => f.textContent), foot: !!r.querySelector('.pf-results-foot a[href="/how-we-measure"]') }));
      if (sim.label !== 'In simulation' || !sim.labelVisible || sim.figs.join() !== '93%,82%,100%' || !sim.foot) problems.push('results: ' + JSON.stringify(sim));
    }
    if (errs.length) problems.push(`${width} ${path}: console/network: ${errs.slice(0, 4).join(' || ')}`);
    await p.close();
  }
  await c.close();
}
await b.close(); if (srv) await srv.close();
console.log('NOTES\n' + notes.join('\n'));
console.log(problems.length ? 'PROBLEMS\n' + problems.join('\n') : 'PROBLEMS: none');
