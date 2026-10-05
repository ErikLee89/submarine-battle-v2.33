"""Exercise the actual native game-over message and the asynchronous name dialog."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 page=browser.new_page(viewport={'width':1280,'height':800})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto((root/'index.html').as_uri());page.wait_for_function('window.gameReady')
 def qualify(score):
  page.evaluate('''score=>{ship.keyDown(113);ship.cpu.write(ship.game+0x3ac,score);ship.messages.push([0x7001,0,0]);ship.frame()}''',score)
  page.locator('#scoreEntry').wait_for(state='visible')
  assert page.evaluate('ship.cpu.suspended===true&&!!ship.pendingName')
 def records():
  return page.evaluate('''()=>{const c=ship.cpu,b=c.read(ship.game+0x3a4);return Array.from({length:10},(_,i)=>({name:ship.str(b+i*44+4),score:c.read(b+i*44+24)}))}''')
 qualify(50000)
 assert page.locator('#entryScore').inner_text()=='50000'
 assert page.locator('#entryName').input_value()==''
 frozen=page.evaluate('({pc:ship.cpu.pc,stack:ship.cpu.r[4],frames:ship.stats.frames})')
 page.keyboard.press('ArrowLeft');page.wait_for_timeout(150)
 assert frozen==page.evaluate('({pc:ship.cpu.pc,stack:ship.cpu.r[4],frames:ship.stats.frames})')
 page.locator('#entryForm button[type=submit]').click()
 assert page.locator('#entryError').is_visible() and records()[0]['score']==0
 page.locator('#entryName').fill('一二三四五六七');page.locator('#entryForm button[type=submit]').click()
 assert page.locator('#entryError').is_visible() and page.evaluate('ship.cpu.suspended')
 page.locator('#entryName').fill('测试舰长');page.keyboard.press('Enter')
 page.locator('#heroes').wait_for(state='visible')
 assert records()[0]=={'name':'测试舰长','score':50000}
 assert page.evaluate('!ship.cpu.suspended&&!ship.pendingName&&ship.cpu.pc===0&&ship.cpu.r[4]===0xf00000')
 assert page.locator('#scoreRows tr').first.inner_text().find('测试舰长')>=0
 page.locator('[data-close="heroes"]').click();page.reload();page.wait_for_function('window.gameReady')
 assert records()[0]=={'name':'测试舰长','score':50000}
 before=records();qualify(60000)
 assert page.locator('#entryName').input_value()==''
 page.locator('#cancelEntry').click();page.wait_for_function('!ship.cpu.suspended')
 assert records()==before and page.evaluate('ship.cpu.r[4]===0xf00000')
 page.locator('#start').click();qualify(70000);page.keyboard.press('Escape');page.wait_for_function('!ship.cpu.suspended')
 assert records()==before and not page.locator('#scoreEntry').is_visible()
 page.locator('#start').click();qualify(80000)
 page.set_viewport_size({'width':320,'height':700});page.locator('#entryName').fill('Captain12')
 page.screenshot(path=str(root/'docs/name-entry-320.png'))
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.locator('#entryForm button[type=submit]').dblclick();page.locator('#heroes').wait_for(state='visible')
 assert sum(row['score']==80000 for row in records())==1
 assert records()[0]=={'name':'Captain12','score':80000}
 assert page.locator('#error').inner_text()=='' and errors==[]
 browser.close()
 result={'namePrompt':'pass','nativeExecutionWait':'pass','ChineseName':'pass','blankAndLongName':'pass','cancelButtonAndEscape':'pass','reloadPersistence':'pass','doubleSubmit':'pass','mobile320':'pass','pageErrors':errors}
 (root/'docs/name-entry-verification.json').write_text(json.dumps(result,indent=2),encoding='utf8')
 print(json.dumps(result))
