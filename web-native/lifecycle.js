// SPDX-License-Identifier: GPL-3.0-or-later
// Audio resumes only from a gesture; the simulation/network keep their own clock.
export function installLifecycle(context,audio,keys,canvas){
 window.nativeAudioContext=context;
 const header=new Int32Array(audio,0,2),button=document.getElementById('soundButton');
 const discard=()=>Atomics.store(header,1,Atomics.load(header,0));
 const update=()=>{if(button){button.hidden=context.state==='running';button.disabled=context.state==='closed';button.textContent=context.state==='closed'?'Sonido no disponible':'Activar sonido';}};
 const resume=()=>{if(document.hidden||context.state==='closed')return;discard();context.resume().then(update).catch(()=>update());};
 // Repeated gestures handle OS interruptions as well as initial autoplay blocking.
 const gesture=e=>{if(e.isTrusted&&(e.type==='pointerdown'||!e.ctrlKey&&!e.altKey&&!e.metaKey)){
  if(context.state!=='running')resume();
 }};
 addEventListener('pointerdown',gesture);addEventListener('keydown',gesture);
 if(button)button.onclick=resume;
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden){keys.fill(0);discard();context.suspend().catch(()=>{});}
  else{discard();update();}
 });
 context.addEventListener('statechange',()=>{if(document.hidden&&context.state==='running')context.suspend().catch(()=>{});update();});update();
 let raceBaseline=null;
 window.nativeAudioDiagnostics=()=>{const stats=window.nativeAudioStats||{};if(window.dhdStatus?.riding&&raceBaseline===null)raceBaseline=stats.underruns||0;return {state:context.state,...stats,raceUnderruns:raceBaseline===null?0:Math.max(0,(stats.underruns||0)-raceBaseline),baseLatencyMs:(context.baseLatency||0)*1000,queuedFrames:(Atomics.load(header,0)-Atomics.load(header,1)+(audio.byteLength-8)/4)%((audio.byteLength-8)/4)};};
 canvas.addEventListener('focus',()=>{keys.fill(0);});
}
