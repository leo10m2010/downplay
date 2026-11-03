// SPDX-License-Identifier: GPL-3.0-or-later
const LOCK='downhill-memory-card-v1';let release,channel;
export async function stopGame(reason='Partida detenida para restaurar los guardados.'){
 window.nativeSessionStopped=true;window.gameWorker?.terminate();
 release?.();release=null;await window.nativeAudioContext?.close().catch(()=>{});
 dispatchEvent(new CustomEvent('runtime-stopped',{detail:reason}));
}
export async function acquireGameLease(){
 if(!navigator.locks)return;
 await new Promise((resolve,reject)=>{navigator.locks.request(LOCK,{mode:'shared'},()=>{if(window.nativeSessionStopped){resolve();return;}return new Promise(done=>{release=done;resolve();});}).catch(reject);});
}
export async function withStoppedGame(action){
 if(!navigator.locks)throw Error('Este navegador no permite restaurar con seguridad. Usa Chrome o Edge actualizado.');
 channel?.postMessage('restore-stop');await stopGame();
 try{return await navigator.locks.request(LOCK,{mode:'exclusive',signal:AbortSignal.timeout(8000)},action);}
 catch(error){if(error.name==='TimeoutError'||error.name==='AbortError')throw Error('Cierra las otras pestañas del juego y vuelve a restaurar. No se modificó ninguna partida.');throw error;}
}
if(typeof window!=='undefined'){
 if(typeof BroadcastChannel==='function'){channel=new BroadcastChannel(LOCK);channel.onmessage=e=>{if(e.data==='restore-stop')stopGame();};}
 addEventListener('pagehide',()=>{stopGame();channel?.close();});
 addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
}
