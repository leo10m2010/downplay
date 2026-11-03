// SPDX-License-Identifier: GPL-3.0-or-later
import {installSaveUI} from './save-ui.js';
const $=id=>document.getElementById(id),panel=$('controls');
$('retryButton').onclick=()=>location.reload();
installSaveUI();
addEventListener('error',event=>{if(!document.body.dataset.preview&&!window.nativeSessionStopped)$('status').textContent='ERROR: '+(event.message||'No se pudo iniciar o continuar el motor.');});
addEventListener('unhandledrejection',event=>{if(!document.body.dataset.preview&&!window.nativeSessionStopped)$('status').textContent='ERROR: '+(event.reason?.message||'No se pudo completar la carga.');});
addEventListener('runtime-stopped',event=>{$('status').textContent='stopped: '+event.detail;});
$('open-keyboard').onclick=()=>{panel.hidden=false;$('close-controls').focus();};
$('close-controls').onclick=()=>{panel.hidden=true;$('controlsButton').focus();};
$('controlsButton').addEventListener('click',()=>queueMicrotask(()=>{if(!panel.hidden)$('close-controls').focus();}));
// Keep the configuration usable with keyboard navigation and release Escape
// to the game only when the configuration is closed.
panel.addEventListener('keydown',e=>{if(e.key==='Tab'){const items=[...panel.querySelectorAll('button,input')].filter(x=>!x.disabled);if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}}});
setInterval(()=>{
 const game=window.dhdStatus,status=$('status').textContent;
 if(document.body.dataset.preview)return;
 const failed=window.nativeSessionStopped||/stopped|ERROR|failed|game exited/i.test(status);
 document.body.classList.toggle('ready',Boolean(game)&&!failed);
 $('retryButton').hidden=!failed;
 $('engine-state').textContent=failed?'No se pudo continuar':game?(game.riding?'En pista':'Menú original'):'Preparando motor';
 $('engine-rate').textContent=game?`${game.fps.toFixed(0)} Hz`:'— Hz';
 if(game)$('runtime-metrics').textContent=`Resolución x${game.scale} · memoria del motor ${(game.memoryBytes/1048576).toFixed(0)} MiB · registro limitado a 120 muestras`;
 const audio=window.nativeAudioDiagnostics?.();if(game){const f=game.frameMetrics;$('runtime-metrics').textContent+=f?` · fotograma p95 ${f.p95Ms.toFixed(1)} ms · ${f.stalls} pausas >50 ms`:'';if(audio)$('runtime-metrics').textContent+=` · audio: ${audio.underruns||0} cortes, ${(audio.queuedMs||0).toFixed(0)} ms en cola`;}
 const resource=window.nativeResourceProgress;if(resource)$('resource-metrics').textContent=`Recursos: ${(resource.networkBytes/1048576).toFixed(1)} MiB de red · ${(resource.cacheBytes/1048576).toFixed(1)} MiB de caché local · ${resource.retries} reintentos`;
 const downloads=Object.values(window.nativeLoadProgress||{}),bar=$('load-progress');
 if(failed){$('loading-copy').textContent=window.nativeSessionStopped?'Partida detenida. Recarga la página para continuar.':window.nativeCompatibility?.ok===false?window.nativeCompatibility.errors.join(' '):'El motor se detuvo. Puedes reintentar; tus guardados permanecen en este navegador.';bar.hidden=true;}
 else if(downloads.length&&!game){const received=downloads.reduce((sum,p)=>sum+p.received,0),total=downloads.reduce((sum,p)=>sum+p.total,0),done=downloads.length===2&&downloads.every(p=>p.done);
  bar.hidden=false;if(total&&!done){bar.max=total;bar.value=Math.min(received,total);}else bar.removeAttribute('value');
  $('loading-copy').textContent=done?(window.nativeLoadStage||'Motor descargado. Preparando gráficos y recursos…'):`Descargando motor: ${(received/1048576).toFixed(1)}${total?' / '+(total/1048576).toFixed(1):''} MB`;
 }
},500);
