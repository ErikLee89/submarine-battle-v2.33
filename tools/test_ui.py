from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(channel='msedge',headless=True);q=b.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
 errors=[];q.on('pageerror',lambda e:errors.append(str(e)))
 q.goto((root/'index.html').as_uri());q.wait_for_function('window.gameReady||!document.getElementById("error").hidden')
 assert q.locator('#error').inner_text()=='';q.wait_for_timeout(2000);q.screenshot(path=str(root/'docs/game-desktop.png'))
 q.locator('#pause').click();print(q.evaluate('ship.state()'));q.locator('#help').click();q.screenshot(path=str(root/'docs/help-desktop.png'));q.locator('#closeHelp').click();assert q.evaluate('ship.state().paused') is True
 q.locator('#settings').click();q.locator('#startLevel').select_option('11');q.locator('#startSelected').click();q.wait_for_timeout(300);assert q.evaluate('ship.state().level===11&&!ship.state().paused')
 q.locator('#save').click();q.locator('#start').click();q.locator('#load').click();assert q.evaluate('ship.state().level===11');q.reload();q.wait_for_function('window.gameReady||!document.getElementById("error").hidden');assert q.locator('#error').inner_text()=='';q.locator('#scores').click();q.screenshot(path=str(root/'docs/scores.png'));q.locator('[data-close="heroes"]').click()
 for w in [390,320]:
  q.set_viewport_size({'width':w,'height':700});q.locator('#help').click();q.screenshot(path=str(root/f'docs/help-{w}.png'));print(w,q.evaluate('''()=>{const d=document.querySelector('#instructions'),c=document.querySelector('.help-content'),b=document.querySelector('#closeHelp');return {dialog:d.getBoundingClientRect().toJSON(),scroll:c.scrollHeight>c.clientHeight,close:b.getBoundingClientRect().toJSON(),bodyOverflow:document.documentElement.scrollWidth>innerWidth}}'''));q.locator('#closeHelp').click()
 assert errors==[] and q.locator('#error').inner_text()=='';q.set_viewport_size({'width':1440,'height':900});q.locator('#start').click();q.locator('#pause').click();q.evaluate('ship.playerName=\"测试舰长\";ship.cpu.write(ship.game+0x3ac,12340);ship.cpu.run(0x40aa8d,ship.game,[0,0]);ship.completeName(\"测试舰长\");ship.showScores=false');assert q.evaluate('ship.str(ship.cpu.read(ship.game+0x3a4)+4)')=='测试舰长';q.locator('#start').click();q.locator('#start').click();q.locator('#help').click();q.locator('#closeHelp').click();q.wait_for_function('!ship.state().paused');q.evaluate('ship.audioReady()');assert q.evaluate('ship.buffers.size')==7;b.close();(root/'docs/ui-verification.json').write_text(json.dumps({'desktop':'1440x900','mobile':['390x700','320x700'],'helpPauseRestoration':'pass','stageSelection':'pass','saveRestore':'pass','pageErrors':errors,'audioDecoded':7,'ChineseName':'pass','result':'pass'},indent=2),encoding='utf8')
