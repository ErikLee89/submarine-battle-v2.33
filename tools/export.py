import sys,json,struct,base64,hashlib
from pathlib import Path
import pefile
from PIL import Image
from io import BytesIO
from capstone import *
from capstone.x86 import *
root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1] if len(sys.argv)>1 else r'D:\test\ship_V2.33.exe')
p=pefile.PE(str(source));base=p.OPTIONAL_HEADER.ImageBase
for folder in ['assets/images','assets/audio','assets/raw','docs']:(root/folder).mkdir(parents=True,exist_ok=True)
rows=[];image_ids=[];audio={};resources={}
for t in p.DIRECTORY_ENTRY_RESOURCE.entries:
 typ=str(t.name or t.id)
 for n in t.directory.entries:
  for lang in n.directory.entries:
   r=lang.data.struct;b=p.get_data(r.OffsetToData,r.Size);ident=str(n.name or n.id);resources[typ,ident]=b
   (root/'assets/raw'/f'{typ}_{ident}.bin').write_bytes(b)
   row={'type':typ,'id':ident,'sha256':hashlib.sha256(b).hexdigest(),'size':len(b)}
   if typ=='2':
    size=struct.unpack_from('<I',b)[0];bits=struct.unpack_from('<H',b,14)[0];colors=struct.unpack_from('<I',b,32)[0]
    off=14+size+(colors or (1<<bits if bits<=8 else 0))*4
    bmp=b'BM'+struct.pack('<IHHI',len(b)+14,0,0,off)+b
    image=Image.open(BytesIO(bmp));image.save(root/'assets/images'/f'{ident}.png');row['dimensions']=image.size;image_ids.append(ident)
   if typ=='WAVE':
    (root/'assets/audio'/f'{ident}.wav').write_bytes(b);audio[ident]=base64.b64encode(b).decode()
   rows.append(row)
group=resources['14','128'];icon=resources['3',str(struct.unpack_from('<H',group,18)[0])]
(root/'favicon.ico').write_bytes(group[:6]+group[6:18]+struct.pack('<I',22)+icon)
(root/'audio-data.js').write_text('window.SHIP_AUDIO='+json.dumps(audio,separators=(',',':'))+';\n',encoding='utf8')
(root/'resources.js').write_text('window.SHIP_RESOURCES='+json.dumps({'images':image_ids,'data':{id:'data:image/png;base64,'+base64.b64encode((root/'assets/images'/f'{id}.png').read_bytes()).decode() for id in image_ids}},separators=(',',':'))+';\n',encoding='utf8')
(root/'docs/resources.json').write_text(json.dumps(rows,indent=2),encoding='utf8')
# Decode reachable instruction starts independently, including targets after jump tables.
cs=Cs(CS_ARCH_X86,CS_MODE_32);cs.detail=True;cs.skipdata=True
text=next(s for s in p.sections if s.Name.startswith(b'.text'));lo=base+text.VirtualAddress;raw=text.get_data();hi=lo+text.Misc_VirtualSize
decoded={};todo=[base+p.OPTIONAL_HEADER.AddressOfEntryPoint,0x4024c8,0x40368c,0x4046c7]
for ins in cs.disasm(raw[:text.Misc_VirtualSize],lo):
 if ins.id:
  decoded[ins.address]=ins
  if ins.mnemonic.startswith(('call','j')):
   todo.extend(o.imm for o in ins.operands if o.type==X86_OP_IMM and lo<=o.imm<hi)
for s in p.sections:
 for at in range(0,len(s.get_data())-3,4):
  value=struct.unpack_from('<I',s.get_data(),at)[0]
  if lo<=value<hi:todo.append(value)
seen=set()
while todo:
 at=todo.pop()
 while lo<=at<hi and at not in seen:
  seen.add(at);ins=next(cs.disasm(raw[at-lo:at-lo+15],at,count=1),None)
  if not ins or not ins.id:break
  decoded[at]=ins
  if ins.mnemonic.startswith(('call','j')):
   todo.extend(o.imm for o in ins.operands if o.type==X86_OP_IMM and lo<=o.imm<hi)
  if ins.mnemonic in ['ret','jmp','int3']:break
  at+=ins.size
names=['eax','ecx','edx','ebx','esp','ebp','esi','edi'];regmap={n:(i,0) for i,n in enumerate(names)}
for i,n in enumerate(['ax','cx','dx','bx','sp','bp','si','di']):regmap[n]=(i,0)
for i,n in enumerate(['al','cl','dl','bl']):regmap[n]=(i,0)
for i,n in enumerate(['ah','ch','dh','bh']):regmap[n]=(i,8)
def reg(r):return regmap.get(cs.reg_name(r),(-1,0))
code=[]
for address,ins in sorted(decoded.items()):
 ops=[]
 for o in ins.operands:
  if o.type==X86_OP_REG:
   name=cs.reg_name(o.reg)
   ops.append([3,o.size,int(name[3:-1])] if name.startswith('st(') else [0,o.size,*reg(o.reg)])
  elif o.type==X86_OP_IMM:ops.append([1,o.size,o.imm])
  elif o.type==X86_OP_MEM:ops.append([2,o.size,reg(o.mem.base)[0],reg(o.mem.index)[0],o.mem.scale,o.mem.disp,cs.reg_name(o.mem.segment)=='fs'])
 code.append([ins.address,ins.address+ins.size,ins.mnemonic,ops])
imports=[[i.address,(i.name.decode() if i.name else f'ORD_{i.ordinal}'),m.dll.decode()] for m in p.DIRECTORY_ENTRY_IMPORT for i in m.imports]
sections=[[base+s.VirtualAddress,base64.b64encode(s.get_data()).decode()] for s in p.sections if not s.Name.startswith(b'.rsrc')]
(root/'machine.js').write_text('window.SHIP_MACHINE='+json.dumps({'code':code,'sections':sections,'imports':imports},separators=(',',':'))+';\n',encoding='utf8')
print('Exported',len(code),'instructions,',len(image_ids),'images,',len(audio),'sounds')
# Native menu/message-map and dialog text evidence.
for (typ,ident),b in resources.items():
 if typ in ['4','5','6']:
  runs=[]
  for offset in [0,1]:
   text=b[offset:len(b)-(len(b)-offset)%2].decode('utf-16le',errors='replace')
   import re
   runs.extend(re.findall(r'[\u4e00-\u9fff\w &()（）,，。.!！:：;；/\-+@%\r\n]{4,}',text))
  (root/'docs'/f'resource-text-{typ}-{ident}.txt').write_text('\n'.join(runs),encoding='utf8')
