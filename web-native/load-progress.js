// SPDX-License-Identifier: GPL-3.0-or-later
export async function fetchWithProgress(url,report,fetcher=fetch,{attempts=3,timeoutMs=30000,maxBytes=128*1048576,validate,delay=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 for(let attempt=1;attempt<=attempts;attempt++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);let reader;
  const timed=promise=>new Promise((resolve,reject)=>{const abort=()=>reject(new DOMException('Download timed out','AbortError'));if(controller.signal.aborted){abort();return;}controller.signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(value=>{controller.signal.removeEventListener('abort',abort);resolve(value);},error=>{controller.signal.removeEventListener('abort',abort);reject(error);});});
  try{
   const response=await timed(fetcher(url,{signal:controller.signal}));
   if(!response.ok)throw Object.assign(Error('No se pudo cargar '+url+' ('+response.status+').'),{permanent:response.status<500&&![408,429].includes(response.status)});
   const total=Number(response.headers.get('X-Uncompressed-Length')||(!response.headers.get('Content-Encoding')&&response.headers.get('Content-Length')))||0;
   if(!Number.isSafeInteger(total)||total<0||total>maxBytes)throw Object.assign(Error('Tamaño de descarga inválido: '+url),{permanent:true});
   let bytes;
   if(!response.body){bytes=await timed(response.arrayBuffer());if(bytes.byteLength>maxBytes||total&&bytes.byteLength!==total)throw Error('Descarga incompleta: '+url);}
   else{
    reader=response.body.getReader();const chunks=[],target=total?new Uint8Array(total):null;let received=0,last=-Infinity;
    report({url,received,total,done:false,attempt});
    while(true){const {done,value}=await timed(reader.read());if(done)break;
     if(received+value.length>maxBytes||total&&received+value.length>total)throw Error('Tamaño de descarga incompatible: '+url);
     if(target)target.set(value,received);else chunks.push(value);received+=value.length;
     if(performance.now()-last>80){report({url,received,total,done:false,attempt});last=performance.now();}
    }
    if(total&&received!==total)throw Error('Descarga incompleta: '+url);
    if(target)bytes=target.buffer;else{const merged=new Uint8Array(received);let at=0;for(const chunk of chunks){merged.set(chunk,at);at+=chunk.length;}bytes=merged.buffer;}
   }
   if(validate)await timed(validate(bytes,response));
   report({url,received:bytes.byteLength,total:bytes.byteLength,done:true,attempt});return bytes;
  }catch(error){
   if(reader)reader.cancel().catch(()=>{});
   if(error.permanent||attempt===attempts)throw Error(error.name==='AbortError'?'La descarga tardó demasiado: '+url:error.message);
   report({url,received:0,total:0,done:false,attempt,retrying:true});
  }finally{clearTimeout(timer);}
  await delay(300*2**(attempt-1));
 }
}
