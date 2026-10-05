from pathlib import Path
from playwright.sync_api import sync_playwright
import json

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto((root/'index.html').as_uri());page.wait_for_function('window.gameReady')
 page.locator('#settings').click();page.locator('#startLevel').select_option('11');page.locator('#applySettings').click()
 assert page.evaluate('ship.state().level')==1, 'Applying settings must not restart the current game'
 page.locator('#start').click();assert page.evaluate('ship.state().level')==11
 page.keyboard.press('F2');assert page.evaluate('ship.state().level')==11
 page.reload();page.wait_for_function('window.gameReady');assert page.evaluate('ship.state().level')==11
 page.locator('#settings').click();assert page.locator('#startLevel').input_value()=='11'
 page.locator('#startLevel').select_option('17');page.locator('[data-close="options"]').click()
 page.keyboard.press('F2');assert page.evaluate('ship.state().level')==11
 page.locator('#pause').click();page.locator('#settings').click();page.locator('#startLevel').select_option('21');page.locator('#applySettings').click()
 assert page.evaluate('ship.state().paused&&ship.state().level===11')
 page.locator('#start').click();assert page.evaluate('ship.state().level===21&&!ship.state().paused')
 page.locator('#quit').click();page.locator('#start').click();assert page.evaluate('ship.state().level')==21
 page.locator('#settings').click();assert page.locator('#startLevel').input_value()=='21'
 page.locator('#startLevel').select_option('14');page.locator('#customRules').check();page.locator('#lives').fill('20');page.locator('#bombLimit').fill('30');page.locator('#startSelected').click()
 assert page.evaluate('ship.state().level===14&&ship.state().lives===20&&ship.state().capacity===30&&!ship.state().paused')
 page.keyboard.press('F2');assert page.evaluate('ship.state().level===14&&ship.state().lives===20&&ship.state().capacity===30')
 page.reload();page.wait_for_function('window.gameReady');assert page.evaluate('ship.state().level===14&&ship.tuning.config.enabled&&ship.state().lives===20&&ship.state().capacity===30')
 assert page.locator('#error').inner_text()=='' and errors==[]
 browser.close()
 result={'result':'pass','applyDoesNotRestart':'pass','startButtonAndF2':'pass','reload':'pass','cancelDoesNotApply':'pass','pausedSettings':'pass','restartAfterEnd':'pass','startSelectedAndCustomParameters':'pass','pageErrors':errors}
 (root/'docs/start-level-verification.json').write_text(json.dumps(result,indent=2),encoding='utf8')
 print(json.dumps(result))
