import { firefox } from 'playwright';
try { const b = await firefox.launch(); console.log('LAUNCHED', b.version()); await b.close(); }
catch (e) { console.log('FAILED:', e.message.split('\n').filter(l => /Failed|profile|err/i.test(l)).join(' | ')); }
