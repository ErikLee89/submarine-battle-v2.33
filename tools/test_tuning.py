from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]
results=[]
with sync_playwright() as p:
 b=p.chromium.launch(channel='msedge',headless=True);q=b.new_page(viewport={'width':1440,'height':900})
 errors=[];q.on('pageerror',lambda e:errors.append(str(e)))
 q.goto((root/'index.html').as_uri());q.wait_for_function('window.gameReady');q.evaluate('stopped=true')
 assert q.evaluate('ship.tuning.config.enabled') is False
 q.locator('#settings').click();q.locator('#customRules').check()
 for key,value in dict(bombLimit=60,volley=12,spacing=22,lives=99,moveSpeed=15,respawnSeconds=6,shieldSeconds=40).items():q.locator('#'+key).fill(str(value))
 q.locator('#applySettings').click()
 result=q.evaluate('''()=>{ship.startLevel(1);ship.cpu.seed=12345;ship.keyDown(32);const c=ship.cpu,t=ship.tuning,G=ship.game,items=[];for(let i=0;i<60;i++)if(c.read(t.bombs+i*56+16))items.push({x:c.read(t.bombs+i*56+8),y:c.read(t.bombs+i*56+12)});const before=ship.state();for(let i=0;i<6;i++)ship.keyDown(32);const full=ship.state();for(let i=0;i<4;i++)ship.frame();return {before,full,items,stack:c.r[4],fpu:c.fpu,active:Array.from({length:100},(_,i)=>c.read(t.bombs+i*56+16)).filter(Boolean).length,positions:Array.from({length:60},(_,i)=>c.read(t.bombs+i*56+12))};}''')
 print('PASS horizontal volley and native motion',flush=True)
 assert result['before']['bombs']==12 and result['before']['lives']==99 and result['full']['bombs']==60
 assert len({i['x'] for i in result['items']})==12 and len({i['y'] for i in result['items']})==1
 assert len(set(result['positions']))==1 and result['positions'][0]==52
 assert result['stack']==0xf00000 and result['fpu']==[]
 results.append({'case':'60-capacity-horizontal-volley-native-motion','result':'pass'})
 result=q.evaluate('''()=>{const c=ship.cpu,G=ship.game;ship.startLevel(1);ship.keyDown(39);ship.frame();const x=ship.state().x;ship.frame();ship.keyUp(39);const delta=ship.state().x-x;const bytes=ship.save(),saved=ship.state();ship.startLevel(11);ship.load();return {delta,saved,restored:ship.state(),length:bytes.length,valid:!!ship.tuning.decode(bytes),remaining:c.read(G+0x24c)};}''')
 print('PASS movement and custom save',flush=True);assert result['delta']==15 and result['valid'] and result['restored']['lives']==99 and result['restored']['capacity']==60
 results.append({'case':'movement-15-and-custom-save','result':'pass'})
 q.reload();q.wait_for_function('window.gameReady');q.evaluate('stopped=true');assert q.evaluate('ship.tuning.config.bombLimit')==60
 q.locator('#load').click();q.evaluate('stopped=true');assert q.evaluate('ship.state().lives')==99
 result=q.evaluate('''()=>{ship.startLevel(1);const c=ship.cpu,G=ship.game,t=ship.tuning;ship.keyDown(32);for(let i=0;i<5;i++)ship.frame();const saved=Array.from({length:60},(_,i)=>Array.from(c.memory.slice(t.bombs+i*56,t.bombs+(i+1)*56)));ship.save();ship.startLevel(11);ship.load();return {enabled:ship.tuning.config.enabled,file:String.fromCharCode(...ship.files.get('ship233.mine').slice(0,100)),same:JSON.stringify(saved)===JSON.stringify(Array.from({length:60},(_,i)=>Array.from(c.memory.slice(t.bombs+i*56,t.bombs+(i+1)*56)))),state:ship.state()};}''')
 print('PASS active projectile restore',flush=True);assert result['same'];results.append({'case':'active-projectile-save-reload','result':'pass'})
 # Paused native frames do not consume protection. Changing frame speed retains real seconds.
 result=q.evaluate('''()=>{ship.startLevel(1);const c=ship.cpu,G=ship.game;ship.keyDown(114);const before=c.read(G+0x24c);for(let i=0;i<10;i++)ship.frame();const frozen=c.read(G+0x24c)===before;ship.speed(0x8014);const seconds=c.read(G+0x24c)*c.read(G+0x308)/1000;ship.keyDown(114);return {frozen,seconds,before,rules:ship.tuning.config,step:c.read(G+0x308),hook:c.hooks.has(0x40a1e7)};}''')
 print('PASS protection pause and speed change',flush=True);assert result['frozen'] and abs(result['seconds']-6)<.052
 results.append({'case':'protection-pause-and-speed-change','result':'pass'})
 # Use native collision and pickup branches, including a bomb beyond the original ten slots.
 result=q.evaluate('''()=>{const c=ship.cpu,G=ship.game,t=ship.tuning;t.apply({...t.config,bombLimit:100,volley:100,lives:7,respawnSeconds:.21,shieldSeconds:.42});ship.startLevel(1);c.seed=12345;const hit=()=>{const a=c.read(G+0x174);c.write(a+8,c.read(G+0x224)+25);c.write(a+12,c.read(G+0x228)+12);c.write(a+16,1);ship.frame();};hit();const protectedLives=ship.state().lives;c.write(c.read(G+0x174)+16,0);for(let i=0;i<12;i++)ship.frame();const expired=c.read(G+0x23c)===0;hit();const hitLives=ship.state().lives;c.write(G+0x1c4,1);c.write(G+0x1c8,1);c.write(G+0x1cc,1);c.write(G+0x1c0,1);ship.frame();const respawn=c.read(G+0x24c)*c.read(G+0x308)/1000;const item=c.read(G+0x1b0);c.write(item+8,c.read(G+0x224)+25);c.write(item+12,c.read(G+0x228)+18);c.write(item+16,1);c.write(item+24,300);c.write(item+28,0);c.write(item+36,0);ship.frame();const shield=c.read(G+0x24c)*c.read(G+0x308)/1000;ship.startLevel(1);c.write(G+0x224,560);ship.keyDown(32);const full=ship.state().bombs,xs=Array.from({length:100},(_,i)=>c.read(t.bombs+i*56+8));ship.startLevel(1);const sub=c.read(G+0x1a0);c.write(sub+8,300);c.write(sub+12,210);c.write(sub+16,1);c.write(sub+20,0);c.write(G+0x1e0,1);c.run(0x40238b,t.bombs+99*56,[310,210,1,360,0,0,0,0,0]);c.write(t.flags+99*4,1);c.write(G+0x1f0,1);ship.frame();return {protectedLives,expired,hitLives,respawn,shield,full,min:Math.min(...xs),max:Math.max(...xs),destroyed:c.read(G+0x3b8),score:ship.state().score};}''')
 print('native protection and collision',result,flush=True)
 assert result['protectedLives']==7 and result['expired'] and result['hitLives']==6
 assert 0<result['respawn']<=.21 and .39<=result['shield']<=.42
 assert result['full']==100 and 0<=result['min']<=result['max']<=580 and result['destroyed']==1 and result['score']>0
 results.append({'case':'timed-protection-native-life-loss-respawn-shield-pickup-and-slot99-collision','result':'pass'})
 result=q.evaluate('''()=>{const c=ship.cpu,G=ship.game,t=ship.tuning;t.apply({...t.config,invincible:true,respawnSeconds:0});ship.startLevel(1);for(let i=0;i<20;i++)ship.frame();const a=c.read(G+0x174);c.write(a+8,c.read(G+0x224)+25);c.write(a+12,c.read(G+0x228)+12);c.write(a+16,1);ship.frame();const lives=ship.state().lives,item=c.read(G+0x1b0),type=8;let mine=false;const mineHook=c.hooks.get(0x407f6a);c.hooks.set(0x407f6a,cpu=>{mine=true;mineHook(cpu)});c.hooks.set(0x409c56,cpu=>cpu.ret(4,1));c.write(item+8,c.read(G+0x224)+25);c.write(item+12,c.read(G+0x228)+18);c.write(item+16,1);c.write(item+24,300);c.write(item+28,0);c.write(item+36,type);ship.frame();c.hooks.delete(0x409c56);c.hooks.set(0x407f6a,mineHook);const immune=mine&&ship.state().lives===lives&&c.read(G+0x23c)===1;t.apply({...t.config,bombLimit:3,volley:12,invincible:false});ship.keyDown(32);ship.keyDown(32);const count=ship.state().bombs;t.apply({...t.config,bombLimit:1});return {immune,count,reduced:ship.state().bombs};}''')
 assert result['immune'] and result['count']==3 and result['reduced']==1
 results.append({'case':'permanent-invulnerability-remaining-ammo-and-capacity-reduction','result':'pass'})
 q.evaluate('ship.tuning.apply({...ship.tuning.config,bombLimit:60,volley:12,lives:99,respawnSeconds:6,shieldSeconds:40})')
 # All stages with large ammunition exercise the shared enemy pool and collision/scoring paths.
 for level in range(1,22):
  result=q.evaluate('''level=>{const c=ship.cpu,G=ship.game;ship.tuning.apply({...ship.tuning.config,invincible:true});ship.startLevel(level);c.seed=12345;c.write(G+0x3b0,2);for(let i=0;i<300;i++){if(i%8===0)ship.keyDown(32);if(i%13===0)ship.keyDown(38);if(i===120)ship.keyDown(13);ship.frame();if(ship.pendingName)ship.completeName('Test');}const s=ship.state();ship.save();ship.load();return {stack:c.r[4],fpu:c.fpu,state:s,count:Array.from({length:100},(_,i)=>c.read(ship.tuning.bombs+i*56+16)).filter(Boolean).length};}''',level)
  assert result['stack']==0xf00000 and result['fpu']==[] and 0<=result['state']['bombs']<=60 and result['state']['bombs']==result['count'],result
  print('PASS custom stage',level,flush=True);results.append({'case':f'custom-stage-{level}','result':'pass','score':result['state']['score']})
 # Import the exported wrapper into a separate browser context and retain its frame timing.
 raw=q.evaluate('Array.from(ship.save())');ctx=b.new_context();other=ctx.new_page();other.goto((root/'index.html').as_uri());other.wait_for_function('window.gameReady');other.locator('#settings').click();other.locator('#saveFile').set_input_files({'name':'ship233-custom.mine','mimeType':'application/octet-stream','buffer':bytes(raw)});other.wait_for_function('ship.tuning.config.enabled');assert other.evaluate('ship.state().capacity===60&&ship.state().step===21');other.reload();other.wait_for_function('window.gameReady');assert other.evaluate('ship.tuning.config.enabled&&ship.state().step===21');ctx.close();results.append({'case':'custom-export-import-fresh-browser','result':'pass'})
 q.locator('#settings').click();q.locator('#bombLimit').fill('101');q.locator('#applySettings').click();assert q.locator('#options').is_visible() and q.evaluate('ship.tuning.config.bombLimit')==60;q.locator('#bombLimit').fill('60')
 q.screenshot(path=str(root/'docs/settings-desktop.png'))
 for width in [390,320]:
  q.set_viewport_size({'width':width,'height':700});q.screenshot(path=str(root/f'docs/settings-{width}.png'))
  layout=q.evaluate('''()=>{const d=document.querySelector('#options'),content=d.querySelector('.content'),f=d.querySelector('.footer');return {overflow:document.documentElement.scrollWidth>innerWidth,scroll:content.scrollHeight>content.clientHeight,footer:f.getBoundingClientRect().bottom,height:innerHeight};}''');assert not layout['overflow'] and layout['scroll'] and layout['footer']<=layout['height'],layout
 q.locator('#resetRules').click();q.locator('#applySettings').click();assert q.evaluate('!ship.tuning.config.enabled&&ship.tuning.hooks.length===0&&ship.state().capacity===5&&ship.state().lives===5')
 q.evaluate('ship.startLevel(1)');assert q.evaluate('ship.save().length')==2109
 q.reload();q.wait_for_function('window.gameReady');assert q.evaluate('ship.tuning.config.enabled') is False
 assert errors==[] and q.locator('#error').inner_text()==''
 results.append({'case':'limits-responsive-dialog-and-original-reset','result':'pass'});b.close()
(root/'docs/tuning-verification.json').write_text(json.dumps({'result':'pass','cases':results,'pageErrors':errors},ensure_ascii=False,indent=2),encoding='utf8')
