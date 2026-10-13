// console: console errors + warnings, uncaught page errors and failed requests,
// per page, in Chromium / Firefox / WebKit (Chromium only with QA_FAST).
import { gotoSettled, pageUrl, worst, mdTable, truncate, mapLimit } from '../lib/util.mjs';

export const title = 'Console errors/warnings, page errors, failed requests (3 browsers)';

async function runPage(browser, ctx, pg) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [], warnings = [], pageErrors = [], failedRequests = [];
  page.on('console', (msg) => {
    const t = msg.type();
    const loc = msg.location();
    const entry = { text: truncate(msg.text(), 500), url: loc?.url || '', line: loc?.lineNumber };
    if (t === 'error') errors.push(entry);
    else if (t === 'warning' || t === 'warn') warnings.push(entry);
  });
  page.on('pageerror', (err) => pageErrors.push(truncate(err?.stack || String(err), 800)));
  page.on('requestfailed', (req) => {
    const failure = req.failure()?.errorText || 'failed';
    // A navigation aborted by the browser itself on teardown is not a site defect.
    failedRequests.push({ url: req.url(), status: null, error: failure, resourceType: req.resourceType() });
  });
  page.on('response', (res) => {
    if (res.status() >= 400) failedRequests.push({ url: res.url(), status: res.status(), error: null, resourceType: res.request().resourceType() });
  });
  let navError = null, idleTimedOut = false;
  try {
    ({ idleTimedOut } = await gotoSettled(page, pageUrl(ctx, pg)));
  } catch (e) {
    navError = String(e.message || e);
  }
  await context.close();
  const status = navError || errors.length || pageErrors.length || failedRequests.length
    ? 'FAIL' : warnings.length ? 'WARN' : 'PASS';
  return { status, errors, warnings, pageErrors, failedRequests, navError, idleTimedOut };
}

export default async function run(ctx) {
  const browserNames = ctx.fast ? ['chromium'] : ['chromium', 'firefox', 'webkit'];
  const results = {};
  // Browsers run in parallel; pages within a browser 2 at a time.
  const launchErrors = {};
  await Promise.all(browserNames.map(async (bn) => {
    let browser;
    try {
      browser = await ctx.getBrowser(bn);
    } catch (e) {
      // e.g. Firefox inside a nested macOS sandbox. Strict runs FAIL; otherwise WARN so the run completes.
      launchErrors[bn] = String(e.message || e).split('\n').filter(Boolean).slice(0, 6).join(' | ');
      ctx.log(`console: ${bn} failed to launch — ${launchErrors[bn].slice(0, 200)}`);
      // QA_BLOCKED_BROWSERS=firefox: a launch failure that is logged as BLOCKED in OVERHAUL_LOG.md stays WARN even in strict runs.
      const known = (process.env.QA_BLOCKED_BROWSERS || '').split(',').map((x) => x.trim()).includes(bn);
      for (const pg of ctx.pages) (results[pg.name] ||= {})[bn] = { status: ctx.strict && !known ? 'FAIL' : 'WARN', navError: `${bn} failed to launch${known ? ' (BLOCKED, see OVERHAUL_LOG.md)' : ''}`, launchError: true };
      return;
    }
    const per = await mapLimit(ctx.pages, 2, (pg) => runPage(browser, ctx, pg).catch((e) => ({ status: 'ERROR', navError: String(e) })));
    ctx.pages.forEach((pg, i) => { (results[pg.name] ||= {})[bn] = per[i]; });
  }));

  const pages = {};
  const rows = [];
  for (const pg of ctx.pages) {
    const r = results[pg.name];
    pages[pg.name] = { status: worst(Object.values(r).map((x) => x.status)) };
    for (const bn of browserNames) {
      const x = r[bn];
      pages[pg.name][bn] = { errors: x.errors?.length ?? null, warnings: x.warnings?.length ?? null, pageErrors: x.pageErrors?.length ?? null, failedRequests: x.failedRequests?.length ?? null, launchError: !!x.launchError };
      rows.push([pg.name, bn, x.status, x.errors?.length ?? '-', x.warnings?.length ?? '-', x.pageErrors?.length ?? '-', x.failedRequests?.length ?? '-', x.navError ? truncate(x.navError, 80) : x.idleTimedOut ? 'network never idle (30s cap)' : '']);
    }
  }
  let md = `# console\n\n${Object.keys(launchErrors).length ? `**Browser launch failures (not tested):** ${Object.entries(launchErrors).map(([b, e]) => `${b}: ${e}`).join('; ')}\n\n` : ''}${mdTable(['page', 'browser', 'status', 'console errors', 'warnings', 'page errors', 'failed requests', 'note'], rows)}\n`;
  for (const pg of ctx.pages) for (const bn of browserNames) {
    const x = results[pg.name][bn];
    const items = [
      ...(x.pageErrors || []).map((e) => `- **pageerror**: ${truncate(e.split('\n')[0], 300)}`),
      ...(x.errors || []).map((e) => `- **error**: ${truncate(e.text, 300)}${e.url ? ` (${e.url})` : ''}`),
      ...(x.failedRequests || []).map((e) => `- **request** ${e.status ?? e.error}: ${e.url}`),
      ...(x.warnings || []).map((e) => `- warning: ${truncate(e.text, 300)}`),
    ];
    if (items.length) md += `\n## ${pg.name} / ${bn}\n\n${items.slice(0, 60).join('\n')}${items.length > 60 ? `\n- … ${items.length - 60} more (see console.json)` : ''}\n`;
  }
  return { status: worst(Object.values(pages).map((p) => p.status)), pages, data: { launchErrors, results }, md };
}
