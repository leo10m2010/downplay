// SPDX-License-Identifier: GPL-3.0-or-later
// Chrome integration plus an injected WebKit compiler error; not an iPhone test.
async(page)=>{
 const browser=page.context().browser(),results=[];
 for(const fail of [true,false]){
  const context=await browser.newContext();let coreDownloads=0;
  try{
   if(fail)await context.addInitScript(()=>{
    GPUDevice.prototype.createComputePipelineAsync=async()=>{throw {message:'program_source:38:7: error: field may not be qualified with an address space',stack:'startRenderer@graphics_common.js:27:67'};};
   });
   const tab=await context.newPage();
   tab.on('request',request=>{if(request.url().includes('dhd_core.wasm'))coreDownloads++;});
   await tab.goto('http://127.0.0.1:8096/?env.DHD_SETTINGS=none&env.DHD_SCALE=1');
   if(fail){
    await tab.waitForFunction(()=>window.nativeCompatibility?.ok===false,null,{timeout:20000});
    const copy=await tab.locator('#loading-copy').textContent();
    if(!copy.includes('actualiza iOS')||coreDownloads!==0||await tab.evaluate(()=>Boolean(window.gameWorker)))throw Error('Metal failure was not handled before engine loading');
    results.push({injectedCompilerError:true,coreDownloads,message:copy});
   }else{
    await tab.waitForFunction(()=>window.dhdStatus?.field>30,null,{timeout:60000});
    results.push({injectedCompilerError:false,engineRunning:true,field:await tab.evaluate(()=>window.dhdStatus.field)});
   }
  }finally{await context.close();}
 }
 return {passed:true,physicalIPhoneTested:false,results};
}
