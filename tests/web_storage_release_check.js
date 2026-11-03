// SPDX-License-Identifier: GPL-3.0-or-later
// Isolated synthetic storage fixtures. This test does not run or imitate a game.
async(page)=>{
 const context=await page.context().browser().newContext({acceptDownloads:true}),base='http://127.0.0.1:8109/';
 await context.route('**/bootstrap.js',route=>route.fulfill({contentType:'text/javascript',body:"import './ui.js';import {acquireGameLease} from './runtime-session.js';await acquireGameLease();window.storageTestReady=true;"}));
 const tab=await context.newPage();
 try{
  await tab.goto(base);await tab.waitForFunction(()=>window.storageTestReady);
  const fixture=await tab.evaluate(async()=>{
   const {backupDocument}=await import('./save-store.js');
   const rows=[['/saves',{name:'saves',dir:true}],['/saves/card1',{name:'card1',dir:true}],['/saves/card1/bascus-97177dhd',{name:'BASCUS-97177DHD',dir:true}],['/saves/card1/bascus-97177dhd/data',{name:'DATA',data:Uint8Array.from([9,8,7]),time:123}],['/saves/card2',{name:'card2',dir:true}],['/saves/card2/keep',{name:'KEEP',data:Uint8Array.from([5,4]),time:123}]];
   await new Promise((resolve,reject)=>{const r=indexedDB.open('downhill-revived',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>{const db=r.result,tx=db.transaction('files','readwrite');for(const [k,v] of rows)tx.objectStore('files').put(v,k);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
   return JSON.stringify(await backupDocument([['/saves/card1/bascus-97177dhd/data',{name:'DATA',data:Uint8Array.from([0,1,128,255]),time:777}]]));
  });
  const other=await context.newPage();await other.goto(base);await other.waitForFunction(()=>window.storageTestReady);
  await tab.evaluate(text=>{const transfer=new DataTransfer();transfer.items.add(new File([text],'partidas.json',{type:'application/json'}));const input=document.getElementById('restore-file');input.files=transfer.files;input.dispatchEvent(new Event('change'));},fixture);
  await tab.locator('#restore-panel').waitFor({state:'visible'});
  if(!(await tab.locator('#restore-summary').textContent()).includes('Tarjetas 1 ·'))throw Error('Restore review does not identify the affected card');
  const navigation=tab.waitForEvent('framenavigated');await tab.getByRole('button',{name:'Restaurar y reiniciar',exact:true}).click();await navigation;
  await tab.waitForFunction(()=>window.storageTestReady);await other.waitForFunction(()=>window.nativeSessionStopped);
  const restored=await tab.evaluate(async()=>{
   const {createVfs}=await import('./vfs.js'),vfs=await createVfs(()=>{}),out=new Uint8Array(4);vfs.read(vfs.open('/saves/card1/BASCUS-97177DHD/DATA',1),out);
   const keep=new Uint8Array(2);vfs.read(vfs.open('/saves/card2/KEEP',1),keep);
   return {data:[...out],keep:[...keep],folders:vfs.list('/saves/card1').map(n=>n.name)};
  });
  if(JSON.stringify(restored.data)!=='[0,1,128,255]'||JSON.stringify(restored.keep)!=='[5,4]'||!restored.folders.includes('BASCUS-97177DHD'))throw Error('Restored VFS differs from backup');
  const atomic=await tab.evaluate(async text=>{
   const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){if(this.name==='files'&&String(key).endsWith('/data'))throw new DOMException('Injected full disk','QuotaExceededError');return original.call(this,value,key);};
   let error='';try{await (await import('./save-store.js')).restoreSaves(text);}catch(e){error=e.message;}finally{IDBObjectStore.prototype.put=original;}
   const {createVfs}=await import('./vfs.js'),vfs=await createVfs(()=>{}),out=new Uint8Array(4);vfs.read(vfs.open('/saves/card1/BASCUS-97177DHD/DATA',1),out);return {error,data:[...out]};
  },fixture);
  if(!atomic.error.includes('espacio')||JSON.stringify(atomic.data)!=='[0,1,128,255]')throw Error('Failed restore modified existing data');
  const cache=await tab.evaluate(async()=>{
   const {createBlockCache}=await import('./resource-cache.js'),name='downhill-cache-test',cache=await createBlockCache({name,limit:8});
   const bytes=Uint8Array.from([1,2,3,4]),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
   for(const key of ['a','b','c'])await cache.put(key,bytes,digest);
   if(await cache.get('a'))throw Error('Cache exceeded its limit');
   await new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('blocks','readwrite'),store=tx.objectStore('blocks'),q=store.get('c');q.onsuccess=()=>{const v=q.result;v.bytes[0]=99;store.put(v);};tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
   if(await cache.get('c'))throw Error('Corrupt cache entry was accepted');cache.close();
   const reopened=await createBlockCache({name,limit:8}),value=await reopened.get('b');reopened.close();if(value?.[0]!==1)throw Error('Cache did not persist');return true;
  });
  const emptyCardRoundTrip=await tab.evaluate(async()=>{
   const {backupDocument,validateBackup,restoreSaves}=await import('./save-store.js');
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('downhill-revived',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   await new Promise((resolve,reject)=>{const t=db.transaction('files','readwrite'),s=t.objectStore('files');s.delete('/saves/card2/keep');s.put({name:'EMPTY',dir:true,time:42},'/saves/card2/empty');t.oncomplete=resolve;t.onabort=()=>reject(t.error);});
   const rows=await new Promise((resolve,reject)=>{const rows=[],r=db.transaction('files').objectStore('files').openCursor();r.onsuccess=()=>{const c=r.result;if(c){rows.push([c.key,c.value]);c.continue();}else resolve(rows);};r.onerror=()=>reject(r.error);});
   const document=JSON.stringify(await backupDocument(rows)),checked=await validateBackup(document);db.close();await restoreSaves(document);
   if(checked.cards.length!==2||!checked.nodes.some(([k,n])=>k==='/saves/card2/empty'&&n.name==='EMPTY'&&n.time===42))throw Error('Empty card directories did not survive export/restore');return true;
  });
  return {passed:true,restored,atomic,cache,emptyCardRoundTrip,otherTabStopped:await other.evaluate(()=>window.nativeSessionStopped)};
 }finally{await context.close();}
}
