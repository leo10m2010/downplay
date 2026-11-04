// Real game/rendering; only the reported presentation rate is injected to test its response.
// This is not a benchmark of a real 12 FPS device.
async(page)=>{
 const browser=page.context().browser(),results=[];
 for(const pressure of [false,true]){
  const context=await browser.newContext();
  try{
   if(pressure)await context.route('**/worker.js',async route=>{
    const response=await route.fetch(),original=await response.text();
    const source=original.replace('const presentFps=Math.max(0,(shown-lastShown)*1000/(now-lastReport));','const presentFps=12;');
    if(source===original)throw Error('Controller test injection did not match');
    const headers={...response.headers()};delete headers['content-encoding'];delete headers['content-length'];
    await route.fulfill({status:200,headers,body:source});
   });
   const tab=await context.newPage();await tab.bringToFront();await tab.goto('http://127.0.0.1:8096/?env.DHD_SCALE=4&env.DHD_AUTO_QUALITY=1&env.DHD_SETTINGS=none');
   try{await tab.waitForFunction(()=>window.dhdStatus?.scale===4,null,{timeout:45000});}catch(error){throw Error('pressure='+pressure+' '+error.message+' '+JSON.stringify(await tab.evaluate(()=>({game:window.dhdStatus,status:document.getElementById('status').textContent,log:document.getElementById('log').textContent.slice(-1500)}))));}
   const start=await tab.evaluate(()=>window.dhdStatus);
   if(pressure){
    // The CLI keeps its tabs visible; inject only visibility to exercise the shared flag.
    await tab.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await tab.waitForTimeout(6000);
    const hidden=await tab.evaluate(()=>({hidden:document.hidden,scale:window.dhdStatus.scale}));
    if(!hidden.hidden||hidden.scale!==4)throw Error('Background tab changed automatic quality');
    await tab.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    await tab.waitForFunction(()=>window.dhdStatus?.scale<=2,null,{timeout:20000});
    await tab.waitForFunction(()=>window.dhdStatus?.scale===1,null,{timeout:20000});
   }else await tab.waitForTimeout(6000);
   const end=await tab.evaluate(()=>window.dhdStatus);
   if(end.field<=start.field||end.riding)throw Error('Menu/field precondition failed');
   if(!pressure&&end.fps>=48&&end.scale!==4)throw Error('Healthy menu was unnecessarily downscaled');
   results.push({injectedPresentationFps:pressure?12:null,actualMeasuredFps:end.fps,initialScale:start.scale,finalScale:end.scale,backgroundIgnored:pressure,visibilityInjected:pressure,menu:true,fieldsAdvanced:end.field-start.field});
  }finally{await context.close();}
 }
 return {passed:true,results,physicalLowPerformanceDeviceTested:false};
}
