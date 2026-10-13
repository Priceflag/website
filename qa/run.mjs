#!/usr/bin/env node
/* =============================================================================
   qa/run.mjs — one-command QA harness for the static Priceflag site.

     npm run qa                      # all checks, 3 browsers, Lighthouse
     npm run qa:fast                 # skip Lighthouse, Chromium only
     QA_LABEL=M1 QA_STRICT=1 npm run qa
     QA_BASE_URL=https://preview.vercel.app npm run qa

   See qa/README.md for env vars, thresholds and how to add a page.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { chromium, firefox, webkit } from 'playwright';
import { startServer } from './serve.mjs';
import { worst, writeJson, writeText, mdTable, mapLimit } from './lib/util.mjs';

const QA_DIR = path.dirname(fileURLToPath(import.meta.url));
const ALL_CHECKS = ['console', 'screens', 'axe', 'html', 'links', 'keyboard', 'nojs', 'unit', 'lighthouse'];

const env = process.env;
const label = (env.QA_LABEL || 'latest').replace(/[^\w.-]/g, '_');
const fast = env.QA_FAST === '1';
const strict = env.QA_STRICT === '1';
const remote = !!env.QA_BASE_URL;
let checks = env.QA_ONLY ? env.QA_ONLY.split(',').map((s) => s.trim()).filter(Boolean) : ALL_CHECKS.filter((c) => !(fast && c === 'lighthouse'));
const unknown = checks.filter((c) => !ALL_CHECKS.includes(c));
if (unknown.length) { console.error(`Unknown check(s): ${unknown.join(', ')}. Valid: ${ALL_CHECKS.join(', ')}`); process.exit(2); }

const cfg = JSON.parse(fs.readFileSync(path.join(QA_DIR, 'pages.json'), 'utf8'));
let pages = cfg.pages.filter((p) => !(remote && p.skipOnRemote));
if (env.QA_PAGES) {
  const want = new Set(env.QA_PAGES.split(',').map((s) => s.trim()));
  pages = pages.filter((p) => want.has(p.name));
}
if (!pages.length) { console.error('No pages selected.'); process.exit(2); }

const outDir = path.join(QA_DIR, label);
fs.mkdirSync(outDir, { recursive: true });
if (checks.includes('screens') || checks.includes('nojs')) {
  const screens = path.join(outDir, 'screens');
  if (checks.includes('screens')) fs.rmSync(screens, { recursive: true, force: true });
  fs.mkdirSync(screens, { recursive: true });
}

const t0 = Date.now();
const log = (...a) => console.log(`[qa ${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

let server = null;
let baseUrl = env.QA_BASE_URL?.replace(/\/+$/, '');
let siteRoot = path.resolve(QA_DIR, '..');
if (!remote && env.QA_GIT_REF) {
  // Serve a pristine export of a commit instead of the working tree (e.g. the "before" baseline
  // while other work is in progress). Exported into qa/<label>/tmp/site (gitignored).
  siteRoot = path.join(outDir, 'tmp', 'site');
  fs.rmSync(siteRoot, { recursive: true, force: true });
  fs.mkdirSync(siteRoot, { recursive: true });
  execSync(`git archive --format=tar ${JSON.stringify(env.QA_GIT_REF)} | tar -x -C ${JSON.stringify(siteRoot)}`, { cwd: path.resolve(QA_DIR, '..'), stdio: ['ignore', 'ignore', 'inherit'], shell: '/bin/sh' });
}
if (!remote) {
  server = await startServer({ port: Number(env.QA_PORT || 0), root: siteRoot });
  baseUrl = server.url;
}
log(`label=${label} base=${baseUrl}${env.QA_GIT_REF ? ` gitRef=${env.QA_GIT_REF}` : ''} strict=${strict} fast=${fast} checks=${checks.join(',')} pages=${pages.map((p) => p.name).join(',')}`);

const launchers = { chromium, firefox, webkit };
const browsers = {};
const ctx = {
  baseUrl, pages, outDir, fast, remote, strict, log,
  getBrowser: (name) => (browsers[name] ||= launchers[name].launch({ headless: true })),
};

function gitRev(ref) {
  try { return execSync(`git rev-parse --short ${JSON.stringify(ref)}`, { cwd: path.resolve(QA_DIR, '..') }).toString().trim(); } catch { return '?'; }
}

async function closeBrowsers() {
  for (const [k, b] of Object.entries(browsers)) {
    delete browsers[k];
    try { await (await b).close(); } catch {}
  }
}

async function runCheck(name) {
  const started = Date.now();
  log(`▶ ${name}`);
  let result;
  try {
    const mod = await import(`./checks/${name}.mjs`);
    result = await mod.default(ctx);
    result.title = mod.title;
  } catch (e) {
    result = { status: 'ERROR', pages: {}, data: { error: String(e.stack || e) }, md: `# ${name}\n\nHarness ERROR:\n\n\`\`\`\n${e.stack || e}\n\`\`\`\n` };
  }
  result.durationMs = Date.now() - started;
  // lighthouse.json is reserved for the score map the check writes itself.
  writeJson(path.join(outDir, name === 'lighthouse' ? 'lighthouse-details.json' : `${name}.json`), { check: name, title: result.title, status: result.status, durationMs: result.durationMs, pages: result.pages, data: result.data });
  writeText(path.join(outDir, `${name}.md`), result.md || `# ${name}\n`);
  log(`■ ${name}: ${result.status} (${(result.durationMs / 1000).toFixed(1)}s)`);
  return [name, result];
}

const results = {};
try {
  // Browser checks in parallel (each limits its own concurrency); Lighthouse alone at the end
  // so its CPU-throttled performance numbers are not skewed by the other checks.
  const parallel = checks.filter((c) => c !== 'lighthouse');
  for (const [n, r] of await mapLimit(parallel, Number(env.QA_CONCURRENCY || 3), runCheck)) results[n] = r;
  await closeBrowsers();
  if (checks.includes('lighthouse')) { const [n, r] = await runCheck('lighthouse'); results[n] = r; }
} finally {
  await closeBrowsers();
  if (server) await server.close();
}

// Optional regression gate vs an earlier label's Lighthouse scores.
let regression = null;
if (results.lighthouse && env.QA_COMPARE) {
  const prevFile = path.join(QA_DIR, env.QA_COMPARE, 'lighthouse.json');
  const tol = Number(env.QA_LH_TOLERANCE ?? 0.02);
  if (fs.existsSync(prevFile)) {
    const prev = JSON.parse(fs.readFileSync(prevFile, 'utf8'));
    const drops = [];
    for (const [pg, s] of Object.entries(results.lighthouse.scores || {})) {
      if (!s || !prev[pg]) continue;
      for (const [cat, v] of Object.entries(s)) if (prev[pg][cat] != null && v != null && v < prev[pg][cat] - tol) drops.push({ page: pg, category: cat, before: prev[pg][cat], now: v });
    }
    regression = { compareTo: env.QA_COMPARE, tolerance: tol, drops, status: drops.length ? 'FAIL' : 'PASS' };
  } else regression = { compareTo: env.QA_COMPARE, status: 'WARN', error: `no ${prevFile}` };
}

// ---- summary ---------------------------------------------------------------
const durationMs = Date.now() - t0;
const overall = worst(Object.values(results).map((r) => r.status), regression?.status);
const summary = {
  label, baseUrl: remote ? baseUrl : `local (qa/serve.mjs)${env.QA_GIT_REF ? ` @ git ${env.QA_GIT_REF} (${gitRev(env.QA_GIT_REF)})` : ' @ working tree'}`, strict, fast, startedAt: new Date(t0).toISOString(), durationMs, overall,
  pages: pages.map((p) => p.name),
  checks: Object.fromEntries(Object.entries(results).map(([n, r]) => [n, { status: r.status, durationMs: r.durationMs, pages: Object.fromEntries(Object.entries(r.pages || {}).map(([p, v]) => [p, v.status])) }])),
  lighthouse: results.lighthouse?.scores ?? null,
  lighthouseRegression: regression,
};
writeJson(path.join(outDir, 'summary.json'), summary);

const pct = (v) => (v == null ? '-' : Math.round(v * 100));
let md = `# QA summary — ${label}\n\n- Overall: **${overall}**\n- Base: ${summary.baseUrl}\n- Started: ${summary.startedAt}, took ${(durationMs / 1000).toFixed(0)}s\n- Mode: ${fast ? 'fast' : 'full'}${strict ? ', strict' : ''}\n\n`;
md += mdTable(['check', 'overall', ...pages.map((p) => p.name), 'time', 'details'],
  Object.entries(results).map(([n, r]) => [n, r.status, ...pages.map((p) => r.pages?.[p.name]?.status ?? (n === 'unit' ? '' : '-')), `${(r.durationMs / 1000).toFixed(0)}s`, `${n}.md`])) + '\n';
if (results.lighthouse) {
  md += `\n## Lighthouse (mobile)\n\n` + mdTable(['page', 'performance', 'accessibility', 'best-practices', 'seo'],
    Object.entries(results.lighthouse.scores || {}).map(([p, s]) => [p, pct(s?.performance), pct(s?.accessibility), pct(s?.['best-practices']), pct(s?.seo)])) + '\n';
}
if (regression) md += `\nLighthouse vs ${regression.compareTo}: **${regression.status}**${regression.drops?.length ? ' — ' + regression.drops.map((d) => `${d.page}/${d.category} ${pct(d.before)}→${pct(d.now)}`).join(', ') : ''}${regression.error ? ` (${regression.error})` : ''}\n`;
writeText(path.join(outDir, 'summary.md'), md);
console.log('\n' + md);

const failed = ['FAIL', 'ERROR'].includes(overall);
if (Object.values(results).some((r) => r.status === 'ERROR')) process.exitCode = 2;
else if (strict && failed) process.exitCode = 1;
