// SPDX-License-Identifier: GPL-3.0-or-later
async(page)=>{
 await page.bringToFront();
 const nav='0:triangle|cross,15:cross,32:cross,3:cross,33:cross,16:cross,1:cross,11:cross,18@4C7F38=0:start,18@4C7F38=1:cross,9/5:cross';
 await page.goto('http://127.0.0.1:8095/?env.DHD_NAV='+encodeURIComponent(nav)+'&env.DHD_RACE_SYNC=1&env.DHD_RACE_PAD=0%3A400%3Across&env.DHD_SCALE=4');
 await page.waitForFunction(()=>window.nativeLoadProgress&&Object.values(window.nativeLoadProgress).length===2&&Object.values(window.nativeLoadProgress).every(p=>p.done),null,{timeout:30000});
 await page.waitForFunction(()=>typeof window.nativeAudioDiagnostics==='function');
 if(await page.locator('#soundButton').isVisible())await page.locator('#soundButton').click();
 else await page.locator('#screen').focus();
 await page.waitForFunction(()=>window.nativeAudioDiagnostics().state==='running');
 const downloads=await page.evaluate(()=>window.nativeLoadProgress);
 if(Object.values(downloads).some(p=>p.received!==p.total||p.total<=0))throw Error('Invalid load accounting');
 await page.waitForFunction(()=>document.getElementById('log').textContent.includes('compare: race anchor=g')||document.getElementById('status').textContent.startsWith('stopped'),null,{timeout:90000});
 if(!await page.evaluate(()=>document.getElementById('log').textContent.includes('compare: race anchor=g')))throw Error(await page.locator('#status').textContent());
 await page.waitForTimeout(1000);
 const first=await page.evaluate(()=>window.dhdStatus);
 if(!first.bootMs||!first.memoryBytes)throw Error('Boot/memory metrics absent');
 await page.screenshot({path:'output/playwright/native-runtime-improved.png',fullPage:true});
 // Validate the backup button with existing user saves only; do not create game files.
 await page.locator('.diagnostics summary').click();
 const cards=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('downhill-revived',1);r.onsuccess=()=>{const db=r.result;const q=db.transaction('files').objectStore('files').getAll();q.onsuccess=()=>{const n=q.result.filter(f=>!f.dir).length;db.close();resolve(n);};q.onerror=()=>reject(q.error);};r.onerror=()=>reject(r.error);}));
 let backup=false;
 if(cards){const download=page.waitForEvent('download');await page.locator('#backupButton').click();const file=await download;backup=file.suggestedFilename()==='downhill-partidas.json';if(!backup)throw Error('Missing save backup');}
 else{await page.locator('#backupButton').click();await page.waitForFunction(()=>document.getElementById('backup-message').textContent.includes('Todavía no hay'));}
 return {downloads,audio:await page.evaluate(()=>window.nativeAudioDiagnostics()),first,backup,saveFiles:cards};
}
