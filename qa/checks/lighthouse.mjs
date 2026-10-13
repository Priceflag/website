// lighthouse: Lighthouse mobile (default mobile emulation + simulated throttling) for
// every page with `lighthouse: true`. Runs sequentially in its own Chrome (Playwright's
// Chromium binary unless CHROME_PATH is set). QA_LH_RUNS=N runs each page N times and keeps
// the median-performance run (default 3). FAIL if any category < 0.90.
import fs from 'node:fs';
import path from 'node:path';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { chromium } from 'playwright';
import { pageUrl, worst, mdTable, writeJson, withTimeout } from '../lib/util.mjs';

export const title = 'Lighthouse mobile (perf, a11y, best-practices, SEO)';
export const THRESHOLD = 0.9;
const CATS = ['performance', 'accessibility', 'best-practices', 'seo'];
const METRICS = ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index'];

export default async function run(ctx) {
  const runs = Math.max(1, Number(process.env.QA_LH_RUNS || 3));
  const targets = ctx.pages.filter((p) => p.lighthouse);
  const dir = path.join(ctx.outDir, 'lighthouse');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const chromePath = process.env.CHROME_PATH || chromium.executablePath();
  const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-first-run', '--disable-gpu'] });
  const scores = {};
  const metrics = {};
  const pages = {};
  // Lighthouse's trace engine prints recoverable LanternErrors (e.g. NO_LCP inside an insight) as
  // full stack traces via console.error. Keep stdout readable: count them instead.
  const origError = console.error;
  let suppressed = 0;
  console.error = (...a) => { if (/LanternError|trace_engine/.test(a.map(String).join(' '))) { suppressed++; return; } origError(...a); };
  try {
    for (const pg of targets) {
      const attempts = [];
      // Lighthouse occasionally fails to record a trace (NO_NAVSTART etc.): retry up to 2 extra times.
      for (let i = 0, good = 0; good < runs && i < runs + 2; i++) {
        try {
          const r = await withTimeout(lighthouse(pageUrl(ctx, pg), { port: chrome.port, output: 'html', logLevel: 'error', onlyCategories: CATS }), 180000, `lighthouse ${pg.name}`);
          if (r?.lhr?.runtimeError) throw new Error(`${r.lhr.runtimeError.code}: ${r.lhr.runtimeError.message}`);
          attempts.push(r);
          good++;
        } catch (e) {
          attempts.push({ error: String(e.message || e) });
          ctx.log(`lighthouse ${pg.name}: attempt ${i + 1} failed — ${String(e.message || e).slice(0, 120)}`);
        }
      }
      const ok = attempts.filter((a) => a.lhr).sort((a, b) => (a.lhr.categories.performance?.score ?? 0) - (b.lhr.categories.performance?.score ?? 0));
      if (!ok.length) {
        pages[pg.name] = { status: 'ERROR', error: attempts.map((a) => a.error).join('; ') };
        scores[pg.name] = null;
        continue;
      }
      const pick = ok[Math.floor((ok.length - 1) / 2)];
      fs.writeFileSync(path.join(dir, `${pg.name}.html`), pick.report);
      scores[pg.name] = Object.fromEntries(CATS.map((c) => [c, pick.lhr.categories[c]?.score ?? null]));
      metrics[pg.name] = {
        ...Object.fromEntries(METRICS.map((m) => [m, pick.lhr.audits[m]?.numericValue != null ? Math.round(pick.lhr.audits[m].numericValue * 1000) / 1000 : null])),
        runs: ok.length, allPerformance: ok.map((a) => a.lhr.categories.performance?.score),
        failedAudits: Object.values(pick.lhr.audits).filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'manual' && a.scoreDisplayMode !== 'notApplicable').map((a) => a.id).slice(0, 40),
        warnings: pick.lhr.runWarnings,
      };
      const below = CATS.filter((c) => (scores[pg.name][c] ?? 0) < THRESHOLD);
      pages[pg.name] = { status: below.length ? 'FAIL' : 'PASS', ...scores[pg.name], below };
    }
  } finally {
    console.error = origError;
    await chrome.kill();
  }
  if (suppressed) ctx.log(`lighthouse: suppressed ${suppressed} internal trace-engine error logs (non-fatal)`);
  writeJson(path.join(ctx.outDir, 'lighthouse.json'), scores);
  writeJson(path.join(ctx.outDir, 'lighthouse-metrics.json'), metrics);
  const f = (v) => (v == null ? '-' : Math.round(v * 100));
  const rows = targets.map((pg) => {
    const s = scores[pg.name] || {};
    const m = metrics[pg.name] || {};
    return [pg.name, pages[pg.name].status, f(s.performance), f(s.accessibility), f(s['best-practices']), f(s.seo),
      m['largest-contentful-paint'] != null ? `${(m['largest-contentful-paint'] / 1000).toFixed(1)}s` : '-',
      m['total-blocking-time'] != null ? `${Math.round(m['total-blocking-time'])}ms` : '-',
      m['cumulative-layout-shift'] ?? '-', pages[pg.name].error || ''];
  });
  const skipped = ctx.pages.filter((p) => !p.lighthouse).map((p) => p.name);
  const md = `# lighthouse\n\nMobile emulation + default simulated throttling, ${runs} run(s)/page (median by performance). FAIL if any category < ${THRESHOLD * 100}. ` +
    `Reports: lighthouse/<page>.html. Not in the Lighthouse list: ${skipped.join(', ') || 'none'}.\n\n` +
    mdTable(['page', 'status', 'perf', 'a11y', 'best-practices', 'seo', 'LCP', 'TBT', 'CLS', 'error'], rows) + '\n' +
    Object.entries(metrics).map(([n, m]) => `\n- ${n}: audits < 0.9: ${m.failedAudits.join(', ') || 'none'}`).join('') + '\n';
  return { status: worst(Object.values(pages).map((p) => p.status)), pages, data: { scores, metrics }, md, scores };
}
