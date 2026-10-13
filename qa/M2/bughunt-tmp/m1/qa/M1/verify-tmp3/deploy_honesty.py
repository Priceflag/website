# Deployed set per .vercelignore (gitignore-ish semantics), references, honesty scan.
import os, re, fnmatch, sys, html as H
ROOT = sys.argv[1]
pats = [l.strip() for l in open(os.path.join(ROOT,'.vercelignore')) if l.strip() and not l.startswith('#')]
def ignored(rel):
    parts = rel.split('/')
    if any(p.startswith('.') for p in parts): return True  # dotfiles not served (vercel serves? treat as excluded)
    for p in pats:
        if p.endswith('/'):
            d = p[:-1]
            if rel == d or rel.startswith(d + '/') or ('/' not in d and d in parts[:-1]): return True
        elif '/' in p:
            if fnmatch.fnmatch(rel, p): return True
        else:
            if any(fnmatch.fnmatch(x, p) for x in parts): return True
    return False
dep = []
for dp, dns, fns in os.walk(ROOT):
    dns[:] = [d for d in dns if d != '.git']
    for f in fns:
        rel = os.path.relpath(os.path.join(dp,f), ROOT)
        if not ignored(rel): dep.append(rel)
dep.sort()
print('DEPLOYED (%d):' % len(dep)); [print('  ', d, os.path.getsize(os.path.join(ROOT,d))) for d in dep]
# references
textext = ('.html','.css','.js','.xml','.txt','.json','.svg')
missing = []
for d in dep:
    if not d.endswith(('.html','.css','.js')): continue
    s = open(os.path.join(ROOT,d), encoding='utf-8', errors='replace').read()
    refs = set(re.findall(r'(?:href|src|srcset|imagesrcset|content)=["\']([^"\']+)["\']', s)) | set(re.findall(r'url\(["\']?([^"\')]+)', s))
    for r in refs:
        for piece in r.split(','):
            u = piece.strip().split(' ')[0]
            if not u or u.startswith(('http','mailto:','data:','#','tel:','//','javascript')): 
                if u.startswith('https://priceflag.org/'): u = u[len('https://priceflag.org/'):]
                else: continue
            u = u.split('#')[0].split('?')[0].lstrip('/')
            if u in ('', ) : continue
            if not re.search(r'\.[a-z0-9]{2,5}$', u):
                cand = u + '.html'
                if cand in dep or u in ('about','contact','legal'): continue
                # meta content false positives
                if ' ' in piece.strip() and not re.search(r'\.\w+$',u): continue
            if u not in dep and not re.search(r'^[A-Za-z ]', piece) or (u not in dep and '/' in u or (u not in dep and '.' in u)):
                if u not in dep: missing.append((d, piece.strip()[:90]))
print('\nREFERENCES NOT IN DEPLOYED SET:')
for m in sorted(set(missing)): print('  ', m)
# honesty
print('\nHONESTY SCAN:')
terms = [r'revert', r'on its own', r'automatic', r'\bauto\b', r'auto-', r'\bAI\b', r'black.?box', r'simulat', r'\d+(\.\d+)?\s?%', r'visitor', r'traffic', r'testimonial', r'\bYC\b', r'Y Combinator', r'pricing\b', r'\$\d', r'guarantee', r'93|4\.7|82%|7%', r'rolls? back|rollback']
for d in dep:
    if not d.endswith(textext): continue
    lines = open(os.path.join(ROOT,d), encoding='utf-8', errors='replace').read().split('\n')
    for i,l in enumerate(lines,1):
        if len(l) > 2000 and d.endswith('.svg'): continue
        for t in terms:
            for m in re.finditer(t, l, re.I):
                ctx = re.sub(r'\s+',' ', l[max(0,m.start()-70):m.end()+70])
                print(f'  {d}:{i} [{t}] …{ctx}…')
                break
