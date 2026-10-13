// QA M0 — simulates a Vercel /api function forwarding to Apps Script (Node fetch, no CORS).
// Writes NO rows: case 1 uses a rejected page prefix, case 2 re-sends the existing test email (dedup).
const EP = 'https://script.google.com/macros/s/AKfycbwihER5l9u8XY81Q55RYJh626QOXCIFI0LJDeQGBt84BFtSIdI4AAfox--A1MptpMZtnw/exec';
for (const [label, page] of [['badpage', 'https://not-allowed.example/'], ['dedup', 'https://priceflag.org/#qa-test-m0']]) {
  const t0 = Date.now();
  const r = await fetch(EP, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ email: 'qa-test+m0@priceflag.org', page }), signal: AbortSignal.timeout(15000) });
  console.log(new Date().toISOString(), label, r.status, r.redirected, r.headers.get('content-type'), Date.now() - t0 + 'ms', await r.text());
}
