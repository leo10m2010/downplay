// SPDX-License-Identifier: GPL-3.0-or-later
const LIMIT=16*1024*1024,MAX_TEXT=24*1024*1024;
const result=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const complete=tx=>{const done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error||Error('No se pudo escribir la partida.'));});done.catch(()=>{});return done;};
export function storageError(error){
 if(error?.name==='QuotaExceededError')return Error('No queda espacio para guardar. Libera espacio del navegador; tus partidas anteriores se conservaron.');
 if(['SecurityError','NotAllowedError'].includes(error?.name))return Error('El navegador bloquea el almacenamiento. Permite los datos de este sitio y vuelve a intentarlo.');return error;
}
async function write(db,store,apply){
 const tx=db.transaction(store,'readwrite'),done=complete(tx);
 try{apply(tx.objectStore(store));await done;}catch(error){try{tx.abort();}catch{}await done.catch(()=>{});throw storageError(error);}
}
async function open(name='downhill-revived',store='files'){
 return new Promise((resolve,reject)=>{const request=indexedDB.open(name,1);let expired=false;const timer=setTimeout(()=>{expired=true;reject(Error('El almacenamiento está ocupado. Cierra las otras pestañas del juego y vuelve a intentarlo.'));},8000);
  request.onupgradeneeded=()=>request.result.createObjectStore(store);
  request.onsuccess=()=>{clearTimeout(timer);if(expired)request.result.close();else resolve(request.result);};request.onerror=()=>{clearTimeout(timer);reject(storageError(request.error));};
 });
}
async function snapshot(db){
 const tx=db.transaction('files'),done=complete(tx),rows=[],r=tx.objectStore('files').openCursor();
 r.onsuccess=()=>{const c=r.result;if(c){rows.push([c.key,c.value]);c.continue();}};await done;return rows;
}
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async data=>hex(await crypto.subtle.digest('SHA-256',data));
function base64(data){let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));return btoa(binary);}
function decodeBase64(text){const binary=atob(text),data=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)data[i]=binary.charCodeAt(i);return data;}
export async function backupDocument(rows){
 const files=[],directories=[];
 for(const [path,node] of rows){if(node.dir){directories.push({path,name:node.name,time:node.time});continue;}
  const bytes=new Uint8Array(node.data);files.push({path,name:node.name,time:node.time,data:base64(bytes),sha256:await digest(bytes)});
 }
 if(!files.length)throw Error('Todavía no hay partidas guardadas. Guarda desde el menú del juego.');
 return {format:'downhill-memory-card',version:2,created:new Date().toISOString(),files,directories};
}
function pathKey(value){
 if(typeof value!=='string'||value.length>260||/[\\\x00-\x1f:*?"<>|]/.test(value))throw Error('Ruta de guardado inválida.');
 const key=(value.startsWith('/')?value:'/'+value).toLowerCase(),parts=key.slice(1).split('/');
 if(parts.some(p=>!p||p==='.'||p==='..'||p.length>31)||parts[0]!=='saves'||!/^card[12]$/.test(parts[1]||''))throw Error('La copia contiene rutas ajenas a las tarjetas del juego.');return key;
}
export async function validateBackup(text){
 if(typeof text!=='string'||text.length>MAX_TEXT)throw Error('Copia demasiado grande (máximo 24 MiB).');
 let doc;try{doc=JSON.parse(text);}catch{throw Error('El archivo no es una copia JSON válida.');}
 if(doc?.format!=='downhill-memory-card'||![1,2].includes(doc.version)||!Array.isArray(doc.files)||!doc.files.length||doc.files.length>256)throw Error('Formato de copia no compatible.');
 const nodes=new Map(),files=[],cards=new Set();let bytes=0;
 const name=(value,key)=>{if(typeof value!=='string'||value.toLowerCase()!==key.split('/').pop())throw Error('Nombre de guardado incompatible con su ruta.');return value;};
 const time=value=>Number.isFinite(value)&&value>=0&&value<=8640000000000000?value:0;
 if(doc.directories!==undefined){
  if(!Array.isArray(doc.directories)||doc.directories.length>256)throw Error('Directorios de copia inválidos.');
  for(const row of doc.directories){const key=row?.path==='/saves'?'/saves':pathKey(row?.path);if(nodes.has(key))throw Error('Rutas duplicadas en la copia.');nodes.set(key,{name:name(row.name,key),dir:true,time:time(row.time)});if(key!=='/saves')cards.add(key.split('/').slice(0,3).join('/'));}
 }
 for(const row of doc.files){
  const key=pathKey(row?.path),encoded=row?.data,pad=typeof encoded==='string'?encoded.indexOf('='):-1;
  if(key.split('/').length<4||nodes.has(key)||typeof encoded!=='string'||encoded.length>Math.ceil(LIMIT/3)*4||encoded.length%4||/[^A-Za-z0-9+/=]/.test(encoded)||(pad>=0&&(pad<encoded.length-2||!/^={1,2}$/.test(encoded.slice(pad)))))throw Error('Archivo duplicado o datos de partida inválidos.');
  const data=decodeBase64(row.data);bytes+=data.byteLength;if(bytes>LIMIT)throw Error('Las tarjetas superan 16 MiB.');
  if(doc.version===2&&(!/^[a-f0-9]{64}$/.test(row.sha256||'')||await digest(data)!==row.sha256))throw Error('La copia está dañada: '+row.name);
  nodes.set(key,{name:name(row.name,key),time:time(row.time),data});files.push(key);cards.add(key.split('/').slice(0,3).join('/'));
 }
 for(const key of files){const parts=key.split('/');for(let i=2;i<parts.length;i++){
  const parent=parts.slice(0,i).join('/'),old=nodes.get(parent);if(old&&!old.dir)throw Error('Un archivo ocupa el lugar de una carpeta.');
  if(!old){const part=parts[i-1];nodes.set(parent,{name:i===4?part.toUpperCase():part,dir:true,time:0});}
 }}
 for(const [key,node] of nodes)if(node.dir&&key!=='/saves'&&![...cards].some(card=>key===card||key.startsWith(card+'/')))throw Error('Carpeta ajena a las tarjetas incluidas.');
 return {nodes:[...nodes],cards:[...cards],fileCount:files.length,bytes,legacy:doc.version===1};
}
export async function restoreSaves(text){
 const checked=await validateBackup(text),{withStoppedGame}=await import('./runtime-session.js');
 return withStoppedGame(async()=>{
  const db=await open();try{
   const before=await snapshot(db),backup=await open('downhill-save-recovery','backups');
   try{await write(backup,'backups',store=>store.put({created:Date.now(),rows:before},'before-import'));}finally{backup.close();}
   await write(db,'files',store=>{for(const [key] of before)if(checked.cards.some(card=>key===card||key.startsWith(card+'/')))store.delete(key);for(const [key,node] of checked.nodes)store.put(node,key);});return checked;
  }finally{db.close();}
 });
}
async function download(doc){
 const blob=new Blob([JSON.stringify(doc)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='downhill-partidas.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);return doc.files.length;
}
export async function exportSaves(){const db=await open();try{return await download(await backupDocument(await snapshot(db)));}finally{db.close();}}
export async function exportPreviousSaves(){
 const db=await open('downhill-save-recovery','backups');try{const row=await result(db.transaction('backups').objectStore('backups').get('before-import'));if(!row)throw Error('Todavía no hay una copia anterior a una restauración.');return await download(await backupDocument(row.rows));}finally{db.close();}
}
