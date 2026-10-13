import sys
from PIL import Image
a,b,out=sys.argv[1:4]
A=Image.open(a).convert('RGB');B=Image.open(b).convert('RGB')
h=max(A.height,B.height)
C=Image.new('RGB',(A.width+B.width+20,h),(255,0,0))
C.paste(A,(0,0));C.paste(B,(A.width+20,0))
maxw=1800
if C.width>maxw: C=C.resize((maxw,int(C.height*maxw/C.width)))
C.save(out,quality=80)
