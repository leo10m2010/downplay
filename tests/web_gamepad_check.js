// SPDX-License-Identifier: GPL-3.0-or-later
// Real browser/core; synthetic Gamepad API inputs, not physical controller tests.
async(page)=>{
 const context=await page.context().browser().newContext();
 try{
  await context.addInitScript(()=>{
   window.testPad={index:0,id:'DualSense test',mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
   Object.defineProperty(navigator,'getGamepads',{value:()=>[window.testPad]});
   const NativeWorker=Worker;
   window.Worker=class extends NativeWorker{constructor(...args){super(...args);this.addEventListener('message',event=>{if(event.data.type==='pad-test')window.testPadRead=event.data;});}};
  });
  await context.route('**/worker.js',async route=>{
   const response=await route.fetch();let body=await response.text();
   const anchor='    PRESSURE.forEach((b, i) => { o[6 + i] = buttons & b ? 255 : 0; });';
   if(!body.includes(anchor))throw Error('Unsupported pad instrumentation');
   body=body.replace('  const menuSticks=new Uint16Array(4);','  let padTrace="";const menuSticks=new Uint16Array(4);');
   body=body.replace(anchor,anchor+`\n    if(port===0){const data={bytes:Array.from(o),menu:dv.getInt32(0x0829DED8,true),phase:dv.getInt32(0x0843F348,true),selection:dv.getInt32(0x084C7F38,true),riding:!!dv.getInt32(0x0829E290,true)};const trace=JSON.stringify(data);if(trace!==padTrace){padTrace=trace;post('pad-test',data);}}`);
   const headers={...response.headers()};delete headers['content-length'];delete headers['content-encoding'];
   await route.fulfill({status:response.status(),headers,body});
  });
  const tab=await context.newPage();await tab.bringToFront();
  await tab.goto('http://127.0.0.1:8096/?env.DHD_SETTINGS=none&env.DHD_SCALE=1&env.DHD_AUTO_QUALITY=0');
  await tab.waitForFunction(()=>window.dhdStatus?.field>30&&window.testPadRead,null,{timeout:60000});
  await tab.locator('#screen').focus();
  const axes=values=>tab.evaluate(values=>{window.testPad.axes=values;},values);
  const press=async buttons=>{await tab.evaluate(buttons=>window.testPad.buttons.forEach((b,i)=>{b.pressed=buttons.includes(i);b.value=b.pressed?1:0;}),buttons);await tab.waitForTimeout(200);await tab.evaluate(()=>window.testPad.buttons.forEach(b=>{b.pressed=false;b.value=0;}));await tab.waitForTimeout(200);};
  // Both stick pairs reach the actual C host read, with menu directions added.
  await axes([-1,1,.5,-.5]);
  await tab.waitForFunction(()=>{const b=window.testPadRead?.bytes;return b&&b[0]===(128|64)&&b[2]===192&&b[3]===64&&b[4]===0&&b[5]===255;});
  const menuRead=await tab.evaluate(()=>window.testPadRead);await axes([0,0,0,0]);
  await tab.waitForFunction(()=>window.testPadRead.bytes.slice(0,6).join(',')==='0,0,128,128,128,128');
  // Navigate the original game with controller presses, without DHD_NAV/autopad.
  const navigation=[{menu:0,buttons:[0,3]},{menu:15,buttons:[0]},{menu:32,buttons:[0]},{menu:3,buttons:[0]},{menu:33,buttons:[0]},{menu:16,buttons:[0]},{menu:1,buttons:[0]},{menu:11,buttons:[0]}];
  for(const step of navigation){
   await tab.waitForFunction(menu=>window.testPadRead.menu===menu,step.menu,{timeout:30000});
   // Some screens briefly ignore input while their transition completes.
   for(let attempt=0;attempt<12;attempt++){
    await press(step.buttons);if(await tab.evaluate(menu=>window.testPadRead.menu!==menu,step.menu))break;
   }
  }
  // Track load/flyby accepts Start/Cross on the same controller.
  for(let i=0;i<60&&!await tab.evaluate(()=>window.testPadRead.riding);i++){
   const state=await tab.evaluate(()=>window.testPadRead);
   await press(state.menu===18&&state.selection===0?[9]:[0]);await tab.waitForTimeout(400);
  }
  await tab.waitForFunction(()=>window.testPadRead.riding&&[2,3,4].includes(window.testPadRead.phase),null,{timeout:45000});
  await axes([-.5,.5,1,-1]);
  await tab.waitForFunction(()=>{const p=window.testPadRead;return p.riding&&p.bytes.slice(0,6).join(',')==='0,0,255,0,64,192';});
  const raceRead=await tab.evaluate(()=>window.testPadRead);
  // Standard Xbox and other standard layouts share the same mapping.
  for(const id of ['Xbox Wireless Controller test','Generic standard controller test']){
   await tab.evaluate(id=>{window.testPad.id=id;},id);await axes([1,-1,0,0]);
   await tab.waitForFunction(()=>window.nativeGamepadDiagnostics()[4]===255&&window.nativeGamepadDiagnostics()[5]===0);
  }
  await axes([0,0,0,0]);await press([9]);
  await tab.waitForFunction(()=>!window.testPadRead.riding,null,{timeout:10000});
  await axes([0,-1,0,0]);await tab.waitForFunction(()=>window.testPadRead.bytes[0]===16);
  await axes([0,0,0,0]);
  await tab.evaluate(()=>{window.testPad.mapping='';});
  await tab.waitForFunction(()=>document.getElementById('gamepad-status').textContent.includes('no reconoce'));
  await tab.evaluate(()=>{window.testPad.mapping='standard';});
  await tab.waitForFunction(()=>window.nativeGamepadDiagnostics()[0]===1);
  await tab.locator('#controlsButton').click();
  await tab.waitForFunction(()=>window.nativeGamepadDiagnostics()[0]===0&&window.nativeGamepadDiagnostics().slice(2,6).every(x=>x===128));
  await tab.getByRole('button',{name:'Cerrar controles'}).click();await tab.locator('#screen').focus();
  await tab.waitForFunction(()=>window.nativeGamepadDiagnostics()[0]===1);
  await tab.evaluate(()=>{window.testPad.connected=false;});
  await tab.waitForFunction(()=>window.nativeGamepadDiagnostics()[0]===0);
  return {passed:true,physicalControllerTested:false,menuRead,raceRead,manualMenuNavigation:true,pauseMenuStick:true,unsupportedLayoutExplained:true,focusAndDisconnectCleared:true};
 }catch(error){
  const evidence=await Promise.all(context.pages().map(tab=>tab.evaluate(()=>({pad:window.testPadRead,status:document.getElementById('status')?.textContent})).catch(()=>null)));
  throw Error(String(error)+' '+JSON.stringify(evidence));
 }finally{await context.close();}
}
