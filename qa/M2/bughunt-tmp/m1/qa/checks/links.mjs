// links: crawl every page in pages.json — static DOM (JS disabled) AND rendered DOM
// (Chromium, JS on) — collect every <a href>, <link href>, <script src>, <img src/srcset>,
// <source src/srcset>, media src/poster, iframe src, CSS url() in style attrs/blocks and
// OG/twitter image meta. Then:
//   - FAIL on any <a href="#"> or <a href=""> (static or rendered)
//   - internal URLs must end at 200 (redirect to an external host = OK)
//   - external URLs must be 2xx/3xx (HEAD, fall back to GET); known bot-blocking hosts
//     answering 403/429/999 are WARN
//   - in-page anchors (#id) must resolve to an element (same page, or another tested page)
import { pageUrl, worst, mdTable, mapLimit, truncate, gotoSettled } from '../lib/util.mjs';

export const title = 'Link crawl (static + rendered DOM), #-links, anchors';

export const BOT_BLOCKING_HOSTS = ['linkedin.com', 'x.com', 'twitter.com', 'youtube.com', 'youtu.be', 'instagram.com', 'facebook.com', 'tiktok.com', 'reddit.com', 'medium.com', 'apps.shopify.com', 'g2.com', 'producthunt.com'];
const SKIP_SCHEMES = /^(mailto|tel|sms|data|blob|about):/i;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 priceflag-qa-linkcheck';

/** Runs in the page. Returns raw link references. */
function extract() {
  const refs = [];
  const add = (kind, raw, el) => {
    if (raw == null) return;
    raw = String(raw).trim();
    let abs = null;
    try { abs = new URL(raw, document.baseURI).href; } catch {}
    refs.push({ kind, raw, abs, rel: el?.getAttribute?.('rel') || null, text: el ? (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 80) : '' });
  };
  const srcset = (v) => (v || '').split(/,\s+/).map((c) => c.trim().split(/\s+/)[0]).filter(Boolean);
  const cssUrls = (txt) => [...String(txt || '').matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)].map((m) => m[2]);
  for (const a of document.querySelectorAll('a')) if (a.hasAttribute('href')) add('a', a.getAttribute('href'), a);
  for (const l of document.querySelectorAll('link[href]')) add('link', l.getAttribute('href'), l);
  for (const s of document.querySelectorAll('script[src]')) add('script', s.getAttribute('src'), s);
  for (const i of document.querySelectorAll('img')) {
    if (i.getAttribute('src')) add('img', i.getAttribute('src'), i);
    for (const u of srcset(i.getAttribute('srcset'))) add('img-srcset', u, i);
  }
  for (const s of document.querySelectorAll('source')) {
    if (s.getAttribute('src')) add('source', s.getAttribute('src'), s);
    for (const u of srcset(s.getAttribute('srcset'))) add('source-srcset', u, s);
  }
  for (const m of document.querySelectorAll('video[src], audio[src], iframe[src], embed[src]')) add(m.tagName.toLowerCase(), m.getAttribute('src'), m);
  for (const v of document.querySelectorAll('video[poster]')) add('video-poster', v.getAttribute('poster'), v);
  for (const el of document.querySelectorAll('[style]')) for (const u of cssUrls(el.getAttribute('style'))) add('css-inline', u, null);
  for (const st of document.querySelectorAll('style')) for (const u of cssUrls(st.textContent)) add('css-block', u, null);
  for (const m of document.querySelectorAll('meta[property^="og:image"], meta[name^="twitter:image"], meta[property^="twitter:image"]')) {
    const p = m.getAttribute('property') || m.getAttribute('name') || '';
    if (/:alt$|:width$|:height$|:type$/.test(p)) continue;
    add('meta-image', m.getAttribute('content'), null);
  }
  const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
  const names = [...document.querySelectorAll('a[name]')].map((e) => e.getAttribute('name'));
  const emptyHash = [...document.querySelectorAll('a[href]')].filter((a) => { const h = a.getAttribute('href').trim(); return h === '#' || h === ''; })
    .map((a) => ({ href: a.getAttribute('href'), text: (a.textContent || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 80) }));
  return { refs, ids: [...ids, ...names], emptyHash, url: location.href };
}

