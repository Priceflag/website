// html: html-validate on the SERVED html of every page (fetched over HTTP so
// rewrites apply). Config: qa/.htmlvalidate.json. FAIL on any error.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HtmlValidate } from 'html-validate';
import { pageUrl, worst, mdTable } from '../lib/util.mjs';

export const title = 'html-validate (served HTML)';
const CONFIG = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.htmlvalidate.json');

export default async function run(ctx) {
  const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  delete config.$comment;
  const hv = new HtmlValidate(config);
  const pages = {};
  const rows = [];
  let detail = '';
  for (const pg of ctx.pages) {
    const url = pageUrl(ctx, pg);
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
      const html = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const report = await hv.validateString(html, `${pg.name}.html`);
      const messages = report.results.flatMap((r) => r.messages).map((m) => ({
        rule: m.ruleId, severity: m.severity === 2 ? 'error' : 'warning', message: m.message, line: m.line, column: m.column, selector: m.selector,
      }));
      const byRule = {};
      for (const m of messages) byRule[`${m.rule} (${m.severity})`] = (byRule[`${m.rule} (${m.severity})`] || 0) + 1;
      const status = report.errorCount ? 'FAIL' : report.warningCount ? 'WARN' : 'PASS';
      pages[pg.name] = { status, errors: report.errorCount, warnings: report.warningCount, byRule, messages };
      rows.push([pg.name, status, report.errorCount, report.warningCount, Object.entries(byRule).map(([k, v]) => `${k}×${v}`).join(', ')]);
      if (messages.length) detail += `\n## ${pg.name}\n\n${messages.slice(0, 80).map((m) => `- ${m.severity} \`${m.rule}\` L${m.line}:${m.column} — ${m.message}`).join('\n')}${messages.length > 80 ? `\n- … ${messages.length - 80} more (see html.json)` : ''}\n`;
    } catch (e) {
      pages[pg.name] = { status: 'ERROR', error: String(e.message || e) };
      rows.push([pg.name, 'ERROR', '-', '-', String(e.message || e)]);
    }
  }
  const md = `# html\n\nhtml-validate with qa/.htmlvalidate.json (extends html-validate:recommended). FAIL on any error.\n\n` +
    mdTable(['page', 'status', 'errors', 'warnings', 'by rule'], rows) + '\n' + detail;
  return { status: worst(Object.values(pages).map((p) => p.status)), pages, data: pages, md };
}
