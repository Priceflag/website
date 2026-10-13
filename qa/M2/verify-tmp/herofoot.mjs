import { chromium } from 'playwright';
const b = await chromium.launch();
for (const [w,h] of [[1440,900],[1920,1080],[768,1024],[844,390]]) {
const pg = await b.newPage({ viewport: { width: w, height: h } });
await pg.goto('http://localhost:8932/', { waitUntil: 'networkidle' }); await pg.waitForTimeout(500);
const r = await pg.evaluate(() => { const e = document.querySelector('.pf-hero-foot'); const rg = document.createRange(); rg.selectNodeContents(e); const b = rg.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, el: e.getBoundingClientRect().width }; });
await pg.evaluate(() => { const e = document.querySelector('.pf-hero-foot'); e.style.setProperty('color','transparent','important'); e.style.textShadow='none'; });
const buf = await pg.screenshot({ clip: r });
const px = await pg.evaluate(async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0,0,c.width,c.height).data; let mx=0, out=[]; for (let i=0;i<d.length;i+=4){ const L=0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2]; out.push(L);} out.sort((a,b)=>a-b); return [out[0], out[Math.floor(out.length/2)], out[out.length-1]]; }, buf.toString('base64'));
console.log(w+'x'+h, JSON.stringify(r), 'bg luma min/med/max', px.map(v=>v.toFixed(0)).join('/'));
await pg.close(); }
await b.close();
