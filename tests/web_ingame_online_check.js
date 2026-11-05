// SPDX-License-Identifier: GPL-3.0-or-later
// Real original in-game Online menu, with keyboard input and private resources.
async(page)=>{
 const context=await page.context().browser().newContext();
 try{
  await context.addInitScript(()=>{const Original=Worker;window.Worker=class extends Original{constructor(...args){super(...args);this.addEventListener('message',e=>{if(e.data.type==='menu-test')window.menuTest=e.data;});}};});
  await context.route('**/worker.js',async route=>{
   const response=await route.fetch();let body=await response.text();body=body.replace('  const menuSticks=new Uint16Array(4);','  let menuTrace="";const menuSticks=new Uint16Array(4);');
   const anchor='    PRESSURE.forEach((b, i) => { o[6 + i] = buttons & b ? 255 : 0; });';
   body=body.replace(anchor,anchor+`\n    if(port===0){const data={menu:dv.getInt32(0x0829DED8,true),cursor:dv.getInt32(0x084C6CB8,true)};const trace=JSON.stringify(data);if(trace!==menuTrace){menuTrace=trace;post('menu-test',data);}}`);
   const headers={...response.headers()};delete headers['content-length'];delete headers['content-encoding'];await route.fulfill({status:200,headers,body});
  });
  const tab=await context.newPage();await tab.bringToFront();await tab.goto('http://127.0.0.1:8096/?env.DHD_SETTINGS=none&env.DHD_SCALE=1&env.DHD_ONLINE_MENU_TRACE=1');
  await tab.waitForFunction(()=>window.dhdStatus&&window.menuTest,null,{timeout:60000});await tab.locator('#screen').focus();
  const press=async key=>{await tab.keyboard.down(key);await tab.waitForTimeout(150);await tab.keyboard.up(key);await tab.waitForTimeout(200);};
  for(let i=0;i<15&&await tab.evaluate(()=>window.menuTest.menu!==15);i++)await press('x');
  await tab.waitForFunction(()=>window.menuTest.menu===15);
  await tab.waitForTimeout(700);for(let i=0;i<12&&await tab.evaluate(()=>window.menuTest.cursor!==3);i++)await press('ArrowDown');
  await press('x');await tab.waitForTimeout(1500);await press('x');await tab.waitForTimeout(1500);
  await tab.waitForFunction(()=>window.nativeTextInputActive?.(),null,{timeout:10000});
  for(let i=0;i<5;i++)await tab.keyboard.press('Backspace');
  await tab.keyboard.type('leo');
  await tab.waitForFunction(()=>document.getElementById('log').textContent.includes('entry=LEO'));
  await tab.keyboard.press('Enter');await tab.waitForFunction(()=>!window.nativeTextInputActive());
  for(let i=0;i<5;i++)await press('ArrowDown');await press('x');
  await tab.waitForFunction(()=>window.nativeTextInputActive(),null,{timeout:10000});
  await tab.keyboard.type('abc234');
  await tab.waitForFunction(()=>document.getElementById('log').textContent.includes('entry=ABC234'));
  await tab.keyboard.press('Escape');await tab.waitForFunction(()=>!window.nativeTextInputActive());
  const field=await tab.evaluate(()=>window.dhdStatus.field);await tab.waitForFunction(n=>window.dhdStatus.field>n+60,field,{timeout:10000});
  const status=await tab.locator('#status').textContent(),log=await tab.locator('#log').textContent();
  if(/stopped|ERROR|unsupported service/.test(status+log))throw Error(status+' '+log.slice(-3000));
  return {passed:true,originalOnlineMenu:true,nameTypedAndConfirmed:true,codeTypedAndCancelled:true,fieldsAdvanced:(await tab.evaluate(()=>window.dhdStatus.field))-field};
 }finally{await context.close();}
}
