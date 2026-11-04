// SPDX-License-Identifier: GPL-3.0-or-later
const copy=document.getElementById('loading-copy'),status=document.getElementById('status');
try{
 await import('./ui.js');
 const {checkCompatibility}=await import('./compatibility.js');
 const {acquireGameLease}=await import('./runtime-session.js');
 copy.textContent='Comprobando navegador y aceleración gráfica…';
 const check=await checkCompatibility();window.nativeCompatibility=check;
 if(!check.ok)throw Error(check.errors.join(' '));
 const response=await fetch('release.json',{cache:'no-store'});if(!response.ok)throw Error('Actualiza también el servidor de esta versión.');
 const release=await response.json();if(release.appVersion!=='1.0.0-rc.2'||release.protocol!==2)throw Error('La página y el servidor tienen versiones distintas. Recarga la página o completa la actualización.');window.nativeRelease=release;
 document.getElementById('compatibility-message').textContent=check.warnings.join(' ');
 await acquireGameLease();if(!window.nativeSessionStopped)await import('./main.js');
}catch(error){
 status.textContent='ERROR: '+error.message;copy.textContent=error.message;document.getElementById('retryButton').hidden=false;
 if(/fetch|network|load.*module/i.test(error.message))try{const key='downhill.bootstrap.retries',attempt=Number(sessionStorage.getItem(key)||0);if(attempt<2){sessionStorage.setItem(key,String(attempt+1));copy.textContent='Se interrumpió la carga de archivos. Reintentando…';setTimeout(()=>location.reload(),500*(attempt+1));}}catch{}
}
