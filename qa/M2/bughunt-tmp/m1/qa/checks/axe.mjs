// axe: axe-core via @axe-core/playwright at 375 and 1440 (Chromium).
// FAIL on serious/critical violations; WARN on moderate/minor.
import { AxeBuilder } from '@axe-core/playwright';
import { gotoSettled, pageUrl, worst, mdTable, mapLimit, truncate } from '../lib/util.mjs';

export const title = 'axe-core accessibility (375 + 1440)';
const WIDTHS = [375, 1440];
const IMPACTS = ['critical', 'serious', 'moderate', 'minor'];

async function audit(browser, ctx, pg, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  try {
    await gotoSettled(page, pageUrl(ctx, pg));
    const r = await new AxeBuilder({ page }).analyze();
    const byImpact = Object.fromEntries(IMPACTS.map((i) => [i, []]));
    for (const v of r.violations) {
      (byImpact[v.impact] ||= []).push({
        id: v.id, help: v.help, helpUrl: v.helpUrl, nodes: v.nodes.length,
        targets: v.nodes.slice(0, 10).map((n) => ({ target: n.target.join(' '), summary: truncate(n.failureSummary, 300) })),
      });
    }
    const counts = Object.fromEntries(IMPACTS.map((i) => [i, byImpact[i].length]));
    const status = counts.critical || counts.serious ? 'FAIL' : counts.moderate || counts.minor ? 'WARN' : 'PASS';
    return { width, status, counts, byImpact, incomplete: r.incomplete.map((v) => v.id) };
  } catch (e) {
    return { width, status: 'ERROR', error: String(e.message || e) };
  } finally {
    await context.close();
  }
}

export default async function run(ctx) {
  const browser = await ctx.getBrowser('chromium');
  const jobs = ctx.pages.flatMap((pg) => WIDTHS.map((w) => ({ pg, w })));
  const res = await mapLimit(jobs, 3, ({ pg, w }) => audit(browser, ctx, pg, w));
  const pages = {};
  const rows = [];
  let detail = '';
  jobs.forEach(({ pg, w }, i) => {
    const r = res[i];
    const p = (pages[pg.name] ||= { status: 'SKIP', widths: {} });
    p.widths[w] = r;
    p.status = worst(p.status, r.status);
    const c = r.counts || {};
    rows.push([pg.name, w, r.status, c.critical ?? '-', c.serious ?? '-', c.moderate ?? '-', c.minor ?? '-', r.error || '']);
    if (r.byImpact) {
      const lines = IMPACTS.flatMap((imp) => r.byImpact[imp].map((v) => `- **${imp}** \`${v.id}\` (${v.nodes} nodes): ${v.help} — e.g. \`${truncate(v.targets[0]?.target, 120)}\``));
      if (lines.length) detail += `\n## ${pg.name} @ ${w}\n\n${lines.join('\n')}\n`;
    }
  });
  const md = `# axe\n\nCounts are distinct violated rules (node counts in the details). FAIL on any serious/critical.\n\n` +
    mdTable(['page', 'width', 'status', 'critical', 'serious', 'moderate', 'minor', 'error'], rows) + '\n' + detail;
  return { status: worst(Object.values(pages).map((p) => p.status)), pages, data: pages, md };
}
