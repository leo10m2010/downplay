// SPDX-License-Identifier: GPL-3.0-or-later
async(page)=>{
 const browser=page.context().browser(),results=[];
 for(const missing of ['gpu','isolation','jspi']){
  const context=await browser.newContext(),tab=await context.newPage();let largeDownloads=0;
  try{
   await context.addInitScript(kind=>{if(kind==='gpu')Object.defineProperty(navigator,'gpu',{value:undefined});if(kind==='isolation')Object.defineProperty(globalThis,'crossOriginIsolated',{value:false});if(kind==='jspi')Object.defineProperty(WebAssembly,'Suspending',{value:undefined});},missing);
   tab.on('request',request=>{if(request.url().includes('dhd_core.wasm'))largeDownloads++;});
   await tab.goto('http://127.0.0.1:8109/');await tab.waitForFunction(()=>window.nativeCompatibility?.ok===false);
   await tab.waitForTimeout(300);
   if(largeDownloads!==0||await tab.evaluate(()=>Boolean(window.gameWorker)))throw Error('Engine started despite incompatible browser');
   results.push({missing,downloads:largeDownloads,message:await tab.locator('#loading-copy').textContent()});
  }finally{await context.close();}
 }
 return {passed:true,results};
}
