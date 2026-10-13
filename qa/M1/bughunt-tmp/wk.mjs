import { webkit, chromium } from 'playwright';
for (const bt of [webkit, chromium]) {
const b = await bt.launch();
for (const p of ['/legal','/contact','/about']) {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:8931' + p); await page.waitForTimeout(1800);
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  const a1 = await page.evaluate(() => document.activeElement.tagName + '#' + document.activeElement.id);
  await page.keyboard.press('PageDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space'); await page.waitForTimeout(500);
  console.log(bt.name(), p, a1, await page.evaluate(() => document.querySelector('main').scrollTop));
  await page.close();
}
// index: Enter on summary toggles; Escape?; details keyboard
const page = await b.newPage(); await page.goto('http://localhost:8931/');
await page.focus('summary'); await page.keyboard.press('Enter'); await page.waitForTimeout(100);
console.log(bt.name(), 'summary open via Enter', await page.evaluate(() => document.querySelector('details').open));
await page.keyboard.press('Space'); await page.waitForTimeout(100);
console.log(bt.name(), 'closed via Space', !(await page.evaluate(() => document.querySelector('details').open)));
// find-in-page/hash to FAQ answer? check summary role
await b.close();
}
