/* x86 execution for Ship V2.33. Instructions are decoded from the original
 * file by tools/export.py; gameplay functions retain their original PCs. */
'use strict';
class ShipCPU {
 constructor(machine){
  this.memory=new Uint8Array(0x1000000);this.view=new DataView(this.memory.buffer);
  for(const [address,b64] of machine.sections){const b=atob(b64);for(let i=0;i<b.length;i++)this.memory[address+i]=b.charCodeAt(i);}
  this.code=new Map(machine.code.map(i=>[i[0],i]));this.hooks=new Map();this.r=new Uint32Array(8);
  this.r[4]=0xf00000;this.pc=0;this.suspended=false;this.flags={c:0,z:0,s:0,o:0,p:0};this.heap=0x600000;this.freeBlocks=[];this.blocks=new Map();this.seed=1;this.trace=[];this.fpu=[];this.fpStatus=0;this.fpControl=0x37f;
 }
 read(a,size=4){a>>>=0;if(a+size>this.memory.length)throw Error('Memory read '+a.toString(16));return size===1?this.view.getUint8(a):size===2?this.view.getUint16(a,true):this.view.getUint32(a,true);}
 write(a,v,size=4){a>>>=0;if(a+size>this.memory.length)throw Error('Memory write '+a.toString(16));if(size===1)this.view.setUint8(a,v);else if(size===2)this.view.setUint16(a,v,true);else this.view.setUint32(a,v,true);}
 alloc(n){n=(n+15)&~15;let ix=this.freeBlocks.findIndex(b=>b[1]>=n),a;if(ix>=0){[a,n]=this.freeBlocks.splice(ix,1)[0];}else{a=this.heap;this.heap+=n;if(this.heap>=0xd00000)throw Error('Heap full');}this.blocks.set(a,n);this.memory.fill(0,a,a+n);return a;}
 free(a){if(this.blocks.has(a)){this.freeBlocks.push([a,this.blocks.get(a)]);this.blocks.delete(a);}}
 address(o){return ((o[2]<0?0:this.r[o[2]])+(o[3]<0?0:this.r[o[3]]*o[4])+o[5]+(o[6]?0x1000:0))>>>0;}
 get(o){if(o[0]===1)return o[2]>>>0;if(o[0]===2)return this.read(this.address(o),o[1]);return this.r[o[2]]>>>o[3] & (o[1]===1?255:o[1]===2?65535:0xffffffff);}
 set(o,v){if(o[0]===2)this.write(this.address(o),v,o[1]);else{const mask=o[1]===1?255:o[1]===2?65535:0xffffffff;this.r[o[2]]=(this.r[o[2]]&~(mask<<o[3]))|((v&mask)<<o[3]);}}
 signed(v,size=4){return size===1?(v<<24)>>24:size===2?(v<<16)>>16:v|0;}
 push(v){this.r[4]-=4;this.write(this.r[4],v);}
 pop(){const v=this.read(this.r[4]);this.r[4]+=4;return v;}
 arg(i){return this.read(this.r[4]+4+i*4);}
 ret(n=0,v=0){this.r[0]=v;this.pc=this.pop();this.r[4]+=n;}
 flag(v,size,c=0,o=0){const bits=size*8,mask=size===4?0xffffffff:(1<<bits)-1;v&=mask;this.flags={c:+!!c,z:+(v===0),s:(v>>>(bits-1))&1,o:+!!o,p:+(((0x9669 >>> ((v^(v>>>4))&15))&1)!==0)};}
 arithmetic(a,b,size,sub=false,carry=0){const bits=size*8,max=size===4?4294967296:2**bits,mask=max-1;a>>>=0;b>>>=0;a%=max;b%=max;const value=sub?a-b-carry:a+b+carry,result=((value%max)+max)%max;const sign=2**(bits-1);this.flag(result,size,sub?a<b+carry:value>=max,sub?((a^b)&(a^result)&sign):(~(a^b)&(a^result)&sign));return result;}
 cond(c){const f=this.flags;return ({e:f.z,z:f.z,ne:!f.z,nz:!f.z,b:f.c,c:f.c,nae:f.c,ae:!f.c,nb:!f.c,nc:!f.c,be:f.c||f.z,na:f.c||f.z,a:!f.c&&!f.z,nbe:!f.c&&!f.z,l:f.s!==f.o,nge:f.s!==f.o,ge:f.s===f.o,nl:f.s===f.o,le:f.z||f.s!==f.o,ng:f.z||f.s!==f.o,g:!f.z&&f.s===f.o,nle:!f.z&&f.s===f.o,s:f.s,ns:!f.s,o:f.o,no:!f.o,p:f.p,pe:f.p,np:!f.p,po:!f.p})[c];}
 run(address,thisPtr=0,args=[],limit=3000000){
  if(this.suspended)throw Error('游戏正在等待名字输入');
  this.r[1]=thisPtr;for(let i=args.length-1;i>=0;i--)this.push(args[i]);this.push(0);this.pc=address;return this.resume(limit);
 }
 resume(limit=3000000){
  let count=0;
  while(this.pc&&!this.suspended){if(++count>limit)throw Error('Instruction budget at '+this.pc.toString(16));this.step();}return this.r[0];
 }
 step(){
  const pc=this.pc;if(this.hooks.has(pc)){this.hooks.get(pc)(this);return;}
  const ins=this.code.get(pc);if(!ins)throw Error('Unmapped instruction '+pc.toString(16));
  const [,next,m,ops]=ins;this.pc=next;const a=ops[0],b=ops[1];let x,y,v;
  if(m==='mov'){this.set(a,this.get(b));return;}if(m==='lea'){this.set(a,this.address(b));return;}
  if(m==='push'){this.push(this.get(a));return;}if(m==='pop'){this.set(a,this.pop());return;}
  if(m==='call'){const target=this.get(a);if(!target)throw Error('Null call at '+pc.toString(16));this.push(next);this.pc=target;return;}if(m==='jmp'){this.pc=this.get(a);return;}
  if(m==='ret'){this.pc=this.pop();if(a)this.r[4]+=this.get(a);return;}
  if(m==='leave'){this.r[4]=this.r[5];this.r[5]=this.pop();return;}
  if(m==='movzx'||m==='movsx'){this.set(a,m==='movsx'?this.signed(this.get(b),b[1]):this.get(b));return;}
  if(m==='jecxz'){if(!this.r[1])this.pc=this.get(a);return;}
  if(m.startsWith('j')){const condition=this.cond(m.slice(1));if(condition===undefined)throw Error('Branch '+m);if(condition)this.pc=this.get(a);return;}
  if(m.startsWith('set')){const condition=this.cond(m.slice(3));if(condition===undefined)throw Error('Condition '+m);this.set(a,+!!condition);return;}
  if(['add','sub','cmp','adc','sbb'].includes(m)){x=this.get(a);y=this.get(b);const carry=(m==='adc'||m==='sbb')?this.flags.c:0;v=this.arithmetic(x,y,a[1],['sub','cmp','sbb'].includes(m),carry);if(m!=='cmp')this.set(a,v);return;}
  if(['and','or','xor','test'].includes(m)){x=this.get(a);y=this.get(b);v=m==='or'?x|y:m==='xor'?x^y:x&y;this.flag(v,a[1]);if(m!=='test')this.set(a,v);return;}
  if(m==='inc'||m==='dec'){const c=this.flags.c;v=this.arithmetic(this.get(a),1,a[1],m==='dec');this.flags.c=c;this.set(a,v);return;}
  if(m==='neg'){this.set(a,this.arithmetic(0,this.get(a),a[1],true));return;}
  if(m==='not'){this.set(a,~this.get(a));return;}
  if(['shl','sal','shr','sar'].includes(m)){x=this.get(a);y=this.get(b)&31;if(!y)return;const bits=a[1]*8;v=m==='sar'?this.signed(x,a[1])>>y:m==='shr'?x>>>y:x<<y;const c=m==='shl'||m==='sal'?(x>>>(bits-y))&1:(x>>>(y-1))&1;const o=y===1?(m==='shr'?x>>>(bits-1):m==='sar'?0:((v>>>(bits-1))&1)^c):this.flags.o;this.flag(v,a[1],c,o);this.set(a,v);return;}
  if(m==='imul'&&ops.length>1){x=this.signed(this.get(ops.length===3?b:a));y=this.signed(this.get(ops.length===3?ops[2]:b));v=Math.imul(x,y);const overflow=x*y!==v;this.set(a,v);this.flags.c=this.flags.o=+overflow;return;}
  if(m==='mul'||m==='imul'){const product=BigInt(m==='imul'?this.r[0]|0:this.r[0])*BigInt(m==='imul'?this.signed(this.get(a)):this.get(a)>>>0);this.r[0]=Number(BigInt.asUintN(32,product));this.r[2]=Number(BigInt.asUintN(32,product>>32n));this.flags.c=this.flags.o=+(m==='mul'?this.r[2]!==0:product!==BigInt(this.r[0]|0));return;}
  if(m==='div'||m==='idiv'){let n=(BigInt(this.r[2])<<32n)|BigInt(this.r[0]),d=BigInt(this.get(a)>>>0);if(m==='idiv'){n=BigInt.asIntN(64,n);d=BigInt(this.signed(this.get(a)));}if(d===0n)throw Error('Divide by zero');const q=n/d,rem=n%d;this.r[0]=Number(BigInt.asUintN(32,q));this.r[2]=Number(BigInt.asUintN(32,rem));return;}
  if(m==='cdq'){this.r[2]=(this.r[0]|0)<0?0xffffffff:0;return;}
  if(m==='cwde'){this.r[0]=(this.r[0]<<16)>>16;return;}
  if(m==='xchg'){x=this.get(a);this.set(a,this.get(b));this.set(b,x);return;}
  if(m==='nop'||m==='cld'||m==='wait'||m==='fwait')return;
  if(m==='sahf'){const f=this.r[0]>>>8;this.flags.c=f&1;this.flags.p=(f>>>2)&1;this.flags.z=(f>>>6)&1;this.flags.s=(f>>>7)&1;return;}
  if(m.startsWith('f')){this.float(m,ops);return;}
  if(m==='repe cmpsb'||m==='repne scasb'){while(this.r[1]){const scan=m.includes('scas');this.arithmetic(scan?this.r[0]&255:this.read(this.r[6],1),this.read(this.r[7],1),1,true);if(!scan)this.r[6]++;this.r[7]++;this.r[1]--;if(scan?this.flags.z:!this.flags.z)break;}return;}
  if(m==='movsd'||m==='movsb'||m==='stosd'||m==='stosb'){const size=m.endsWith('d')?4:1;this.write(this.r[7],m.startsWith('mov')?this.read(this.r[6],size):this.r[0],size);this.r[7]+=size;if(m.startsWith('mov'))this.r[6]+=size;return;}
  if(m==='rep movsd'||m==='rep movsb'||m==='rep stosd'||m==='rep stosb'){const size=m.endsWith('d')?4:1;while(this.r[1]){this.write(this.r[7],m.includes('movs')?this.read(this.r[6],size):this.r[0],size);this.r[7]+=size;if(m.includes('movs'))this.r[6]+=size;this.r[1]--;}return;}
  throw Error('Unsupported '+m+' at '+pc.toString(16));
 }
 float(m,ops){
  const [a,b]=ops,s=this.fpu;
  const value=o=>o[0]===3?s[o[2]]:o[0]===2?(o[1]===8?this.view.getFloat64(this.address(o),true):this.view.getFloat32(this.address(o),true)):this.get(o);
  const write=(o,v)=>{if(o[0]===3)s[o[2]]=v;else if(o[1]===8)this.view.setFloat64(this.address(o),v,true);else this.view.setFloat32(this.address(o),v,true);};
  if(m==='fld'){s.unshift(value(a));return;}
  if(m==='fild'){s.unshift(a[1]===8?Number(this.view.getBigInt64(this.address(a),true)):this.signed(this.get(a),a[1]));return;}
  if(m==='fld1'||m==='fldz'){s.unshift(m==='fld1'?1:0);return;}
  if(m==='fst'||m==='fstp'){write(a,s[0]);if(m==='fstp')s.shift();return;}
  if(m==='fxch'){const i=a?a[2]:1;[s[0],s[i]]=[s[i],s[0]];return;}
  if(m==='fchs'){s[0]=-s[0];return;}if(m==='fabs'){s[0]=Math.abs(s[0]);return;}
  if(m==='fnstsw'){this.set(a,this.fpStatus);return;}
  if(m==='fnstcw'){this.set(a,this.fpControl);return;}if(m==='fldcw'){this.fpControl=this.get(a);return;}
  if(m==='fistp'||m==='fist'){const x=s[0],mode=(this.fpControl>>>10)&3,floor=Math.floor(x),v=mode===3?Math.trunc(x):mode===1?floor:mode===2?Math.ceil(x):x-floor===.5?(floor%2?floor+1:floor):Math.round(x);if(a[1]===8)this.view.setBigInt64(this.address(a),BigInt(v),true);else this.set(a,v);if(m==='fistp')s.shift();return;}
  if(m==='fcomp'||m==='fcom'||m==='fcompp'){const v=a?value(a):s[1],x=s[0];this.fpStatus=Number.isNaN(x)||Number.isNaN(v)?0x4500:x<v?0x100:x===v?0x4000:0;if(m!=='fcom')s.shift();if(m==='fcompp')s.shift();return;}
  if(/^(fadd|fsub|fsubr|fmul|fdiv|fdivr)p?$/.test(m)){
   const pop=m.endsWith('p'),index=pop?(a?.[2]??1):b?(a[2]):0,x=s[index],y=pop?s[0]:b?value(b):value(a);
   s[index]=m.startsWith('fadd')?x+y:m.startsWith('fsubr')?y-x:m.startsWith('fsub')?x-y:m.startsWith('fmul')?x*y:m.startsWith('fdivr')?y/x:x/y;
   if(pop)s.shift();return;
  }
  throw Error('Unsupported FPU '+m+' at '+this.pc.toString(16));
 }
}
window.ShipCPU=ShipCPU;
