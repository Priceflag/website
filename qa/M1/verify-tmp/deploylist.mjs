import fs from 'fs'; import path from 'path';
import { minimatch } from 'minimatch';
const root = process.cwd();
const pats = fs.readFileSync('.vercelignore','utf8').split('\n').map(s=>s.trim()).filter(s=>s && !s.startsWith('#'));
const defaults = ['.git/','node_modules/','.vercel/','.DS_Store','.env*'];
function ignored(rel, isDir){
  for (const p0 of [...pats, ...defaults]) {
    let p = p0; const dirOnly = p.endsWith('/'); if (dirOnly) p = p.slice(0,-1);
    const anchored = p.startsWith('/') || p.includes('/'); if (p.startsWith('/')) p = p.slice(1);
    const segs = rel.split('/');
    // match rel or any ancestor
    for (let i=1;i<=segs.length;i++){
      const sub = segs.slice(0,i).join('/'); const subIsDir = i<segs.length || isDir;
      if (dirOnly && !subIsDir) continue;
      if (anchored ? minimatch(sub,p,{dot:true}) : minimatch(segs[i-1],p,{dot:true})) return true;
    }
  }
  return false;
}
const out=[];
(function walk(d){ for (const e of fs.readdirSync(d,{withFileTypes:true})){ const rel=path.relative(root,path.join(d,e.name)); if (ignored(rel,e.isDirectory())) continue; if(e.isDirectory()) walk(path.join(d,e.name)); else out.push(rel);} })(root);
console.log(out.join('\n'));
// reference check
const deployed=new Set(out);
const textFiles=out.filter(f=>/\.(html|css|js|xml|txt|json)$/.test(f));
const refs=new Map();
for (const f of textFiles){ const s=fs.readFileSync(f,'utf8');
  const re=/(?:href|src|content|srcset|imagesrcset)\s*=\s*"([^"]+)"|url\(\s*['"]?([^'")]+)['"]?\s*\)|"(https:\/\/priceflag\.org\/[^"]*)"/g; let m;
  while((m=re.exec(s))){ const v=(m[1]||m[2]||m[3]); for (const part of v.split(',')){ let u=part.trim().split(/\s+/)[0]; if(!u) continue;
    if (/^(mailto:|tel:|data:|#|javascript:)/.test(u)) continue;
    if (/^https?:\/\//.test(u)){ if(!/^https:\/\/(www\.)?priceflag\.org\//.test(u)) continue; u=u.replace(/^https:\/\/(www\.)?priceflag\.org/,''); }
    else if (!/^[\/.a-zA-Z0-9]/.test(u) || u.includes(' ') ) continue;
    if (/^[a-z]+:/.test(u)) continue;
    u=u.split('#')[0].split('?')[0]; if(!u) continue;
    let p = u.startsWith('/') ? u.slice(1) : path.normalize(path.join(path.dirname(f),u));
    if (p==='' ) p='index.html';
    if (!refs.has(p)) refs.set(p,new Set()); refs.get(p).add(f);
  }}}
console.log('\n--- references not deployed ---');
const rewrites={about:'about.html',legal:'legal.html',contact:'contact.html'};
for (const [p,fs_] of refs){ const q=rewrites[p]||p; if(!deployed.has(q) && !/^(width=|text\/|summary|website|Priceflag|#)/.test(p) && /\.|^[a-z]+$/.test(p)) console.log(p,'<-',[...fs_].join(','), fs.existsSync(q)?'(exists but IGNORED)':'(MISSING on disk)'); }
