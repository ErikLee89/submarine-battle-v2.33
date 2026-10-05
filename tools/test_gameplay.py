from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(channel='msedge',headless=True);q=b.new_page();q.goto((root/'index.html').as_uri());q.wait_for_function('window.gameReady');q.evaluate('stopped=true')
 results=[]
 for stage in range(1,22):
  try:
   result=q.evaluate('''level=>{ship.startLevel(level);ship.cpu.seed=12345;ship.cpu.write(ship.game+0x25c,1);ship.cpu.write(ship.game+0x23c,1);ship.cpu.write(ship.game+0x3b0,2);for(let i=0;i<700;i++){if(i%8===0)ship.keyDown(32);if(i%13===0)ship.keyDown(38);if(i===200)ship.keyDown(13);ship.frame()}const state=ship.state();ship.save();ship.load();return {state,saveLength:ship.files.get('ship233.mine').length,stack:ship.cpu.r[4].toString(16),fpu:ship.cpu.fpu}}''',stage)
   assert result['stack']=='f00000' and result['saveLength']==2109 and result['fpu']==[]
   results.append({'stage':stage,'result':'pass',**result});print('PASS',stage,flush=True)
  except Exception as e:
   print('FAIL',stage,str(e));raise
 q.evaluate('ship.startLevel(21);ship.cpu.run(0x40a234,ship.game,[0,0])');assert q.evaluate('ship.state().level')==1
 results.append({'case':'stage21-wrap','result':'pass'})
 q.evaluate('ship.cpu.write(ship.game+0x3ac,12340);ship.cpu.run(0x40aa8d,ship.game,[0,0])');q.reload();q.wait_for_function('window.gameReady');assert q.evaluate('ship.cpu.read(ship.cpu.read(ship.game+0x3a4)+24)')==12340
 results.append({'case':'native-score-persistence','result':'pass'})
 (root/'docs/gameplay-verification.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8');b.close()
