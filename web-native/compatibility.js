// SPDX-License-Identifier: GPL-3.0-or-later
import {probeAtomicShader,graphicsFailureMessage} from './gpu-probe.js';
export async function checkCompatibility(scope=globalThis){
 const errors=[],warnings=[],nav=scope.navigator||{},wasm=scope.WebAssembly;
 if(!scope.isSecureContext)errors.push('Abre el enlace HTTPS o usa localhost.');
 if(!scope.crossOriginIsolated||typeof scope.SharedArrayBuffer!=='function')errors.push('Falta el aislamiento del sitio. El servidor debe enviar COOP y COEP; evita abrirlo dentro de otra página.');
 if(typeof wasm?.Suspending!=='function'||typeof wasm?.promising!=='function')errors.push('Falta WebAssembly JSPI. Actualiza Chrome o Brave; si tu teléfono no ofrece esta función, usa un equipo compatible.');
 if(typeof scope.Worker!=='function'||typeof scope.OffscreenCanvas!=='function'||typeof scope.HTMLCanvasElement?.prototype.transferControlToOffscreen!=='function')errors.push('El navegador no permite dibujar el juego desde sus trabajadores.');
 if(!nav.gpu?.requestAdapter)errors.push('WebGPU no está disponible. Activa la aceleración gráfica y actualiza el navegador y su controlador.');
 else {let timer;try{
  const adapter=await Promise.race([nav.gpu.requestAdapter(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),8000);})]);
  clearTimeout(timer);
  if(!adapter)errors.push('No se encontró una GPU compatible. Comprueba la aceleración gráfica del navegador.');
  else if(errors.length===0){
   // Bound the wait without leaving a late device alive after a timeout.
   const controller=new AbortController(),probe=probeAtomicShader(adapter,controller.signal);
   await Promise.race([probe,new Promise((_,reject)=>{timer=setTimeout(()=>{const error=Error('La prueba gráfica tardó demasiado. Cierra otras pestañas del juego y vuelve a intentarlo.');controller.abort(error);reject(error);},15000);})]);
  }
 }catch(error){errors.push(graphicsFailureMessage(error));}finally{clearTimeout(timer);}}
 if(typeof scope.SharedArrayBuffer==='function'&&wasm?.Memory)try{new wasm.Memory({initial:1,maximum:1,shared:true});}catch{errors.push('No se permite memoria compartida de WebAssembly.');}
 if(!scope.AudioContext||!scope.AudioWorkletNode)warnings.push('Sonido no disponible en este navegador.');
 if(!scope.indexedDB)warnings.push('El navegador no permite guardar partidas ni conservar recursos.');
 if(!nav.locks)warnings.push('La restauración segura de partidas no está disponible.');
 if((nav.maxTouchPoints||0)>0)warnings.push('Móvil: empieza en resolución x1. El motor puede usar alrededor de 2 GB de memoria; el rendimiento depende del teléfono.');
 return {ok:errors.length===0,errors,warnings};
}
