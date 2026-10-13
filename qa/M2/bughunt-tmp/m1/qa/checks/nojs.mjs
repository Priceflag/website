// nojs: load each page in Chromium with JavaScript disabled. Records visible text
// length, whether an H1 is visible and whether a primary CTA (<a> containing
// "price review") is visible. WARN-only by default (QA_NOJS_STRICT=1 makes it FAIL).
import path from 'node:path';
import { pageUrl, worst, mdTable } from '../lib/util.mjs';

export const title = 'No-JS rendering (H1, primary CTA, text)';
export const MIN_TEXT = 200;
export const CTA_PATTERN = /price review/i;

export default async function run(ctx) {
  const browser = await ctx.getBrowser('chromium');
  const strict = process.env.QA_NOJS_STRICT === '1';
  const pages = {};
  const rows = [];
  for (const pg of ctx.pages) {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    try {
      await page.goto(pageUrl(ctx, pg), { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(300);
      const r = await page.evaluate((src) => {
        const re = new RegExp(src, 'i');
        const vis = (el) => {
          if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
          const b = el.getBoundingClientRect();
          return b.width > 0 && b.height > 0;
        };
        const h1s = [...document.querySelectorAll('h1')];
        const ctas = [...document.querySelectorAll('a')].filter((a) => re.test(a.textContent || ''));
        return {
          textLength: (document.body?.innerText || '').trim().length,
          h1Visible: h1s.some(vis), h1Text: (h1s.find(vis)?.innerText || '').trim().slice(0, 120),
          ctaVisible: ctas.some(vis), ctaCount: ctas.length,
        };
      }, CTA_PATTERN.source);
      await page.screenshot({ path: path.join(ctx.outDir, 'screens', `${pg.name}-1440-nojs-fold.png`) }).catch(() => {});
      const ok = r.h1Visible && r.ctaVisible && r.textLength >= MIN_TEXT;
      pages[pg.name] = { status: ok ? 'PASS' : strict ? 'FAIL' : 'WARN', ...r };
      rows.push([pg.name, pages[pg.name].status, r.textLength, r.h1Visible ? 'yes' : 'NO', r.ctaVisible ? 'yes' : r.ctaCount ? 'in DOM, hidden' : 'NO']);
    } catch (e) {
      pages[pg.name] = { status: 'ERROR', error: String(e.message || e) };
      rows.push([pg.name, 'ERROR', '-', '-', String(e.message || e)]);
    } finally {
      await context.close();
    }
  }
  const md = `# nojs\n\nJavaScript disabled, Chromium 1440. OK = visible H1 + visible "price review" CTA + ≥${MIN_TEXT} chars of visible text. ` +
    `WARN-only unless QA_NOJS_STRICT=1. Fold screenshots: screens/<page>-1440-nojs-fold.png\n\n` +
    mdTable(['page', 'status', 'visible text chars', 'H1 visible', 'CTA visible'], rows) + '\n';
  return { status: worst(Object.values(pages).map((p) => p.status)), pages, data: pages, md };
}
