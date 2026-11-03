// SPDX-License-Identifier: GPL-3.0-or-later
export function isTouchDevice(scope=globalThis){
 return (scope.navigator?.maxTouchPoints||0)>0||Boolean(scope.matchMedia?.('(any-pointer: coarse)').matches);
}
export function mobileDefaults(env,touch=isTouchDevice()){
 return touch?{DHD_SCALE:'1',DHD_AUTO_MAX_SCALE:'2',...env}:env;
}

// Pointer capture permits simultaneous steering/pedalling and releases cancelled touches.
// Inputs go to the existing C controller mapping, including the original game menus.
export function installTouch(input,canvas){
 const root=document.getElementById('touch-controls'),toggle=document.getElementById('touch-toggle');
 const pointers=new Map(),buttons=[...root.querySelectorAll('[data-key]')];
 const clearPointer=id=>{const active=pointers.get(id);if(!active)return;active.source.clear();pointers.delete(id);};
 const paint=()=>{for(const button of buttons)button.classList.toggle('held',[...pointers.values()].some(p=>p.button===button));};
 const clear=()=>{for(const id of [...pointers.keys()])clearPointer(id);paint();};
 const enabled=()=>!root.hidden&&document.body.classList.contains('ready')&&!window.nativeSessionStopped&&['controls','logPanel','restore-panel'].every(id=>document.getElementById(id).hidden);
 let requested=isTouchDevice();
 const refresh=()=>{const touch=isTouchDevice();document.body.classList.toggle('touch-device',touch);toggle.hidden=!touch;root.hidden=!touch||!requested;toggle.setAttribute('aria-pressed',String(!root.hidden));if(root.hidden)clear();if(touch)document.getElementById('screen-hint').textContent='Usa los botones táctiles. Gira el teléfono para jugar en horizontal.';};
 refresh();
 toggle.onclick=()=>{requested=!requested;refresh();};
 const change=(active,button)=>{active.source.clear();active.button=button;if(button)active.source.set(Number(button.dataset.key),true);paint();};
 root.addEventListener('pointerdown',event=>{
  const button=event.target.closest('[data-key]');if(!button||!enabled()||pointers.size>=16||pointers.has(event.pointerId))return;
  event.preventDefault();canvas.focus({preventScroll:true});
  const active={source:input.source(),button:null};pointers.set(event.pointerId,active);change(active,button);
  root.setPointerCapture(event.pointerId);
 });
 root.addEventListener('pointermove',event=>{
  const active=pointers.get(event.pointerId);if(!active)return;event.preventDefault();
  const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-key]');
  // Slide between directions without lifting the steering thumb. Other buttons stay captured.
  if(active.button?.closest('.touch-dpad'))change(active,target?.closest('.touch-dpad')?target:null);
  else if(!active.button&&target?.closest('.touch-dpad'))change(active,target);
 });
 for(const type of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(type,event=>{clearPointer(event.pointerId);paint();});
 root.addEventListener('contextmenu',event=>event.preventDefault());
 addEventListener('blur',clear);addEventListener('pagehide',clear);addEventListener('runtime-stopped',clear);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 for(const id of ['controls','logPanel','restore-panel'])new MutationObserver(()=>{if(!enabled())clear();}).observe(document.getElementById(id),{attributes:true,attributeFilter:['hidden']});
 new MutationObserver(()=>{if(!enabled())clear();}).observe(document.body,{attributes:true,attributeFilter:['class']});
 addEventListener('resize',()=>{clear();refresh();});
 document.addEventListener('fullscreenchange',clear);
}

export function installFullscreen(canvas,log=()=>{}){
 const surface=document.getElementById('play-surface'),exit=document.getElementById('exit-fullscreen');
 const toggle=async()=>{
  try{
   if(document.fullscreenElement){await document.exitFullscreen();return;}
   if(document.body.classList.contains('expanded-game')){document.body.classList.remove('expanded-game');return;}
   if(surface.requestFullscreen){await surface.requestFullscreen();try{await screen.orientation?.lock('landscape');}catch{}}
   else document.body.classList.add('expanded-game');
  }catch(error){log('Pantalla completa: '+error.message);document.body.classList.add('expanded-game');}
  finally{canvas.focus({preventScroll:true});}
 };
 canvas.ondblclick=toggle;document.getElementById('fullscreen').onclick=toggle;exit.onclick=toggle;
 addEventListener('keydown',event=>{if(event.key==='Escape')document.body.classList.remove('expanded-game');});
}
