// SPDX-License-Identifier: GPL-3.0-or-later
// Real Chrome core with a mobile viewport/touch input; not a physical Android benchmark.
async(page)=>{
 const browser=page.context().browser(),context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const assert=(ok,message)=>{if(!ok)throw Error(message);};
 try{
  const tab=await context.newPage();const errors=[];tab.on('pageerror',e=>errors.push(e.message));
  await tab.goto('http://127.0.0.1:8096/?env.DHD_SETTINGS=none');
  await tab.waitForFunction(()=>document.body.classList.contains('ready'),null,{timeout:60000});
  assert((await tab.evaluate(()=>window.dhdStatus.scale))===1,'Mobile must start at x1');
  assert(await tab.locator('#touch-controls').isVisible(),'Missing touch controls');
  assert(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Portrait overflow');
  const cdp=await context.newCDPSession(tab);
  const button=key=>tab.locator(`[data-key="${key}"]`);
  const point=async(key,id)=>{const b=await button(key).boundingBox();assert(b.width>=40&&b.height>=34,'Small button '+key);return {x:b.x+b.width/2,y:b.y+b.height/2,id};};
  const event=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  const keys=()=>tab.evaluate(()=>window.nativeKeyboardDiagnostics());
  // Simultaneous pedal, steering and jump must be independent, including release.
  await button(88).scrollIntoViewIfNeeded();
  const pedal=await point(88,1),left=await point(37,2),jump=await point(69,3);
  await event('touchStart',[pedal]);await event('touchStart',[pedal,left]);await event('touchStart',[pedal,left,jump]);
  let held=await keys();assert(held[88]&&held[37]&&held[69],'Lost simultaneous touch input');
  await event('touchEnd',[jump]);held=await keys();assert(held[88]&&held[37]&&!held[69],'Releasing jump: '+JSON.stringify({cross:held[88],left:held[37],jump:held[69]}));
  await event('touchCancel',[]);assert((await keys()).every(x=>x===0),'Cancel left a held key');
  // Keyboard and touch pressing the same core key must not release each other.
  await tab.locator('#screen').focus();await tab.keyboard.down('x');
  await event('touchStart',[await point(88,1)]);await tab.keyboard.up('x');
  assert((await keys())[88]===1,'Keyboard release cleared touch');await event('touchEnd',[]);
  // Every original controller button reaches the existing core input.
  for(const key of [38,40,37,39,88,83,90,67,13,9,65,68,81,69,70,87]){
   await event('touchStart',[await point(key,1)]);assert((await keys())[key]===1,'Missing button '+key);await event('touchEnd',[]);
  }
  assert((await keys()).every(x=>x===0),'Released buttons remain held');
  await tab.screenshot({path:'output/playwright/mobile-portrait.png',fullPage:true});
  await tab.setViewportSize({width:844,height:390});
  await tab.locator('#fullscreen').click();
  await tab.waitForFunction(()=>document.fullscreenElement?.id==='play-surface'||document.body.classList.contains('expanded-game'));
  assert(await tab.locator('#touch-controls').isVisible(),'Fullscreen hid the controller');
  const pedalWide=await point(88,1),leftWide=await point(37,2);
  await event('touchStart',[leftWide,pedalWide]);assert((await keys())[37]&&(await keys())[88],'Fullscreen touch failed');
  await event('touchMove',[await point(39,2),pedalWide]);held=await keys();assert(!held[37]&&held[39]&&held[88],'D-pad sliding lost direction or pedal');
  await event('touchEnd',[]);
  await tab.screenshot({path:'output/playwright/mobile-landscape.png'});
  await tab.locator('#exit-fullscreen').click();
  await tab.waitForFunction(()=>!document.fullscreenElement&&!document.body.classList.contains('expanded-game'));
  // A portrait toggle must not retain an input.
  await tab.setViewportSize({width:390,height:844});
  await tab.locator('#touch-toggle').click();assert(!(await tab.locator('#touch-controls').isVisible()),'Toggle did not hide controller');
  await tab.locator('#touch-toggle').click();assert(await tab.locator('#touch-controls').isVisible(),'Toggle did not restore controller');
  // Navigate the real menus with the existing core's script, then drive by touch.
  const nav='0:triangle|cross,15:cross,32:cross,3:cross,33:cross,16:cross,1:cross,11:cross,18@4C7F38=0:start,18@4C7F38=1:cross,9/5:cross';
  await tab.goto('http://127.0.0.1:8096/?env.DHD_SETTINGS=none&env.DHD_RACE_SYNC=1&env.DHD_NAV='+encodeURIComponent(nav));
  await tab.waitForFunction(()=>document.body.classList.contains('ready')&&window.dhdStatus?.riding,null,{timeout:90000});
  await tab.setViewportSize({width:844,height:390});await tab.locator('#fullscreen').click();
  await tab.waitForFunction(()=>document.fullscreenElement?.id==='play-surface'||document.body.classList.contains('expanded-game'));
  const start=await tab.evaluate(()=>window.dhdStatus.field);
  await event('touchStart',[await point(88,1),await point(37,2)]);
  await tab.waitForFunction(field=>window.dhdStatus.field>field+90,start,{timeout:15000});
  assert((await keys())[88]&&(await keys())[37],'Race lost held inputs');await event('touchEnd',[]);
  for(const key of [37,38,88,69]){const bounds=await button(key).boundingBox();assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=844&&bounds.y+bounds.height<=390,'Race control outside screen '+key+': '+JSON.stringify(bounds));}
  await tab.screenshot({path:'output/playwright/mobile-race.png'});
  assert(!errors.length,'Browser errors: '+errors.join('; '));
  return {passed:true,scale:(await tab.evaluate(()=>window.dhdStatus.scale)),buttons:16,multitouch:true,fullscreen:true,raceFields:(await tab.evaluate(()=>window.dhdStatus.field))-start,physicalPhoneTested:false};
 }finally{await context.close();}
}

