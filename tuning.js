/* Optional rules layered at the original machine's projectile and player boundaries. */
'use strict';
class ShipTuning {
 static defaults={enabled:false,bombLimit:5,lives:5,volley:1,spacing:18,moveSpeed:5,respawnSeconds:3.72,shieldSeconds:23.25,invincible:false};
 static limits={bombLimit:[1,100,1],lives:[1,999,1],volley:[1,100,1],spacing:[4,80,1],moveSpeed:[1,40,1],respawnSeconds:[0,600,.01],shieldSeconds:[0,600,.01]};
 static fields=[0x1f0,0x2f4,0x21c,0x2f8,0x24c,0x23c,0x25c,0x248,0x250,0x308,0x3b0];
 static rules(value={}){const rules={...this.defaults,...value};for(const [key,[min,max,step]] of Object.entries(this.limits)){const n=rules[key];if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max||(step===1&&!Number.isInteger(n)))throw Error('玩法参数超出允许范围');}rules.enabled=!!rules.enabled;rules.invincible=!!rules.invincible;return rules;}
 constructor(bridge){this.bridge=bridge;this.cpu=bridge.cpu;this.G=bridge.game;this.config={...ShipTuning.defaults};this.hooks=[];this.protectionKind='respawnSeconds';}
 at(pc,after,before){const c=this.cpu,alias=0x740000+this.hooks.length*16;c.code.set(alias,c.code.get(pc));const previous=c.hooks.get(pc);c.hooks.set(pc,cpu=>{if(before?.(cpu))return;cpu.pc=alias;cpu.step();after?.(cpu);});this.hooks.push([pc,previous,alias]);}
 clearBombs(){const c=this.cpu;for(let i=0;i<100;i++){c.write(this.bombs+i*56+16,0);c.write(this.flags+i*4,1);}c.write(this.G+0x1f0,0);}
 protect(kind){const c=this.cpu,G=this.G;this.protectionKind=kind;c.write(G+0x24c,Math.ceil(this.config[kind]*1000/c.read(G+0x308)));c.write(G+0x23c,+(this.config.invincible||this.config[kind]>0));}
 newGame(){const c=this.cpu,G=this.G;c.write(G+0x2f4,this.config.bombLimit);c.write(G+0x21c,this.config.lives);c.write(G+0x25c,+this.config.invincible);this.protect('respawnSeconds');}
 install(){const c=this.cpu,G=this.G;this.nativeBombs=c.read(G+0x1a8);this.nativeFlags=c.read(G+0x234);this.bombs=c.alloc(100*56);this.flags=c.alloc(100*4);c.memory.set(c.memory.slice(this.nativeBombs,this.nativeBombs+10*56),this.bombs);c.memory.set(c.memory.slice(this.nativeFlags,this.nativeFlags+40),this.flags);for(let i=10;i<100;i++)c.write(this.flags+i*4,1);c.write(G+0x234,this.flags);
  // Only friendly-bomb pointer reads are redirected. Enemy slots 10..34 stay untouched.
  for(const pc of [0x4045da,0x404625,0x405d5c,0x405f89,0x4061b2,0x40640e,0x408538,0x408549,0x408563,0x40a677,0x40a6d7,0x40a745,0x40a7a5,0x40a813,0x40a873])this.at(pc,cpu=>cpu.set(cpu.code.get(pc)[3][0],this.bombs));
  this.at(0x409cb3,cpu=>{if(cpu.read(cpu.r[4]+12)!==0)cpu.r[7]=this.bombs;});
  // The original update loop visits 25 entities; replay just its bomb block for extra slots.
  this.at(0x40859f,null,cpu=>{const index=cpu.read(cpu.r[5]-0x18),cap=cpu.read(G+0x2f4);if(index>=24&&cap>25){if(index+1<cap){cpu.write(cpu.r[5]-0x18,index+1);cpu.r[7]=(index+1)*56;cpu.pc=0x40852d;return true;}cpu.write(cpu.r[5]-0x18,24);cpu.r[7]=24*56;}return false;});
  for(const [pc,reg] of [[0x408ee3,0],[0x40a0cd,1],[0x40a252,0],[0x40a31d,1],[0x40ac8e,1]])this.at(pc,cpu=>{if(cpu.r[reg]===0)this.clearBombs();});
  this.at(0x40a1e7,()=>this.newGame());
  this.at(0x407a55,()=>this.protect('shieldSeconds'));this.at(0x409511,()=>this.protect('respawnSeconds'));
  this.at(0x40969c,cpu=>{if((cpu.read(G+0x24c)|0)<0)cpu.write(G+0x24c,0);});
  this.at(0x407f6a,null,cpu=>{if(this.config.invincible){cpu.pc=0x40803a;return true;}return false;});
  for(const pc of [0x40997c,0x409996])this.at(pc,cpu=>cpu.r[0]=this.config.moveSpeed*(cpu.read(G+0x2f8)===10?2:1));
  // Keep the native countdown label in seconds at the selected frame interval.
  this.at(0x409654,cpu=>cpu.r[0]=Math.max(0,Math.ceil(cpu.read(G+0x24c)*cpu.read(G+0x308)/1000)-1)*cpu.read(G+0x308));
  this.at(0x407ce9,cpu=>cpu.write(cpu.r[4],this.config.bombLimit));
  this.at(0x40eb05,cpu=>cpu.arithmetic(cpu.r[2],this.config.bombLimit,4,true));this.at(0x40eb0a,cpu=>cpu.write(G+0x2f4,this.config.bombLimit));
  this.at(0x40eae0,cpu=>cpu.arithmetic(cpu.r[2],999,4,true));this.at(0x40eae5,cpu=>cpu.write(G+0x21c,999));
 }
 apply(value,{restore=false}={}){const next=ShipTuning.rules(value),old=this.config,c=this.cpu,G=this.G;this.config=next;if(next.enabled&&!old.enabled)this.install();if(!next.enabled&&old.enabled){for(const [pc,previous,alias] of this.hooks){if(previous)c.hooks.set(pc,previous);else c.hooks.delete(pc);c.code.delete(alias);}this.hooks=[];c.memory.set(c.memory.slice(this.flags,this.flags+40),this.nativeFlags);c.write(G+0x234,this.nativeFlags);for(let i=0;i<10;i++)c.write(this.nativeBombs+i*56+16,0);c.free(this.bombs);c.free(this.flags);c.write(G+0x1f0,0);c.write(G+0x2f4,5);c.write(G+0x21c,5);c.write(G+0x25c,0);c.write(G+0x23c,0);c.write(G+0x24c,0);}
  if(!next.enabled||restore)return;c.write(G+0x2f4,next.bombLimit);if(!old.enabled||old.lives!==next.lives)c.write(G+0x21c,next.lives);
  // Reducing capacity retires excess projectiles; the remaining count must stay accurate.
  let active=0;for(let i=0;i<100;i++){const a=this.bombs+i*56;if(i>=next.bombLimit)c.write(a+16,0);else active+=+(c.read(a+16)!==0);}c.write(G+0x1f0,active);c.write(G+0x25c,+next.invincible);
  if(!old.enabled||next[this.protectionKind]!==old[this.protectionKind])this.protect(this.protectionKind);else c.write(G+0x23c,+(next.invincible||c.read(G+0x24c)>0));
 }
 fire(run){if(!this.config.enabled||this.config.volley===1){run();return;}const c=this.cpu,G=this.G,before=c.read(G+0x1f0),count=Math.min(this.config.volley,c.read(G+0x2f4)-before);if(count<1){run();return;}let first=0;while(first<100&&c.read(this.bombs+first*56+16))first++;run();if(c.read(G+0x1f0)!==before+1)return;
  const source=this.bombs+first*56,template=c.memory.slice(source,source+56),spacing=Math.min(this.config.spacing,580/Math.max(1,count-1)),span=(count-1)*spacing,start=Math.max(0,Math.min(580-span,c.read(source+8)-span/2));c.write(source+8,Math.round(start));let added=1;for(let i=0;i<100&&added<count;i++){const a=this.bombs+i*56;if(c.read(a+16))continue;c.memory.set(template,a);c.write(a+8,Math.round(start+added*spacing));c.write(this.flags+i*4,1);added++;}c.write(G+0x1f0,before+added);
 }
 rescaleProtection(oldStep,newStep){if(this.config.enabled)this.cpu.write(this.G+0x24c,Math.ceil(this.cpu.read(this.G+0x24c)*oldStep/newStep));}
 save(nativeSave){if(!this.config.enabled)return nativeSave();const c=this.cpu,G=this.G,fields={};for(const offset of ShipTuning.fields)fields[offset]=c.read(G+offset);this.bridge.savingCustom=true;let native;try{native=nativeSave();}finally{this.bridge.savingCustom=false;}const b64=bytes=>btoa(String.fromCharCode(...bytes)),data={format:'ship233-custom',version:1,native:new TextDecoder().decode(native),rules:this.config,fields,bombs:b64(c.memory.slice(this.bombs,this.bombs+5600)),flags:b64(c.memory.slice(this.flags,this.flags+400)),protectionKind:this.protectionKind};return new TextEncoder().encode(JSON.stringify(data));}
 decode(bytes){const text=new TextDecoder().decode(bytes);if(bytes.length===2109&&/^231[0-9A-F]+$/.test(text))return null;let data;try{data=JSON.parse(text);if(data.format!=='ship233-custom'||data.version!==1||!/^231[0-9A-F]{2106}$/.test(data.native))throw Error();data.rules=ShipTuning.rules(data.rules);if(!data.rules.enabled||atob(data.bombs).length!==5600||atob(data.flags).length!==400||!['shieldSeconds','respawnSeconds'].includes(data.protectionKind))throw Error();for(const offset of ShipTuning.fields)if(!Number.isInteger(data.fields[offset])||data.fields[offset]<0||data.fields[offset]>0xffffffff)throw Error();if(data.fields[0x308]<1||data.fields[0x308]>181||data.fields[0x2f4]<1||data.fields[0x2f4]>100||data.fields[0x1f0]>data.fields[0x2f4])throw Error();}catch{throw Error('请导入 V2.33 原版或本网页导出的 .mine 存档');}return data;}
 restore(data){this.apply(data.rules,{restore:true});const c=this.cpu,G=this.G;for(const offset of ShipTuning.fields)c.write(G+offset,data.fields[offset]);c.memory.set(Uint8Array.from(atob(data.bombs),x=>x.charCodeAt(0)),this.bombs);c.memory.set(Uint8Array.from(atob(data.flags),x=>x.charCodeAt(0)),this.flags);this.protectionKind=data.protectionKind;try{const cfg=JSON.parse(localStorage.getItem('ship233-settings')||'{}');cfg.gameplay=this.config;cfg.speed=c.read(G+0x308);localStorage.setItem('ship233-settings',JSON.stringify(cfg));}catch{}}
}
window.ShipTuning=ShipTuning;
