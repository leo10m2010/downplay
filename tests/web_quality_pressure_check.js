// Real game/rendering; only the controller's FPS input is injected to test its response.
// This is not a benchmark of a real 12 FPS device.
async(page)=>{
 const browser=page.context().browser(),results=[];
 for(const pressure of [false,true]){
  const context=await browser.newContext();
  try{
   if(pressure)await context.route('**/quality.js',async route=>{
    const response=await route.fetch(),original=await response.text();
    const source=original.replace('export function createAutoQuality(','function realController(');
    if(source===original)throw Error('Controller test injection did not match');
    await route.fulfill({status:200,contentType:'text/javascript',body:source+'\nexport function createAutoQuality(options){const controller=realController(options);return {sample(state,now){return controller.sample({...state,fps:12},now);}};}'});
   });
   const tab=await context.newPage();await tab.goto('http://127.0.0.1:8095/?env.DHD_SCALE=4&env.DHD_AUTO_QUALITY=1&env.DHD_SETTINGS=none');
   await tab.waitForFunction(()=>window.dhdStatus?.scale===4,null,{timeout:45000});
   const start=await tab.evaluate(()=>window.dhdStatus);
   if(pressure){
    await tab.waitForFunction(()=>window.dhdStatus?.scale<=2,null,{timeout:20000});
    await tab.waitForFunction(()=>window.dhdStatus?.scale===1,null,{timeout:20000});
   }else await tab.waitForTimeout(6000);
   const end=await tab.evaluate(()=>window.dhdStatus);
   if(end.field<=start.field||end.riding)throw Error('Menu/field precondition failed');
   if(!pressure&&end.fps>=48&&end.scale!==4)throw Error('Healthy menu was unnecessarily downscaled');
   results.push({controllerInputFps:pressure?12:'actual',actualMeasuredFps:end.fps,initialScale:start.scale,finalScale:end.scale,menu:true,fieldsAdvanced:end.field-start.field});
  }finally{await context.close();}
 }
 return {passed:true,results,physicalLowPerformanceDeviceTested:false};
}
