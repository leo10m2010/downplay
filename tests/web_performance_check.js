// SPDX-License-Identifier: GPL-3.0-or-later
// Same original course/core/resources on baseline 8097 and candidate 8096.
// Local measurements do not reproduce the user's slower PC or Internet link.
async(page)=>{
 const browser=page.context().browser(),results=[];
 await page.goto('about:blank');
 const nav='0:triangle|cross,15:cross,32:cross,3:cross,33:cross,16:cross,1:cross,11:cross,18@4C7F38=0:start,18@4C7F38=1:cross,9/5:cross';
 for(const port of [8097,8096]){
  const context=await browser.newContext();
  try{
   const tab=await context.newPage();await tab.bringToFront();const errors=[];tab.on('pageerror',error=>errors.push(error.message));
   const start=Date.now();await tab.goto('http://127.0.0.1:'+port+'/?env.DHD_NAV='+encodeURIComponent(nav)+'&env.DHD_RACE_SYNC=1&env.DHD_RACE_PAD=0%3A400%3Across&env.DHD_SETTINGS=none&env.DHD_FPS=144');
   await tab.waitForFunction(()=>window.dhdStatus?.riding,null,{timeout:90000});
   const raceMs=Date.now()-start;await tab.waitForTimeout(12000);
   const samples=[];for(let i=0;i<10;i++){samples.push(await tab.evaluate(()=>window.dhdStatus));await tab.waitForTimeout(1000);}
   const fps=samples.map(s=>s.fps).sort((a,b)=>a-b),last=samples.at(-1);
   const log=await tab.locator('#log').textContent();
   if(port===8096){
    if(!last.resourceIO?.syncReads||!last.resourceIO.asyncReads)throw Error('Real game did not use both verified resource paths');
    if(!Number.isFinite(last.presentFps)||last.presentFps<1)throw Error('Presentation metrics absent');
    if(!/fps: requested 60 (?:real steps\/s|steps\/s at most)/.test(log))throw Error('High-refresh setting bypassed the stability cap');
    if(last.scale>2)throw Error('Automatic mode raised above x2');
   }
   if(errors.length)throw Error(errors.join('; '));
   results.push({build:port===8096?'candidate':'baseline',raceMs,medianFps:fps[5],minFps:fps[0],scale:last.scale,presentFps:last.presentFps??null,resourceIO:last.resourceIO??null,frameMetrics:last.frameMetrics,requestedCap:log.match(/fps: requested \d+ real steps\/s/)?.[0]});
  }finally{await context.close();}
 }
 return {passed:true,physicalClientPcs:1,results};
}
