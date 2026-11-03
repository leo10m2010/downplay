// SPDX-License-Identifier: GPL-3.0-or-later
// Five cold/warm pairs per build, alternating order; real original race navigation.
async(page)=>{
 const browser=page.context().browser(),results=[];
 const nav='0:triangle|cross,15:cross,32:cross,3:cross,33:cross,16:cross,1:cross,11:cross,18@4C7F38=0:start,18@4C7F38=1:cross,9/5:cross';
 for(let trial=0;trial<5;trial++)for(const build of trial%2?['candidate','baseline']:['baseline','candidate']){
  const context=await browser.newContext();
  try{for(const visit of ['cold','warm']){
   const tab=await context.newPage();let dataBytes=0,requests=0;
   tab.on('response',response=>{if(response.status()===206&&response.url().includes('/game-data')){requests++;dataBytes+=Number(response.headers()['content-length'])||0;}});
   const started=Date.now(),port=build==='candidate'?8109:8106;
   await tab.goto('http://127.0.0.1:'+port+'/?env.DHD_NAV='+encodeURIComponent(nav)+'&env.DHD_RACE_SYNC=1&env.DHD_RACE_PAD=0%3A400%3Across&env.DHD_SCALE=2&env.DHD_SETTINGS=none');
   await tab.waitForFunction(()=>window.dhdStatus?.riding||document.getElementById('status').textContent.startsWith('stopped'),null,{timeout:180000});
   if(!await tab.evaluate(()=>window.dhdStatus?.riding))throw Error('Benchmark engine stopped');
   const raceMs=Date.now()-started;await tab.waitForTimeout(500);
   results.push({trial,build,visit,raceMs,dataBytes,requests,game:await tab.evaluate(()=>({bootMs:window.dhdStatus.bootMs,fps:window.dhdStatus.fps,resource:window.nativeResourceProgress,phases:window.dhdStatus.loadTimings}))});
   await tab.close();
  }}finally{await context.close();}
 }
 return {passed:true,physicalClientPcs:1,concurrentSoakLoad:true,results};
}
