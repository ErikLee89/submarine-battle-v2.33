"""Replay browser service calls while Unicorn executes the original x86 bytes.
This verifies CPU semantics and control flow; service replacements are shared.
"""
import sys,base64,struct,json
from pathlib import Path
import pefile
from unicorn import Uc,UC_ARCH_X86,UC_MODE_32,UC_HOOK_CODE
from unicorn.x86_const import *
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
REGS=[UC_X86_REG_EAX,UC_X86_REG_ECX,UC_X86_REG_EDX,UC_X86_REG_EBX,UC_X86_REG_ESP,UC_X86_REG_EBP,UC_X86_REG_ESI,UC_X86_REG_EDI]
MASK=0x8c5
CAPTURE=r'''(()=>{
 stopped=true;const c=ship.cpu;
 function b64(b){let out='';for(let i=0;i<b.length;i+=8192)out+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(out);}
 function flags(){const f=c.flags;return 2|f.c|(f.p<<2)|(f.z<<6)|(f.s<<7)|(f.o<<11);}
 const ranges=[[0x400000,0x3c000],[0x500000,0x14000],[0x600000,c.heap-0x600000],[0xe00000,0x100000]];
 const before={regs:Array.from(c.r),flags:flags(),memory:ranges.map(([a,n])=>[a,b64(c.memory.slice(a,a+n))])},events=[];
 let active=null;const write=c.write.bind(c),set=c.memory.set.bind(c.memory),fill=c.memory.fill.bind(c.memory),copy=c.memory.copyWithin.bind(c.memory);
 const record=(a,n)=>{if(active&&n)active.writes.push([a,b64(c.memory.slice(a,a+n))]);};
 c.write=(a,v,n=4)=>{write(a,v,n);record(a,n)};
 c.memory.set=(a,o=0)=>{set(a,o);record(o,a.length)};
 c.memory.fill=(v,a=0,e=c.memory.length)=>{fill(v,a,e);record(a,e-a);return c.memory};
 c.memory.copyWithin=(a,b,e=c.memory.length)=>{copy(a,b,e);record(a,e-b);return c.memory};
 for(const [pc,fn] of Array.from(c.hooks))c.hooks.set(pc,cpu=>{
  active={pc,regs:Array.from(c.r),flags:flags(),writes:[]};const event=active;fn(cpu);
  event.after={regs:Array.from(c.r),pc:c.pc,flags:flags()};events.push(event);active=null;
 });
 ship.clock+=c.read(ship.game+0x308);c.run(0x4046c7,ship.game);const after={regs:Array.from(c.r),flags:flags(),memory:ranges.slice(0,3).map(([a,n])=>[a,b64(c.memory.slice(a,a+n))])};
 return {before,events,after};
})()'''

def verify(trace):
 u=Uc(UC_ARCH_X86,UC_MODE_32);u.mem_map(0,0x1000000)
 for a,b in trace['before']['memory']:u.mem_write(a,base64.b64decode(b))
 for reg,v in zip(REGS,trace['before']['regs']):u.reg_write(reg,v)
 u.reg_write(UC_X86_REG_EFLAGS,trace['before']['flags'])
 u.reg_write(UC_X86_REG_FPCW,0x37f)
 esp=u.reg_read(UC_X86_REG_ESP)-4
 u.mem_write(esp,struct.pack('<I',0))
 u.reg_write(UC_X86_REG_ESP,esp);u.reg_write(UC_X86_REG_ECX,0x500000)
 index=0;addresses={e['pc'] for e in trace['events']}
 def hook(uc,address,size,_):
  nonlocal index
  if address==0:u.emu_stop();return
  if address not in addresses:return
  if index>=len(trace['events']):raise AssertionError('Unexpected extra service')
  e=trace['events'][index];index+=1
  assert address==e['pc'],f"Service path diverged {address:x} != {e['pc']:x}"
  actual=[u.reg_read(r) for r in REGS]
  assert actual==e['regs'],f"Registers diverged at {address:x}: {actual} != {e['regs']}"
  # Some x86 status bits are undefined after IMUL/shift. Preserve the native
  # flags across service returns; subsequent real branches verify their use.
  for a,b in e['writes']:u.mem_write(a,base64.b64decode(b))
  for reg,v in zip(REGS,e['after']['regs']):u.reg_write(reg,v)
  if e['after']['flags']!=e['flags']:u.reg_write(UC_X86_REG_EFLAGS,e['after']['flags'])
  u.reg_write(UC_X86_REG_EIP,e['after']['pc'])
 u.hook_add(UC_HOOK_CODE,hook)
 u.emu_start(0x4046c7,0,count=3000000)
 assert index==len(trace['events']),(index,len(trace['events']))
 assert [u.reg_read(r) for r in REGS]==trace['after']['regs']
 for a,b in trace['after']['memory']:
  expected=base64.b64decode(b);actual=bytes(u.mem_read(a,len(expected)))
  if actual!=expected:
   offset=next(i for i,(x,y) in enumerate(zip(actual,expected)) if x!=y)
   raise AssertionError(f'Memory differs at {a+offset:x}: {actual[offset]:x} != {expected[offset]:x}')
 return index

with sync_playwright() as p:
 b=p.chromium.launch(channel='msedge',headless=True);page=b.new_page();page.goto((root/'index.html').as_uri());page.wait_for_function('window.gameReady');page.evaluate('stopped=true')
 results=[]
 for stage in [1,3,5,10,11,16,21]:
  page.evaluate('level=>{ship.startLevel(level);ship.cpu.seed=123456}',stage)
  page.evaluate('for(let i=0;i<210;i++){if(i%15===0)ship.keyDown(32);ship.frame()}')
  trace=page.evaluate(CAPTURE)
  try:
   hooks=verify(trace);results.append({'level':stage,'services':hooks,'state':page.evaluate('ship.state()'),'result':'pass'});print('PASS',stage,hooks,flush=True)
  except Exception:
   (root/'docs/failed-trace.json').write_text(json.dumps(trace),encoding='utf8');raise
 b.close()
 (root/'docs/machine-verification.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
