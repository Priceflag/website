import fs from 'node:fs';
import path from 'node:path';

export const STATUS_RANK = { SKIP: 0, PASS: 1, WARN: 2, FAIL: 3, ERROR: 4 };

/** Worst status of a list (ERROR > FAIL > WARN > PASS > SKIP). */
export function worst(...statuses) {
  let w = 'SKIP';
  for (const s of statuses.flat()) if (s && STATUS_RANK[s] > STATUS_RANK[w]) w = s;
  return w;
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text.endsWith('\n') ? text : text + '\n');
}

export function pageUrl(ctx, page) {
  return new URL(page.path, ctx.baseUrl + '/').href;
}

/** Run async fn over items with at most `n` in flight. Preserves order of results. */
export async function mapLimit(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Navigate and let the page settle: wait for network idle (bounded), then a fixed delay.
 * Never throws on the idle timeout (pages with long-polling or slow CDNs still get tested);
 * returns { response, idleTimedOut }.
 */
export async function gotoSettled(page, url, { idleTimeout = 30000, extraWait = 1000, waitUntil = 'load' } = {}) {
  const response = await page.goto(url, { waitUntil, timeout: 60000 });
  let idleTimedOut = false;
  try {
    await page.waitForLoadState('networkidle', { timeout: idleTimeout });
  } catch {
    idleTimedOut = true;
  }
  if (extraWait) await page.waitForTimeout(extraWait);
  return { response, idleTimedOut };
}

/** Markdown table helper. */
export function mdTable(headers, rows) {
  const esc = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return [
    `| ${headers.map(esc).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`),
  ].join('\n');
}

export function truncate(s, n = 160) {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/** Wrap a Promise with a timeout that rejects. */
export function withTimeout(promise, ms, label = 'operation') {
  let t;
  return Promise.race([
    promise.finally(() => clearTimeout(t)),
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms); }),
  ]);
}
