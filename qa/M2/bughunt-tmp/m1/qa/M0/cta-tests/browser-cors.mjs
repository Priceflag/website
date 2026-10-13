// QA M0 — browser-context test of the Apps Script waitlist endpoint.
// Run: python3 -m http.server 8902 (repo root), then
//   node qa/M0/cta-tests/browser-cors.mjs
// Writes AT MOST ONE row (test A). B is a dedup re-send (no row written),
// C is a no-cors request with a rejected page prefix (no row written),
// D is a request to a dead port (network-error path).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/NithinAwasome/.dev-browser/node_modules/playwright-core');

const EP = 'https://script.google.com/macros/s/AKfycbwihER5l9u8XY81Q55RYJh626QOXCIFI0LJDeQGBt84BFtSIdI4AAfox--A1MptpMZtnw/exec';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:8902/index.html', { waitUntil: 'domcontentloaded' });

const out = await page.evaluate(async (EP) => {
  const res = {};
  const payload = {
    email: 'qa-test+m0@priceflag.org',
    name: 'QA TEST — please delete (overhaul M0)',
    store: 'qa-test.example',
    message: 'QA TEST ENTRY, safe to delete',
    price: 48, cost: 19, testPrice: 53.76, uplift: 0, low: 0, high: 0,
    page: location.href + '#qa-test-m0',
    ua: 'QA TEST overhaul M0 — ' + navigator.userAgent
  };
  async function go(label, init) {
    const t0 = Date.now();
    try {
      const r = await fetch(EP, init);
      let body = null;
      try { body = await r.text(); } catch (e) { body = 'UNREADABLE: ' + e; }
      res[label] = { at: new Date().toISOString(), ms: Date.now() - t0, type: r.type, status: r.status,
        redirected: r.redirected, url: r.url, acao: r.headers.get('access-control-allow-origin'),
        contentType: r.headers.get('content-type'), body };
    } catch (e) {
      res[label] = { at: new Date().toISOString(), ms: Date.now() - t0, error: String(e) };
    }
  }
  const simple = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' } };
  await go('A_real_entry_cors', { ...simple, body: JSON.stringify(payload) });
  await go('B_dedup_resend', { ...simple, body: JSON.stringify(payload) });
  await go('C_nocors_badpage', { ...simple, mode: 'no-cors',
    body: JSON.stringify({ ...payload, page: 'https://not-allowed.example/' }) });
  await go('D_json_ct_preflight_badpage', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, page: 'https://not-allowed.example/' }) });
  try {
    const r = await fetch('http://localhost:9/', { method: 'POST', body: '{}', signal: AbortSignal.timeout(8000) });
    res.E_dead_endpoint = { status: r.status };
  } catch (e) { res.E_dead_endpoint = { at: new Date().toISOString(), error: String(e) }; }
  return res;
}, EP);

console.log(JSON.stringify(out, null, 2));
await browser.close();
