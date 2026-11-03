// SPDX-License-Identifier: GPL-3.0-or-later
// Starts a real individual race; the sampler stays on the page for 60 minutes.
async(page)=>{
 for(const p of page.context().pages())if(p!==page)await p.close();await page.bringToFront();
 const nav='0:triangle|cross,15:cross,32:cross,3:cross,33:cross,16:cross,1:cross,11:cross,18@4C7F38=0:start,18@4C7F38=1:cross,9/5:cross';
 await page.goto('http://127.0.0.1:8109/?env.DHD_NAV='+encodeURIComponent(nav)+'&env.DHD_RACE_SYNC=1&env.DHD_RACE_PAD=0%3A400%3Across&env.DHD_SCALE=4');
 await page.waitForFunction(()=>window.dhdStatus?.riding,null,{timeout:150000});
 if(await page.locator('#soundButton').isVisible())await page.locator('#soundButton').click();
 await page.waitForFunction(()=>window.nativeAudioDiagnostics?.().state==='running');
 await page.evaluate(()=>{
  const started=performance.now(),samples=[];let count=0;
  const sample=()=>{const game=window.dhdStatus,audio=window.nativeAudioDiagnostics?.();samples.push({atMs:performance.now()-started,field:game?.field,fps:game?.fps,scale:game?.scale,memoryBytes:game?.memoryBytes,frameMetrics:game?.frameMetrics,audio,resource:window.nativeResourceProgress,status:document.getElementById('status').textContent,logBytes:document.getElementById('log').textContent.length,history:window.dhdHistory?.length,jsHeapBytes:performance.memory?.usedJSHeapSize,hidden:document.hidden});if(samples.length>400)samples.shift();count++;};sample();
  const timer=setInterval(sample,10000);
  window.nativeSoakReport=()=>({kind:'individual',targetMs:3600000,elapsedMs:performance.now()-started,count,samples});
  window.nativeStopSoak=()=>{clearInterval(timer);sample();return window.nativeSoakReport();};
 });
 return {started:true,targetMinutes:60,game:await page.evaluate(()=>window.dhdStatus)};
}
