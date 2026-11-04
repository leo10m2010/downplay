// SPDX-License-Identifier: GPL-3.0-or-later
import {fetchWithProgress} from './load-progress.js';
const request=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const finished=tx=>{const done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||Error('Caché no disponible'));});done.catch(()=>{});return done;};
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
async function transaction(db,apply){const tx=db.transaction(['blocks','meta'],'readwrite'),done=finished(tx);try{await apply(tx);await done;}catch(error){try{tx.abort();}catch{}await done.catch(()=>{});throw error;}}
export async function createBlockCache({limit=128*1048576,name='downhill-resources-v1'}={}){
 let db;
 try{db=await new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);let expired=false;const timer=setTimeout(()=>{expired=true;reject(Error('Storage busy'));},2000);r.onupgradeneeded=()=>{const s=r.result.createObjectStore('blocks',{keyPath:'id'});s.createIndex('at','at');r.result.createObjectStore('meta');};r.onsuccess=()=>{clearTimeout(timer);if(expired)r.result.close();else resolve(r.result);};r.onerror=()=>{clearTimeout(timer);reject(r.error);};});}catch{return null;}
 return {async get(id){const value=await request(db.transaction('blocks').objectStore('blocks').get(id));if(!value)return null;
   if(await hash(value.bytes)!==value.sha256){await this.remove(id);return null;}return new Uint8Array(value.bytes);
  },async remove(id){await transaction(db,async tx=>{const store=tx.objectStore('blocks'),meta=tx.objectStore('meta');const value=await request(store.get(id)),used=await request(meta.get('bytes'))||0;if(value){store.delete(id);meta.put(Math.max(0,used-value.bytes.byteLength),'bytes');}});
  },async put(id,bytes,sha256){if(bytes.byteLength>limit)return;
   await transaction(db,async tx=>{const store=tx.objectStore('blocks'),meta=tx.objectStore('meta');
   if(await request(store.get(id)))return;
   let used=await request(meta.get('bytes'))||0;
   if(used+bytes.byteLength>limit)await new Promise((resolve,reject)=>{const r=store.index('at').openCursor();r.onerror=()=>reject(r.error);r.onsuccess=()=>{const c=r.result;if(!c||used+bytes.byteLength<=limit){resolve();return;}used-=c.value.bytes.byteLength;c.delete();c.continue();};});
   store.put({id,bytes,sha256,at:Date.now()});meta.put(used+bytes.byteLength,'bytes');});
  },close(){db.close();}};
}
// Cache writes are expendable and never hold up a game read.
export function createCacheWriteQueue(write,onError,maximum=2){
 let active=0,disabled=false;const jobs=new Set();
 return {enqueue(...args){if(disabled||active>=maximum)return false;active++;
  const job=Promise.resolve().then(()=>write(...args)).catch(error=>{disabled=true;onError(error);}).finally(()=>{active--;jobs.delete(job);});jobs.add(job);return true;
 },get pending(){return active;},async drain(){await Promise.all([...jobs]);}};
}
export function createRequestGate(maximum=2){
 let active=0;const demand=[],background=[];
 const pump=()=>{while(active<maximum&&(demand.length||background.length)){const job=(demand.length?demand:background).shift();active++;Promise.resolve().then(job.action).then(job.resolve,job.reject).finally(()=>{active--;pump();});}};
 return (action,prefetch=false)=>new Promise((resolve,reject)=>{(prefetch?background:demand).push({action,resolve,reject});pump();});
}
// Return synchronously only when the whole requested range is already in RAM.
// A miss leaves the destination untouched so the ordinary verified loader can run.
export function copyCachedRange(memory,blockSize,size,pos,out){
 if(!Number.isSafeInteger(pos)||pos<0)throw Error('Posición de lectura inválida.');
 const length=Math.max(0,Math.min(out.length,size-pos));if(!length)return 0;
 let done=0;
 while(done<length){
  const at=pos+done,index=Math.floor(at/blockSize),bytes=memory.get(index),offset=at%blockSize;
  if(!bytes)return null;
  const n=Math.min(length-done,bytes.length-offset);if(n<=0)throw Error('Recurso incompleto.');
  done+=n;
 }
 done=0;
 // No await between validation and copying: the map cannot change underneath us.
 while(done<length){const at=pos+done,index=Math.floor(at/blockSize),bytes=memory.get(index),offset=at%blockSize,n=Math.min(length-done,bytes.length-offset);out.set(bytes.subarray(offset,offset+n),done);done+=n;memory.delete(index);memory.set(index,bytes);}
 return done;
}
export async function createResourceSource(m,report){
 if(m.file)throw Error('Esta versión utiliza recursos preparados en el servidor.');
 const identityResponse=await fetch('game-identity.json',{cache:'no-store'});if(!identityResponse.ok)throw Error('No se pudo verificar la versión de los recursos.');
 const identity=await identityResponse.json(),version=identity.resourceSha256;
 if(!/^[a-f0-9]{64}$/.test(version||''))throw Error('Actualiza el servidor: falta la identidad de los recursos.');
 const resourceUrl=m.isoUrl+'?version='+version;
 const head=await fetch(resourceUrl,{method:'HEAD',cache:'no-store'}),size=Number(head.headers.get('Content-Length'));
 if(!head.ok||!Number.isSafeInteger(size)||size<=0)throw Error('Recursos ausentes, versión distinta o tamaño inválido. Recarga la página.');
 const BLOCK=1048576,memory=new Map(),inflight=new Map(),gate=createRequestGate(2);let disk=await createBlockCache(),last=-Infinity;
 const stats={networkBytes:0,cacheBytes:0,memoryHits:0,syncReads:0,asyncReads:0,requests:0,retries:0,readMs:0,maxReadMs:0,persistent:Boolean(disk),cacheWriteSkips:0,prefetched:0};
 const publish=force=>{if(force||performance.now()-last>100){last=performance.now();report({...stats,pendingWrites:writes.pending});}};
 const disableDisk=()=>{disk?.close();disk=null;stats.persistent=false;};
 const writes=createCacheWriteQueue(async(...args)=>{if(disk)await disk.put(...args);},disableDisk,2);
 async function load(i,prefetch){
  const id=version+':'+i,at=i*BLOCK,n=Math.min(BLOCK,size-at);let bytes;
  if(disk)try{bytes=await disk.get(id);if(bytes&&bytes.byteLength!==n){await disk.remove(id);bytes=null;}if(bytes)stats.cacheBytes+=bytes.byteLength;}catch{disableDisk();}
  if(!bytes)bytes=await gate(async()=>{
   const start=performance.now();let verified;
   await fetchWithProgress(resourceUrl,p=>{if(p.retrying)stats.retries++;publish();},async(url,options)=>{
    stats.requests++;
    const response=await fetch(url,{...options,cache:'no-store',headers:{Range:`bytes=${at}-${at+n-1}`}});
    if(response.status!==206)throw Object.assign(Error(response.status===412?'Los recursos cambiaron. Recarga la página.':'No se pudo leer el recurso ('+response.status+').'),{permanent:response.status<500&&![408,429].includes(response.status)});
    if(response.headers.get('Content-Range')!==`bytes ${at}-${at+n-1}/${size}`)throw Error('Rango de recurso incompatible.');
    return response;
   },{maxBytes:BLOCK,validate:async(buffer,response)=>{const expected=response.headers.get('X-Content-SHA256');stats.networkBytes+=buffer.byteLength;
    if(buffer.byteLength!==n||!/^[a-f0-9]{64}$/.test(expected||'')||await hash(buffer)!==expected)throw Error('Un recurso llegó dañado. Reintentando su descarga.');
    verified=new Uint8Array(buffer);
    if(disk&&!writes.enqueue(id,verified,expected))stats.cacheWriteSkips++;
   }});
   stats.readMs=performance.now()-start;stats.maxReadMs=Math.max(stats.maxReadMs,stats.readMs);return verified;
  },prefetch);
  memory.set(i,bytes);if(memory.size>48)memory.delete(memory.keys().next().value);if(prefetch)stats.prefetched++;publish(true);return bytes;
 }
 const block=(i,prefetch=false)=>{
  if(memory.has(i)){const value=memory.get(i);memory.delete(i);memory.set(i,value);stats.memoryHits++;return Promise.resolve(value);}
  if(inflight.has(i))return inflight.get(i);
  const job=load(i,prefetch).finally(()=>inflight.delete(i));inflight.set(i,job);return job;
 };
 const prefetch=i=>{if(i*BLOCK<size&&!memory.has(i)&&!inflight.has(i)&&inflight.size<3)block(i,true).catch(()=>{});};
 publish(true);
 return {size,stats,readCached(pos,out){const got=copyCachedRange(memory,BLOCK,size,pos,out);if(got!==null){stats.syncReads++;if(got>0)stats.memoryHits+=Math.ceil((pos%BLOCK+got)/BLOCK);}return got;},async flush(){await writes.drain();},async read(pos,out){if(!Number.isSafeInteger(pos)||pos<0)throw Error('Posición de lectura inválida.');stats.asyncReads++;let done=0;
  const finalBlock=Math.floor((Math.min(size,pos+out.length)-1)/BLOCK);
  while(done<out.length&&pos+done<size){const at=pos+done,i=Math.floor(at/BLOCK),pending=block(i);if(i+1<=finalBlock)prefetch(i+1);if(i+2<=finalBlock)prefetch(i+2);const b=await pending,off=at%BLOCK,n=Math.min(out.length-done,b.length-off);if(n<=0)throw Error('Recurso incompleto.');out.set(b.subarray(off,off+n),done);done+=n;
  }return done;
 }};
}
