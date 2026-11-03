// SPDX-License-Identifier: GPL-3.0-or-later
// Real resources/core with transport faults injected only in isolated test contexts.
async(page)=>{
 const browser=page.context().browser(),results=[];
 const nav='0:triangle|cross,15:cross,32:cross,3:cross,33:cross,16:cross,1:cross,11:cross,18@4C7F38=0:start,18@4C7F38=1:cross,9/5:cross';
 const address='http://127.0.0.1:8109/?env.DHD_NAV='+encodeURIComponent(nav)+'&env.DHD_RACE_SYNC=1&env.DHD_SCALE=2&env.DHD_SETTINGS=none';
 for(let trial=0;trial<5;trial++)for(const condition of ['slow-blocks','connection-cut','corrupt-response']){
  const context=await browser.newContext();let injected=0;
  try{
   await context.route('**/game-data?*',async route=>{
    if(route.request().method()!=='GET'){await route.continue();return;}
    if(condition==='connection-cut'&&injected<2){injected++;await route.abort('connectionreset');return;}
    const response=await route.fetch();
    if(condition==='slow-blocks'){await page.waitForTimeout(250);injected++;}
    if(condition==='corrupt-response'&&injected===0){
     injected++;const data=await response.body();data[0]^=255;
     await route.fulfill({response,body:data});return;
    }
    await route.fulfill({response});
   });
   const tab=await context.newPage(),start=Date.now();await tab.goto(address);
   await tab.waitForFunction(()=>window.dhdStatus?.riding||document.getElementById('status').textContent.startsWith('stopped'),null,{timeout:180000});
   const state=await tab.evaluate(()=>({riding:window.dhdStatus?.riding,resources:window.nativeResourceProgress,status:document.getElementById('status').textContent}));
   if(!state.riding||!injected)throw Error('Fault scenario did not recover: '+condition+' '+JSON.stringify(state));
   if(condition!=='slow-blocks'&&(state.resources.retries<1||state.resources.retries>4))throw Error('Retry accounting not bounded');
   results.push({trial,condition,injected,raceMs:Date.now()-start,resources:state.resources});
  }finally{await context.close();}
 }
 return {passed:true,physicalClientPcs:1,artificialBlockDelayMs:250,results};
}
