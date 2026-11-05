// SPDX-License-Identifier: GPL-3.0-or-later
// Match the original text_input.c contract: bounded ASCII, Enter/Back/Escape.
export function createTextInputServices({span,str,onActive=()=>{}}){
 let active=false,queue=[];
 const receive=value=>{if(active&&Array.isArray(value))for(const c of value.slice(0,256)){if(queue.length>=256)break;if(Number.isInteger(c)&&c>0&&c<128)queue.push(c);}};
 const services={
  host_service_text_input_begin:()=>{queue=[];active=true;onActive(true);},
  host_service_text_input_end:()=>{queue=[];active=false;onActive(false);},
  host_service_text_input_edit:(address,capacity,allowedAddress)=>{
   if(!Number.isInteger(capacity)||capacity<1||capacity>4096)return 0;
   const out=span(address,capacity),allowed=str(allowedAddress),input=queue;queue=[];
   let size=out.indexOf(0);if(size<0){size=capacity-1;out[size]=0;}
   for(let c of input){
    if(c===13||c===10)return 1;if(c===27)return -1;
    if(c===8){if(size)out[--size]=0;continue;}
    if(c>=97&&c<=122)c-=32;
    if(allowed.includes(String.fromCharCode(c))&&size+1<capacity){out[size++]=c;out[size]=0;}
   }
   return 0;
  }
 };
 return {services,receive};
}

export function installTextInput(worker,canvas,mouse){
 const active=()=>Atomics.load(mouse,14)!==0;
 window.nativeTextInputActive=active;
 const enabled=()=>active()&&document.activeElement===canvas&&['controls','logPanel','restore-panel'].every(id=>document.getElementById(id).hidden);
 const send=codes=>worker.postMessage({type:'text-input',codes:codes.slice(0,256)});
 addEventListener('keydown',event=>{
  if(!enabled()||event.ctrlKey||event.metaKey||event.altKey)return;
  const c={Enter:13,Escape:27,Backspace:8}[event.key]??(event.key.length===1?event.key.charCodeAt(0):0);
  if(c>0&&c<128){event.preventDefault();event.stopImmediatePropagation();send([c]);}
 },true);
 addEventListener('paste',event=>{if(!enabled())return;event.preventDefault();send(Array.from((event.clipboardData?.getData('text/plain')||'').slice(0,256),c=>c.charCodeAt(0)));},true);
}
