// SPDX-License-Identifier: GPL-3.0-or-later
// Manual A/B: serve preserved 0.7.2 on 8097 and candidate on 8096. Injected delay, not hardware emulation.
async(page)=>{
 await page.goto('about:blank');const results=[],browser=page.context().browser();
 const nav='0:triangle|cross,15:cross,32:cross,3:cross,33:cross,16:cross,1:cross,11:cross,18@4C7F38=0:start,18@4C7F38=1:cross,9/5:cross';
 for(const port of [8097,8096]){
  const context=await browser.newContext();
  try{
   await context.route('**/worker.js',async route=>{
    const response=await route.fetch(),old=await response.text();const source=old.replace('host_service_gs_vsync: new WebAssembly.Suspending(async () => {','host_service_gs_vsync: new WebAssembly.Suspending(async () => { await new Promise(r=>setTimeout(r,24));');
    if(source===old)throw Error('Delay insertion failed');const headers={...response.headers()};delete headers['content-encoding'];delete headers['content-length'];await route.fulfill({status:200,headers,body:source});
   });
   const tab=await context.newPage();await tab.bringToFront();await tab.goto('http://127.0.0.1:'+port+'/?env.DHD_NAV='+encodeURIComponent(nav)+'&env.DHD_RACE_SYNC=1&env.DHD_RACE_PAD=0%3A400%3Across&env.DHD_SCALE=1&env.DHD_AUTO_QUALITY=0&env.DHD_SETTINGS=none');
   await tab.waitForFunction(()=>window.dhdStatus?.riding||document.getElementById('status').textContent.startsWith('stopped'),null,{timeout:90000});if(!await tab.evaluate(()=>window.dhdStatus?.riding))throw Error(await tab.locator('#log').textContent());
   if(await tab.locator('#soundButton').isVisible())await tab.locator('#soundButton').click();await tab.waitForTimeout(10000);
   const start=await tab.evaluate(()=>({time:performance.now(),game:window.dhdStatus,audio:window.nativeAudioDiagnostics?.()}));await tab.waitForTimeout(12000);
   const end=await tab.evaluate(()=>({time:performance.now(),game:window.dhdStatus,audio:window.nativeAudioDiagnostics?.()})),seconds=(end.time-start.time)/1000;
   results.push({port,seconds,fps:end.game.fps,producedAudioPerWallSecond:(end.game.sound-start.game.sound)/seconds,audioUnderruns:end.audio.underruns-start.audio.underruns,fields:end.game.field-start.game.field});
  }finally{await context.close();}
 }
 if(results[1].producedAudioPerWallSecond<.9||results[0].producedAudioPerWallSecond>.85)throw Error('Clock correction not verified: '+JSON.stringify(results));
 return {passed:true,injectedDelayMs:24,physicalI5Tested:false,results};
}