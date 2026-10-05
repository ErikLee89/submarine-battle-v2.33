/* Windows/MFC services for the original V2.33 machine functions. */
'use strict';
class ShipBridge {
 constructor(cpu,canvas,images){this.cpu=cpu;this.canvas=canvas;this.images=images;this.game=0x500000;this.objects=new Map();this.nextHandle=100;this.wrappers=new Map();this.masked=new Map();this.decoder=new TextDecoder('gb18030');this.clock=1000;this.stats={frames:0,draws:0};this.audio=null;this.buffers=new Map();this.voices=new Map();this.setup();}
 handle(o){const h=this.nextHandle++;this.objects.set(h,o);return h;}
 surface(w,h){const cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv;}
 dc(h){const o=this.objects.get(h);if(!o)throw Error('Missing GDI handle '+h);return o;}
 context(h){return this.dc(h).ctx;}
 bytes(a){let e=a;while(this.cpu.memory[e]&&e-a<65536)e++;return this.cpu.memory.slice(a,e);}
 str(a){return this.decoder.decode(this.bytes(a));}
 nameBytes(){const out=[];for(const char of this.playerName||'Player'){let bytes;if(char.charCodeAt(0)<128)bytes=[char.charCodeAt(0)];else{if(!this.nameMap){this.nameMap=new Map();for(let a=0x81;a<=0xfe;a++)for(let b=0x40;b<=0xfe;b++){if(b===0x7f)continue;const pair=new Uint8Array([a,b]),text=this.decoder.decode(pair);if(text.length===1&&!this.nameMap.has(text))this.nameMap.set(text,[a,b]);}}bytes=this.nameMap.get(char)||[63];}if(out.length+bytes.length>12)break;out.push(...bytes);}return new Uint8Array(out);}
 string(bytes){const p=this.cpu.alloc(bytes.length+16)+12;this.cpu.write(p-12,1);this.cpu.write(p-8,bytes.length);this.cpu.write(p-4,bytes.length);this.cpu.memory.set(bytes,p);return p;}
 assign(obj,bytes){const c=this.cpu,old=c.read(obj);c.write(obj,this.string(bytes));if(old>=0x60000c)c.free(old-12);return obj;}
 color(v){return `rgb(${v&255},${(v>>>8)&255},${(v>>>16)&255})`;}
 bitmap(id){const im=this.images[String(id)];if(!im)throw Error('Missing bitmap '+id);return this.handle({id:String(id),image:im,width:im.width,height:im.height});}
 wrap(h){if(!this.wrappers.has(h)){const p=this.cpu.alloc(8);this.cpu.write(p+4,h);this.wrappers.set(h,p);}return this.wrappers.get(h);}
 select(h,object){const dc=this.dc(h),o=this.objects.get(object),old=dc.selected||0;dc.selected=object;if(o?.image){if(o.image.getContext){dc.canvas=o.image;dc.ctx=o.image.getContext('2d');}else{const cv=this.surface(o.width,o.height);dc.ctx=cv.getContext('2d');dc.ctx.drawImage(o.image,0,0);dc.canvas=cv;}}if(o?.font)dc.font=o.font;if(o?.pen)dc.pen=o.pen;if(o?.brush)dc.brush=o.brush;return old;}
 hook(pc,n,fn){this.cpu.hooks.set(pc,c=>{const v=fn(c);c.ret(n,v===undefined?1:v);});}
 setup(){
  const c=this.cpu,G=this.game,hook=(pc,n,fn)=>this.hook(pc,n,fn),nop=(pc,n=0,v=1)=>hook(pc,n,()=>v);
  this.screen=this.handle({canvas:this.canvas,ctx:this.canvas.getContext('2d'),textColor:'#000',font:'14px SimSun,serif'});
  this.vtable=c.alloc(256);c.write(this.vtable+4,0x720010);c.write(this.vtable+0x5c,0x720000);c.write(this.vtable+0x30,0x720020);c.write(this.vtable+0x24,0x720030);
  hook(0x720020,4,c=>{this.dc(c.read(c.r[1]+4)).textColor=this.color(c.arg(0));return 0;});hook(0x720030,4,c=>{this.dc(c.read(c.r[1]+4)).font='14px SimSun,serif';return this.wrap(0);});
  hook(0x720000,16,c=>{this.drawText(c.read(c.r[1]+4),c.arg(0)|0,c.arg(1)|0,c.arg(2),c.arg(3));return 1;});nop(0x720010,4);
  c.write(0x510000+4,0x510100);c.write(0x510000+12,1);
  hook(0x427d56,0,()=>0x510000);hook(0x4285be,12,c=>['WindowAni','FullScreenMode'].includes(this.str(c.arg(1)))?0:c.arg(2));
  hook(0x42862a,16,c=>{c.write(c.arg(0),this.string(new Uint8Array()));return c.arg(0);});nop(0x42520c,12);
  hook(0x421c1e,0,c=>c.alloc(c.arg(0)));hook(0x421c47,0,c=>{c.free(c.arg(0));return 0;});hook(0x410963,0,c=>{c.free(c.arg(0));return 0;});
  hook(0x4133c3,0,()=>0x512000);c.write(0x512014,1);Object.defineProperty(c,'seed',{get:()=>c.read(0x512014),set:v=>c.write(0x512014,v)});
  hook(0x410b49,0,()=>Math.floor(Date.now()/1000));
  hook(0x410410,0,c=>{c.memory.fill(c.arg(1)&255,c.arg(0),c.arg(0)+c.arg(2));return c.arg(0);});
  hook(0x421978,4,c=>this.assign(c.r[1],this.bytes(c.arg(0))));hook(0x4216c3,4,c=>this.assign(c.r[1],this.bytes(c.read(c.arg(0)))));
  hook(0x4219f7,4,c=>this.assign(c.r[1],this.bytes(c.read(c.arg(0)))));hook(0x421a47,4,c=>this.assign(c.r[1],this.bytes(c.arg(0))));
  hook(0x42194e,0,c=>{const p=c.read(c.r[1]);if(p>=0x60000c)c.free(p-12);return 0;});
  hook(0x421b20,4,c=>{const a=this.bytes(c.read(c.r[1])),b=this.bytes(c.read(c.arg(0)));return this.assign(c.r[1],new Uint8Array([...a,...b]));});
  hook(0x421b0b,4,c=>this.assign(c.r[1],new Uint8Array([...this.bytes(c.read(c.r[1])),c.arg(0)&255])));
  hook(0x422ff4,4,c=>{this.assign(c.r[1],new TextEncoder().encode('Game (*.mine)|*.mine||'));return 1;});
  hook(0x410d99,0,c=>{c.fpu.unshift(Math.pow(c.view.getFloat64(c.r[4]+4,true),c.view.getFloat64(c.r[4]+12,true)));return 0;});
  hook(0x41be9b,0,()=>1);
  hook(0x41dc7f,8,c=>{c.write(c.r[1]+0x58,c.arg(0));return c.r[1];});nop(0x41e22f);nop(0x41cd92);nop(0x41cd21);nop(0x41e278);nop(0x41ce3c);nop(0x425471);
  hook(0x41dd34,0,c=>{if(c.read(c.r[1]+0x58)===0x8f){this.assign(c.r[1]+0x100,this.nameBytes());return 1;}this.showScores=true;return 2;});
  hook(0x41c542,0,c=>{c.write(c.arg(0),Math.floor(Date.now()/1000));return c.arg(0);});
  hook(0x41c555,4,()=>{const d=new Date(),p=0x513000;[d.getDate(),d.getMonth(),d.getFullYear()-1900].forEach((v,i)=>c.write(p+12+i*4,v));return p;});
  hook(0x41d08a,0,c=>{c.write(c.r[1]+4,c.alloc(4096));c.write(c.r[1]+8,0);return c.r[1];});
  hook(0x41d1e1,8,c=>{c.write(c.read(c.r[1]+4)+c.arg(0),c.arg(1),1);c.write(c.r[1]+8,Math.max(c.read(c.r[1]+8),c.arg(0)+1));return 1;});
  hook(0x41d0bd,0,c=>{c.free(c.read(c.r[1]+4));return 1;});
  hook(0x41c44b,0,c=>{this.assign(c.arg(0),this.format(c));return 0;});
  nop(0x425674);nop(0x426098,16);nop(0x421022,12);nop(0x4210c9,4);nop(0x41e5b7);nop(0x426575,8);nop(0x41f046,4);nop(0x41f05d,4);
  hook(0x41cca5,0,c=>{c.write(c.r[1]+4,0);return c.r[1];});
  hook(0x41cd37,20,c=>{c.write(c.r[1]+4,this.handle({w:c.arg(0),h:c.arg(1),frames:[]}));return 1;});
  hook(0x423b44,0,c=>{c.write(c.r[1],this.vtable);return c.r[1];});
  hook(0x423bfb,4,c=>{c.write(c.r[1]+4,c.arg(0));return 1;});
  hook(0x42415b,4,c=>{c.write(c.r[1],this.vtable);c.write(c.r[1]+4,this.screen);return c.r[1];});nop(0x4241cd);
  hook(0x42434f,4,c=>{c.write(c.r[1]+4,c.arg(0));return 1;});nop(0x4243a6);
  hook(0x423d26,8,c=>this.wrap(this.select(c.arg(0),c.arg(1))));
  hook(0x423d79,4,c=>this.wrap(this.select(c.read(c.r[1]+4),c.arg(0)?c.read(c.arg(0)+4):0)));
  hook(0x423d9c,4,c=>this.wrap(this.select(c.read(c.r[1]+4),c.read(c.arg(0)+4))));
  nop(0x423dee,4);hook(0x423e1c,4,c=>{this.dc(c.read(c.r[1]+4)).textColor=this.color(c.arg(0));return 0;});
  hook(0x4240ea,4,c=>{this.dc(c.read(c.r[1]+4)).align=c.arg(0);return 0;});
  hook(0x4243bc,12,c=>{c.write(c.r[1]+4,this.handle({pen:{color:this.color(c.arg(2)),width:c.arg(1)||1}}));return 1;});
  hook(0x424069,12,c=>{const dc=this.dc(c.read(c.r[1]+4));dc.point=[c.arg(1)|0,c.arg(2)|0];return c.arg(0);});
  hook(0x424099,8,c=>{this.line(c.read(c.r[1]+4),c.arg(0)|0,c.arg(1)|0);return 1;});
  // MFC file services use a browser-local virtual filesystem.
  this.files=new Map();this.openFiles=new Map();
  try{const data=JSON.parse(localStorage.getItem('ship233-files')||'{}');for(const [name,b64] of Object.entries(data))this.files.set(name,Uint8Array.from(atob(b64),x=>x.charCodeAt(0)));}catch{}
  nop(0x422503);nop(0x42292a);nop(0x422ab4);nop(0x42255e);nop(0x422a1f);
  hook(0x422adc,12,c=>{const name=this.str(c.arg(0));if(!this.files.has(name))return 0;this.openFiles.set(c.r[1],{name,pos:0});return 1;});
  hook(0x42297f,8,c=>{const name=this.str(c.arg(0));if(c.arg(1)&0x1000)this.files.set(name,new Uint8Array());if(!this.files.has(name))throw Error('没有可读取的存档');this.openFiles.set(c.r[1],{name,pos:0});return c.r[1];});
  hook(0x422dd6,0,c=>this.files.get(this.openFiles.get(c.r[1]).name).length);
  hook(0x422bf9,8,c=>{const file=this.openFiles.get(c.r[1]),data=this.files.get(file.name),n=Math.min(c.arg(1),data.length-file.pos);c.memory.set(data.slice(file.pos,file.pos+n),c.arg(0));file.pos+=n;return n;});
  hook(0x422c33,8,c=>{const file=this.openFiles.get(c.r[1]),old=this.files.get(file.name),data=new Uint8Array(Math.max(old.length,file.pos+c.arg(1)));data.set(old);data.set(c.memory.slice(c.arg(0),c.arg(0)+c.arg(1)),file.pos);file.pos+=c.arg(1);this.files.set(file.name,data);return 1;});
  hook(0x422cf7,0,()=>{const data={};for(const [name,bytes] of this.files)data[name]=btoa(String.fromCharCode(...bytes));try{localStorage.setItem('ship233-files',JSON.stringify(data));}catch{}return 1;});
  hook(0x41c622,24,c=>{this.fileDialogOpen=!!c.arg(0);return c.r[1];});hook(0x41c784,0,()=>!this.fileDialogOpen||this.files.has('ship233.mine')?1:2);nop(0x41da12);
  hook(0x41c85f,4,c=>{this.assign(c.arg(0),new TextEncoder().encode('ship233.mine'));return c.arg(0);});
  hook(0x424fba,12,()=>1);
  hook(0x40193f,8,()=>1);hook(0x401ae3,8,c=>{if(!this.soundIds)this.soundIds=new Map();this.soundIds.set(c.arg(1),c.arg(0));return 1;});
  hook(0x4019f6,8,c=>{this.play(this.soundIds.get(c.arg(0)),c.arg(0),!!c.arg(1));return 1;});hook(0x4019ae,0,()=>{this.stopAudio();return 1;});
  hook(0x4019ca,4,c=>{const voice=this.voices.get(c.arg(0));if(voice)try{voice.stop();}catch{}this.voices.delete(c.arg(0));return 1;});
  hook(0x424f82,12,c=>{this.notice=this.str(c.arg(0));return 1;});
  const api={
   LoadBitmapA:[8,c=>this.bitmap(c.arg(1))],
   ImageList_AddMasked:[12,c=>{const list=this.dc(c.arg(0)),bmp=this.dc(c.arg(1)),col=c.arg(2),key=bmp.id+':'+col;let source=this.masked.get(key);if(!source){source=this.surface(bmp.width,bmp.height);const ctx=source.getContext('2d');ctx.drawImage(bmp.image,0,0);const pixels=ctx.getImageData(0,0,bmp.width,bmp.height);for(let i=0;i<pixels.data.length;i+=4)if(pixels.data[i]===(col&255)&&pixels.data[i+1]===((col>>>8)&255)&&pixels.data[i+2]===((col>>>16)&255))pixels.data[i+3]=0;ctx.putImageData(pixels,0,0);this.masked.set(key,source);}const start=list.frames.length;for(let x=0;x+list.w<=bmp.width;x+=list.w)list.frames.push({source,x});return start;}],
   ImageList_Draw:[24,c=>{const list=this.dc(c.arg(0)),f=list.frames[c.arg(1)];if(!f)return 0;this.context(c.arg(2)).drawImage(f.source,f.x,0,list.w,list.h,c.arg(3)|0,c.arg(4)|0,list.w,list.h);this.stats.draws++;return 1;}],
   CreateCompatibleDC:[4,()=>{const cv=this.surface(600,450);return this.handle({canvas:cv,ctx:cv.getContext('2d'),textColor:'#000',font:'14px SimSun,serif'});}],
   CreateCompatibleBitmap:[12,c=>{const cv=this.surface(c.arg(1),c.arg(2));return this.handle({image:cv,width:cv.width,height:cv.height});}],
   SelectObject:[8,c=>this.select(c.arg(0),c.arg(1))],DeleteObject:[4,()=>1],SetBkMode:[8,()=>1],
   SetTextColor:[8,c=>{this.dc(c.arg(0)).textColor=this.color(c.arg(1));return 0;}],SetTextAlign:[8,c=>{this.dc(c.arg(0)).align=c.arg(1);return 0;}],
   BitBlt:[36,c=>{const dc=this.dc(c.arg(5));this.context(c.arg(0)).drawImage(dc.canvas,c.arg(6),c.arg(7),c.arg(3),c.arg(4),c.arg(1),c.arg(2),c.arg(3),c.arg(4));return 1;}],
   StretchBlt:[44,c=>{this.context(c.arg(0)).drawImage(this.dc(c.arg(5)).canvas,c.arg(6),c.arg(7),c.arg(8),c.arg(9),c.arg(1),c.arg(2),c.arg(3),c.arg(4));return 1;}],
   SetPixel:[16,c=>{const ctx=this.context(c.arg(0));ctx.fillStyle=this.color(c.arg(3));ctx.fillRect(c.arg(1),c.arg(2),1,1);return c.arg(3);}],LineTo:[12,c=>{this.line(c.arg(0),c.arg(1)|0,c.arg(2)|0);return 1;}],
   GetTickCount:[0,()=>this.clock],GetClientRect:[8,c=>{[0,0,600,450].forEach((v,i)=>c.write(c.arg(1)+i*4,v));return 1;}],GetSystemMetrics:[4,c=>c.arg(0)===0?600:450],
   GetVersionExA:[4,()=>1],CopyRect:[8,c=>{c.memory.copyWithin(c.arg(0),c.arg(1),c.arg(1)+16);return 1;}],
   IntersectRect:[12,c=>{const [out,a,b]=[c.arg(0),c.arg(1),c.arg(2)],r=[Math.max(c.read(a)|0,c.read(b)|0),Math.max(c.read(a+4)|0,c.read(b+4)|0),Math.min(c.read(a+8)|0,c.read(b+8)|0),Math.min(c.read(a+12)|0,c.read(b+12)|0)],ok=r[2]>r[0]&&r[3]>r[1];r.forEach((v,i)=>c.write(out+i*4,ok?v:0));return +ok;}],
   lstrlenA:[4,c=>this.bytes(c.arg(0)).length],lstrcpyA:[8,c=>{const b=this.bytes(c.arg(1));c.memory.set(b,c.arg(0));c.write(c.arg(0)+b.length,0,1);return c.arg(0);}],wsprintfA:[0,c=>{const b=this.format(c);c.memory.set(b,c.arg(0));c.write(c.arg(0)+b.length,0,1);return b.length;}],
   GetSysColor:[4,()=>0xc8d0d4],GetWindowLongA:[8,()=>1],SetWindowLongA:[12,()=>1],DrawMenuBar:[4,()=>1],KillTimer:[8,()=>1],UpdateWindow:[4,()=>1],
   PostMessageA:[16,c=>{this.messages.push([c.arg(1),c.arg(2),c.arg(3)]);return 1;}],SendMessageA:[16,()=>1],GetStockObject:[4,()=>this.handle({font:'14px SimSun,serif'})]
  };
  this.messages=[];
  SHIP_MACHINE.imports.forEach(([iat,name],i)=>{const address=0x700000+i*16;c.write(iat,address);if(api[name])hook(address,...api[name]);else c.hooks.set(address,()=>{throw Error('Unimplemented service '+name+' from '+c.read(c.r[4]).toString(16));});});
 }
 line(h,x,y){const dc=this.dc(h),ctx=dc.ctx;ctx.strokeStyle=dc.pen?.color||'#000';ctx.lineWidth=dc.pen?.width||1;ctx.beginPath();ctx.moveTo(dc.point?.[0]||0,dc.point?.[1]||0);ctx.lineTo(x,y);ctx.stroke();dc.point=[x,y];}
 drawText(h,x,y,p,n){const dc=this.dc(h),ctx=dc.ctx;ctx.font=dc.font||'14px SimSun,serif';ctx.fillStyle=dc.textColor||'#000';ctx.textBaseline='top';ctx.textAlign=(dc.align&6)===6?'center':(dc.align&2)?'right':'left';ctx.fillText(this.decoder.decode(this.cpu.memory.slice(p,p+n)),x,y);}
 format(c){const fmt=this.bytes(c.arg(1)),out=[];let arg=2;for(let i=0;i<fmt.length;i++){if(fmt[i]!==37){out.push(fmt[i]);continue;}let j=i+1;while(j<fmt.length&&!['d','u','s','x','X','c','%'].includes(String.fromCharCode(fmt[j])))j++;const type=String.fromCharCode(fmt[j]);if(type==='%'){out.push(37);i=j;continue;}const v=c.arg(arg++),spec=String.fromCharCode(...fmt.slice(i+1,j)),width=+(spec.match(/\.(\d+)/)?.[1]||spec.match(/^(\d+)/)?.[1]||0);let bytes;if(type==='s')bytes=this.bytes(v);else{let str=type==='d'?String(v|0):type==='x'||type==='X'?v.toString(16):type==='c'?String.fromCharCode(v&255):String(v);if(type==='X')str=str.toUpperCase();str=str.padStart(width,spec.includes('.')||spec.startsWith('0')?'0':' ');bytes=new TextEncoder().encode(str);}out.push(...bytes);i=j;}return new Uint8Array(out);}
 initialize(){const c=this.cpu;c.run(0x4024c8,this.game);c.write(this.game+0x1c,1);c.run(0x40368c,this.game,[0]);c.run(0x409f8c,this.game);this.frame();}
 frame(){this.clock+=this.cpu.read(this.game+0x308)||31;this.cpu.run(0x4046c7,this.game);this.stats.frames++;while(this.messages.length){const [msg,a,b]=this.messages.shift();if(msg===0x111){const fn={0x8000:0x409f8c,0x8001:0x40a1eb,0x8002:0x40ac5a,0x8022:0x40eb18,0x8023:0x40eace,0x8024:0x40eaf3}[a];if(fn)this.cpu.run(fn,this.game);}else if(msg===0x7001)this.cpu.run(0x40aa8d,this.game,[a,b]);}}
 keyDown(vk){const fn={113:0x409f8c,114:0x40a1eb,116:0x40c142}[vk];if(fn)this.cpu.run(fn,this.game);else this.cpu.run(0x40a5a9,this.game,[vk,1,0]);}
 keyUp(vk){this.cpu.run(0x40a9d6,this.game,[vk,1,0]);}
 mouse(x,y,click=false,right=false){this.cpu.run(right?0x40bf76:click?0x40457f:0x40aa54,this.game,[0,Math.round(x),Math.round(y)]);}
 end(){this.cpu.run(0x40ac5a,this.game);this.frame();}
 startLevel(level){this.cpu.write(this.game+0x268,level-1);this.keyDown(113);}
 speed(command){this.cpu.run(0x40ea54,this.game,[command]);}
 save(){this.cpu.run(0x40d177,this.game);return this.files.get('ship233.mine');}
 load(){if(!this.files.has('ship233.mine'))return false;this.cpu.run(0x40dc35,this.game);return true;}
 stopAudio(){for(const voice of this.voices.values())try{voice.stop();}catch{}this.voices.clear();}
 state(){const c=this.cpu,G=this.game;let enemies=0;for(let i=0,a=c.read(G+0x1a0);i<20;i++)enemies+=+(c.read(a+i*44+16)!==0);return {level:c.read(G+0x1dc)+1,x:c.read(G+0x224),y:c.read(G+0x228),paused:c.read(G+0x1d8)===1,player:!!c.read(G+0x254),lives:c.read(G+0x21c),bombs:c.read(G+0x1f0),capacity:c.read(G+0x2f4),nukes:c.read(G+0x3b0),score:c.read(G+0x3ac),enemies,progress:Math.min(99,Math.floor(c.read(G+0x1ec)*100/((c.read(G+0x1dc)+6)*5))),step:c.read(G+0x308),stats:this.stats};}
 async audioReady(){if(!this.audio){this.audio=new AudioContext();this.audioLoading=Promise.all(Object.entries(SHIP_AUDIO).map(async([id,b64])=>{const raw=Uint8Array.from(atob(b64),x=>x.charCodeAt(0));this.buffers.set(+id,await this.audio.decodeAudioData(raw.buffer));}));}await this.audio.resume();await this.audioLoading;}
 play(id,slot,loop=false){if(!this.cpu.read(this.game+0x264)||!this.audio||!this.buffers.has(id))return;const old=this.voices.get(slot);if(old)try{old.stop();}catch{}const src=this.audio.createBufferSource();src.buffer=this.buffers.get(id);src.loop=loop;src.connect(this.audio.destination);this.voices.set(slot,src);src.onended=()=>{if(this.voices.get(slot)===src)this.voices.delete(slot);};src.start();}
}
window.ShipBridge=ShipBridge;
