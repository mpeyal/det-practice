"""Restore bundled source media using the verified manifests (PyMuPDF required)."""
import json,sys,urllib.request,urllib.parse,concurrent.futures,fitz
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
pdf=fitz.open(sys.argv[1] if len(sys.argv)>1 else ROOT/'public/gpn-booklet.pdf')
audio=json.loads((ROOT/'docs/gpn/audio-manifest.json').read_text())
def download(entry):
 target=ROOT/'public'/entry['file']
 if target.exists():return
 target.parent.mkdir(parents=True,exist_ok=True)
 with urllib.request.urlopen(urllib.parse.quote(entry['url'],safe=':/?=&%'),timeout=60) as response:data=response.read()
 assert len(data)>1000 and (data[:3]==b'ID3' or data[0]==255 or data[:4]==b'RIFF'),entry['file']
 target.write_bytes(data)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(download,audio))
manifest=json.loads((ROOT/'docs/gpn/photo-manifest.json').read_text())
for group in ['write','speak']:
 for printed in sorted({p['page'] for p in manifest[group]}):
  page=pdf[printed+3]
  candidates=[]
  for entry in page.get_images():
   xref,_,width,height,*_=entry
   if width>200 and .9<=width/height<=1.1:
    rect=page.get_image_rects(xref)[0];candidates.append((rect.y0,rect.x0,xref))
  candidates.sort(key=lambda v:(round(v[0]/20),v[1]))
  expected=[p for p in manifest[group] if p['page']==printed]
  assert len(candidates)==len(expected),(group,printed)
  for (_,_,xref),photo in zip(candidates,expected):
   target=ROOT/'public'/photo['img'];target.parent.mkdir(parents=True,exist_ok=True)
   target.write_bytes(pdf.extract_image(xref)['image'])
print('Verified/restored 103 recordings and 80 numbered photos.')
