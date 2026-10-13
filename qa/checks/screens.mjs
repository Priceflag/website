// screens: full-page + above-the-fold screenshots at 375/768/1440 (Chromium),
// horizontal overflow and CLS per page/width.
import fs from 'node:fs';
import path from 'node:path';
import { gotoSettled, pageUrl, worst, mdTable, mapLimit } from '../lib/util.mjs';

export const title = 'Screenshots, horizontal overflow, CLS (Chromium 375/768/1440)';
export const WIDTHS = [375, 768, 1440];
export const CLS_FAIL = 0.1;   // Web Vitals "good" threshold
export const CLS_WARN = 0.01;  // anything visible on load is worth a look

export const CLS_INIT = `(() => {
  window.__qaCls = 0; window.__qaShifts = [];
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue;
        window.__qaCls += e.value;
        window.__qaShifts.push({ value: e.value, t: Math.round(e.startTime),
          sources: (e.sources || []).slice(0, 3).map((s) => {
            const n = s.node; if (!n || !n.nodeName) return '?';
            return n.nodeName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\\s+/).slice(0, 2).join('.') : '');
          }) });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {}
  // Largest element that scrolls vertically on its own (used by the screenshot step).
  window.__qaInnerScroller = () => {
    let best = null, bestArea = 0;
    for (const el of document.querySelectorAll('body *')) {
      if (el.scrollHeight <= el.clientHeight + 10) continue;
      const oy = getComputedStyle(el).overflowY;
      if (oy !== 'auto' && oy !== 'scroll') continue;
      const area = el.clientWidth * el.clientHeight;
      if (area > bestArea && area > 0.2 * innerWidth * innerHeight) { best = el; bestArea = area; }
    }
    return best;
  };
})();`;

const OVERFLOW_PROBE = () => {
  const se = document.scrollingElement || document.documentElement;
  const vw = window.innerWidth;
  const offenders = [];
  if (se.scrollWidth > vw) {
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width && r.right > vw + 1) {
        offenders.push({ el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''), right: Math.round(r.right) });
        if (offenders.length >= 8) break;
      }
    }
  }
  return { scrollWidth: se.scrollWidth, innerWidth: vw, overflow: se.scrollWidth > vw, offenders };
};

async function shoot(browser, ctx, pg, width, dir) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(CLS_INIT);
  const page = await context.newPage();
  const out = { width };
  try {
    await gotoSettled(page, pageUrl(ctx, pg));
    out.cls = await page.evaluate(() => window.__qaCls ?? null);
    out.shifts = await page.evaluate(() => (window.__qaShifts || []).slice(0, 10));
    await page.screenshot({ path: path.join(dir, `${pg.name}-${width}-fold.png`) });
    const o1 = await page.evaluate(OVERFLOW_PROBE);
    // Scroll through (document AND the largest inner scroll container, if any) so lazy /
    // reveal-on-scroll content renders before the full-page shot.
    await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const scrollers = [document.scrollingElement || document.documentElement];
      const inner = window.__qaInnerScroller?.();
      if (inner) scrollers.push(inner);
      for (const sc of scrollers) {
        const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
        for (let i = 0, y = 0; i < 80 && y < sc.scrollHeight; i++, y += step) { sc.scrollTo(0, y); await sleep(120); }
        sc.scrollTo(0, sc.scrollHeight); await sleep(500);
        sc.scrollTo(0, 0); await sleep(300);
      }
    });
    out.clsAfterScroll = await page.evaluate(() => window.__qaCls ?? null);
    const o2 = await page.evaluate(OVERFLOW_PROBE);
    const o = o2.scrollWidth > o1.scrollWidth ? o2 : o1;
    Object.assign(out, { overflow: o1.overflow || o2.overflow, scrollWidth: o.scrollWidth, innerWidth: o.innerWidth, overflowOffenders: o.offenders });
    // Pages whose content lives in an inner scroll container (body height:100vh; overflow:hidden)
    // would make fullPage == fold. Unlock that container and its ancestors so the full content
    // lays out in the document flow (layout is approximate for those pages; the fold shot is exact).
    out.innerScroller = await page.evaluate(() => {
      const el = window.__qaInnerScroller?.();
      if (!el) return null;
      const desc = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '');
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) n.setAttribute('data-qa-unlock', '');
      const st = document.createElement('style');
      st.textContent = 'html,body,[data-qa-unlock]{height:auto!important;max-height:none!important;min-height:0!important;overflow:visible!important;}';
      document.head.appendChild(st);
      return { unlocked: desc };
    });
    if (out.innerScroller) await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(dir, `${pg.name}-${width}.png`), fullPage: true, timeout: 60000 });
    out.status = out.overflow || out.cls > CLS_FAIL ? 'FAIL' : out.cls > CLS_WARN ? 'WARN' : 'PASS';
  } catch (e) {
    out.status = 'ERROR';
    out.error = String(e.message || e);
  }
  await context.close();
  return out;
}

export default async function run(ctx) {
  const dir = path.join(ctx.outDir, 'screens');
  fs.mkdirSync(dir, { recursive: true });
  const browser = await ctx.getBrowser('chromium');
  const jobs = ctx.pages.flatMap((pg) => WIDTHS.map((w) => ({ pg, w })));
  const res = await mapLimit(jobs, 3, ({ pg, w }) => shoot(browser, ctx, pg, w, dir));
  const pages = {};
  const rows = [];
  jobs.forEach(({ pg, w }, i) => {
    const r = res[i];
    const p = (pages[pg.name] ||= { status: 'SKIP', widths: {} });
    p.widths[w] = r;
    p.status = worst(p.status, r.status);
    rows.push([pg.name, w, r.status, r.overflow ? `YES (${r.scrollWidth}px > ${r.innerWidth}px)` : r.overflow === false ? 'no' : '-', r.cls?.toFixed?.(4) ?? '-', r.clsAfterScroll?.toFixed?.(4) ?? '-', `screens/${pg.name}-${w}.png`, r.error || '']);
  });
  let md = `# screens\n\nCLS FAIL > ${CLS_FAIL}, WARN > ${CLS_WARN} (load CLS, measured before any scrolling). Horizontal overflow = FAIL.\n\n` +
    mdTable(['page', 'width', 'status', 'horizontal overflow', 'CLS (load)', 'CLS (after scroll)', 'screenshot', 'error'], rows) + '\n';
  for (const [name, p] of Object.entries(pages)) for (const [w, r] of Object.entries(p.widths)) {
    if (r.overflowOffenders?.length) md += `\n- ${name}@${w} overflow offenders: ${r.overflowOffenders.map((o) => `${o.el} (right ${o.right}px)`).join(', ')}`;
    if (r.shifts?.length) md += `\n- ${name}@${w} layout shifts: ${r.shifts.map((s) => `${s.value.toFixed(4)}@${s.t}ms [${s.sources.join(', ')}]`).join('; ')}`;
  }
  return { status: worst(Object.values(pages).map((p) => p.status)), pages, data: pages, md: md + '\n' };
}
