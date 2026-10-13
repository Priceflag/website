import re,sys,html
files=open('qa/M1/verify-tmp2/deploylist.txt').read().split('\n--- ')[0].split()
pats=["revert","automatic","on its own","by itself","auto-","ai pric",r"\bAI\b","machine learning","visitor","traffic","split","simulat","thousands","odds","guarantee","testimonial","trusted by",r"\d+(\.\d+)?\s?%","rollback","roll back","restore","pulled","undo","instantly","yc","y combinator","logo","pilot"]
for f in files:
    if not re.search(r'\.(html|css|js|xml|txt|json)$',f): continue
    s=open(f,encoding='utf8').read()
    for p in pats:
        for m in re.finditer(p,s,re.I):
            ctx=s[max(0,m.start()-90):m.end()+60].replace('\n',' ')
            ln=s.count('\n',0,m.start())+1
            print(f"{f}:{ln} [{p}] ...{ctx}...")