async function collect(browser, ctx, pg, js) {
  const context = await browser.newContext({ javaScriptEnabled: js, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    if (js) await gotoSettled(page, pageUrl(ctx, pg));
    else await page.goto(pageUrl(ctx, pg), { waitUntil: 'load', timeout: 60000 });
    return await page.evaluate(extract);
  } finally {
    await context.close();
  }
}

function isBotHost(u) {
  try { const h = new URL(u).hostname.replace(/^www\./, ''); return BOT_BLOCKING_HOSTS.some((b) => h === b || h.endsWith('.' + b)); } catch { return false; }
}

async function checkInternal(url, origin) {
  let cur = url;
  const chain = [];
  for (let i = 0; i < 6; i++) {
    let res;
    try {
      res = await fetch(cur, { redirect: 'manual', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
    } catch (e) {
      return { status: 'FAIL', code: null, error: String(e.cause?.code || e.message || e), chain };
    }
    try { await res.body?.cancel(); } catch {}
    chain.push(res.status);
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      const next = new URL(res.headers.get('location'), cur).href;
      if (new URL(next).origin !== origin) return { status: 'PASS', code: res.status, redirectedTo: next, chain };
      cur = next;
      continue;
    }
    if (res.status === 403 && res.headers.get('x-vercel-mitigated')) return { status: 'WARN', code: 403, error: 'Vercel bot challenge', chain };
    return { status: res.status === 200 ? 'PASS' : 'FAIL', code: res.status, chain, final: cur };
  }
  return { status: 'FAIL', code: null, error: 'too many redirects', chain };
}

async function checkExternal(url) {
  const attempt = async (method) => {
    const res = await fetch(url, { method, redirect: 'follow', headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(15000) });
    try { await res.body?.cancel(); } catch {}
    return res.status;
  };
  let code = null, error = null;
  try { code = await attempt('HEAD'); } catch (e) { error = String(e.cause?.code || e.message || e); }
  if (code == null || code >= 400) {
    try { code = await attempt('GET'); error = null; } catch (e) { error = String(e.cause?.code || e.message || e); }
  }
  if (code != null && code < 400) return { status: 'PASS', code };
  if (isBotHost(url) && (code === 403 || code === 429 || code === 999 || code === 400)) return { status: 'WARN', code, error: 'bot-blocking host' };
  return { status: 'FAIL', code, error };
}

export default async function run(ctx) {
  const browser = await ctx.getBrowser('chromium');
  const origin = new URL(ctx.baseUrl).origin;
  const perPage = {};
  await mapLimit(ctx.pages, 3, async (pg) => {
    const out = { static: null, rendered: null, error: null };
    try { out.static = await collect(browser, ctx, pg, false); } catch (e) { out.error = `static: ${e.message}`; }
    try { out.rendered = await collect(browser, ctx, pg, true); } catch (e) { out.error = (out.error ? out.error + '; ' : '') + `rendered: ${e.message}`; }
    perPage[pg.name] = out;
  });

  // Ids of every tested page (rendered), keyed by URL without hash, for cross-page anchors.
  const idsByUrl = new Map();
  for (const pg of ctx.pages) {
    const r = perPage[pg.name].rendered;
    if (!r) continue;
    const ids = new Set(r.ids);
    for (const u of [pageUrl(ctx, pg), r.url]) idsByUrl.set(u.split('#')[0], ids);
  }

  // Unique URLs to check, remembering where each came from.
  const urls = new Map(); // abs(without hash) -> { kinds:Set, pages:Set, internal }
  const skipped = [];
  const jsLinks = [];
  for (const pg of ctx.pages) {
    for (const src of ['static', 'rendered']) {
      const d = perPage[pg.name][src];
      if (!d) continue;
      for (const ref of d.refs) {
        if (!ref.raw || ref.raw === '#') continue;
        if (/^javascript:/i.test(ref.raw)) { jsLinks.push({ page: pg.name, raw: ref.raw }); continue; }
        if (SKIP_SCHEMES.test(ref.raw) || !ref.abs) { if (!/^data:/i.test(ref.raw)) skipped.push({ page: pg.name, raw: ref.raw, reason: 'scheme' }); continue; }
        if (ref.kind === 'link' && /\b(preconnect|dns-prefetch)\b/i.test(ref.rel || '')) { skipped.push({ page: pg.name, raw: ref.raw, reason: ref.rel }); continue; }
        const u = new URL(ref.abs);
        if (!/^https?:$/.test(u.protocol)) continue;
        const key = u.href.split('#')[0];
        const e = urls.get(key) || { kinds: new Set(), pages: new Set(), internal: u.origin === origin, sources: new Set() };
        e.kinds.add(ref.kind); e.pages.add(pg.name); e.sources.add(src);
        urls.set(key, e);
      }
    }
  }

  const keys = [...urls.keys()];
  const checked = await mapLimit(keys, 8, async (k) => (urls.get(k).internal ? checkInternal(k, origin) : checkExternal(k)));
  const results = keys.map((k, i) => ({ url: k, ...checked[i], internal: urls.get(k).internal, kinds: [...urls.get(k).kinds], pages: [...urls.get(k).pages], foundIn: [...urls.get(k).sources] }));

  // Anchors
  const anchorIssues = [];
  for (const pg of ctx.pages) {
    const r = perPage[pg.name].rendered;
    if (!r) continue;
    const seen = new Set();
    for (const ref of r.refs) {
      if (ref.kind !== 'a' || !ref.abs || !ref.abs.includes('#')) continue;
      const [base, hash] = [ref.abs.split('#')[0], decodeURIComponent(ref.abs.split('#').slice(1).join('#'))];
      if (!hash || hash === 'top' || seen.has(ref.abs)) continue;
      seen.add(ref.abs);
      const ids = idsByUrl.get(base);
      if (!ids) continue; // target page not under test
      if (!ids.has(hash)) anchorIssues.push({ page: pg.name, href: ref.raw, text: ref.text });
    }
  }

  const pages = {};
  for (const pg of ctx.pages) {
    const d = perPage[pg.name];
    const mine = results.filter((r) => r.pages.includes(pg.name));
    const broken = mine.filter((r) => r.status === 'FAIL');
    const warned = mine.filter((r) => r.status === 'WARN');
    const hashStatic = d.static?.emptyHash || [];
    const hashRendered = d.rendered?.emptyHash || [];
    const anchors = anchorIssues.filter((a) => a.page === pg.name);
    const status = d.error ? 'ERROR' : (broken.length || hashStatic.length || hashRendered.length || anchors.length) ? 'FAIL' : (warned.length || jsLinks.some((j) => j.page === pg.name)) ? 'WARN' : 'PASS';
    pages[pg.name] = {
      status, error: d.error,
      emptyHashLinks: { static: hashStatic.length, rendered: hashRendered.length, examples: [...hashRendered, ...hashStatic].slice(0, 15) },
      urlsChecked: mine.length, broken: broken.map((b) => ({ url: b.url, code: b.code, error: b.error })),
      warnings: warned.map((b) => ({ url: b.url, code: b.code, error: b.error })),
      brokenAnchors: anchors,
      javascriptLinks: jsLinks.filter((j) => j.page === pg.name).length,
      refsFound: { static: d.static?.refs.length ?? 0, rendered: d.rendered?.refs.length ?? 0 },
    };
  }

  const rows = ctx.pages.map((pg) => {
    const p = pages[pg.name];
    return [pg.name, p.status, `${p.emptyHashLinks.static} / ${p.emptyHashLinks.rendered}`, p.urlsChecked, p.broken.length, p.warnings.length, p.brokenAnchors.length, p.error || ''];
  });
  let md = `# links\n\nUnique URLs checked: ${results.length} (${results.filter((r) => r.internal).length} internal, ${results.filter((r) => !r.internal).length} external).\n\n` +
    mdTable(['page', 'status', 'href="#"/"" (static / rendered)', 'URLs', 'broken', 'warn', 'broken anchors', 'error'], rows) + '\n';
  const bad = results.filter((r) => r.status !== 'PASS');
  if (bad.length) md += `\n## Non-passing URLs\n\n${mdTable(['status', 'code', 'url', 'note', 'pages', 'kind'], bad.map((r) => [r.status, r.code ?? '-', truncate(r.url, 120), r.error || '', r.pages.join(','), r.kinds.join(',')]))}\n`;
  for (const [n, p] of Object.entries(pages)) {
    if (p.emptyHashLinks.examples.length) md += `\n- ${n}: \`#\`/empty links e.g. ${p.emptyHashLinks.examples.slice(0, 8).map((e) => `"${e.text || '(no text)'}"`).join(', ')}`;
    if (p.brokenAnchors.length) md += `\n- ${n}: broken anchors ${p.brokenAnchors.map((a) => a.href).join(', ')}`;
  }
  if (skipped.length) md += `\n\nSkipped (not fetched): ${[...new Set(skipped.map((s) => `${s.raw} [${s.reason}]`))].slice(0, 30).join(', ')}\n`;
  return { status: worst(Object.values(pages).map((p) => p.status)), pages, data: { pages, urls: results, anchorIssues, skipped, jsLinks }, md: md + '\n' };
}
