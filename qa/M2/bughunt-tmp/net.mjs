import { chromium, webkit } from 'playwright';
for (const bt of [chromium, webkit]) {
const b = await bt.launch(); const p = await b.newPage();
p.on('response', r => { if (r.status() >= 400) console.log(bt.name(), r.status(), r.url()); });
p.on('requestfailed', r => console.log(bt.name(), 'FAILED', r.url(), r.failure()?.errorText));
p.on('console', m => { if (m.type()!=='log') console.log(bt.name(), m.type(), m.text()); });
for (const pg of ['signin.html','about.html','index.html']) await p.goto('http://localhost:8934/'+pg, { waitUntil: 'networkidle' });
await b.close(); }
