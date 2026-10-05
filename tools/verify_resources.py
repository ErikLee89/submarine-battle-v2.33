"""Check embedded sections and decoded assets against the supplied PE file."""
from pathlib import Path
import sys,json,hashlib,base64,struct
from io import BytesIO
import pefile
from PIL import Image
root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1] if len(sys.argv)>1 else r'D:\test\ship_V2.33.exe')
p=pefile.PE(str(source));digest=hashlib.sha256(source.read_bytes()).hexdigest()
assert digest=='75c0ece3e40e85ca6dfd363ceecdf9cd5fd5ef48325c20e7cddb52ec082abbaf'
m=json.loads((root/'machine.js').read_text(encoding='utf8').split('=',1)[1].rstrip(';\n'))
for address,data in m['sections']:
 section=next(s for s in p.sections if p.OPTIONAL_HEADER.ImageBase+s.VirtualAddress==address)
 assert base64.b64decode(data)==section.get_data()
images=sounds=0
for t in p.DIRECTORY_ENTRY_RESOURCE.entries:
 typ=str(t.name or t.id)
 for n in t.directory.entries:
  ident=str(n.name or n.id);d=n.directory.entries[0].data.struct;data=p.get_data(d.OffsetToData,d.Size)
  assert data==(root/'assets/raw'/f'{typ}_{ident}.bin').read_bytes()
  if typ=='2':
   size=struct.unpack_from('<I',data)[0];bits=struct.unpack_from('<H',data,14)[0];colors=struct.unpack_from('<I',data,32)[0]
   off=14+size+(colors or (1<<bits if bits<=8 else 0))*4
   native=Image.open(BytesIO(b'BM'+struct.pack('<IHHI',len(data)+14,0,0,off)+data)).convert('RGBA')
   exported=Image.open(root/'assets/images'/f'{ident}.png').convert('RGBA')
   assert native.size==exported.size and native.tobytes()==exported.tobytes();images+=1
  if typ=='WAVE':assert data==(root/'assets/audio'/f'{ident}.wav').read_bytes();sounds+=1
report={'source_sha256':digest,'images_pixel_exact':images,'sounds_byte_exact':sounds,'machine_sections_byte_exact':len(m['sections']),'result':'pass'}
(root/'docs/resource-verification.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(report)
