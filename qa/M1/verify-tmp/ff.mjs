import { firefox } from 'playwright';
const tries = [
  ['launch default', () => firefox.launch()],
  ['persistent ctx in repo tmp', () => firefox.launchPersistentContext(process.cwd()+'/qa/M1/verify-tmp/ffprofile', {})],
];
for (const [n,f] of tries) { try { const b = await f(); console.log(n,'OK'); await b.close(); } catch(e){ console.log(n,'FAIL', String(e.message).split('\n').slice(-3).join(' | ')); } }
