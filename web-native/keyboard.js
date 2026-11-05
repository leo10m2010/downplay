// SPDX-License-Identifier: GPL-3.0-or-later
// Physical keys map to the original core's virtual-key inputs. Gameplay still
// resolves buttons and analog steering in the C game/host controller code.
export const ACTIONS=[
 ['up','Arriba / inclinar',38,['ArrowUp']],['down','Abajo / inclinar',40,['ArrowDown']],
 ['left','Izquierda',37,['ArrowLeft']],['right','Derecha',39,['ArrowRight']],
 ['cross','✕ · Confirmar / pedalear',88,['KeyX','Space']],['triangle','△ · Volver / frenar',83,['KeyS','Backspace']],
 ['square','□ · Puñetazo',90,['KeyZ']],['circle','○ · Patada',67,['KeyC']],
 ['start','START · Iniciar / pausa',13,['Enter']],['select','SELECT · Cámara',9,['Tab']],
 ['l1','L1 · Truco',65,['KeyA']],['r1','R1 · Truco',68,['KeyD']],['l2','L2 · Truco',81,['KeyQ']],['r2','R2 · Salto / truco',69,['KeyE']],
 ['l3','L3 · Derrape',70,['KeyF']],['r3','R3 · Esprintar',87,['KeyW']],['escape','Pausa / volver',27,['Escape']]
];
export const defaults=()=>Object.fromEntries(ACTIONS.map(([id,,,codes])=>[id,[...codes]]));
export const validCode=code=>typeof code==='string'&&/^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Arrow(Up|Down|Left|Right)|Space|Enter|NumpadEnter|Tab|Backspace|Escape|ShiftLeft|ShiftRight|Home|End|PageUp|PageDown|Delete|Insert)$/.test(code);
export function validateBindings(value){
 if(!value||typeof value!=='object'||Object.keys(value).length!==ACTIONS.length)return false;const seen=new Set();
 return ACTIONS.every(([id])=>Array.isArray(value[id])&&value[id].length>=1&&value[id].length<=2&&value[id].every(code=>{if(!validCode(code)||seen.has(code))return false;seen.add(code);return true;}));
}
export function rebind(bindings,id,code){
 if(!validateBindings(bindings)||!validCode(code)||!ACTIONS.some(a=>a[0]===id))throw Error('Tecla no admitida.');
 const result=structuredClone(bindings),old=result[id][0];
 for(const [other,codes] of Object.entries(result))if(other!==id)result[other]=codes.map(c=>c===code?old:c);
 result[id]=[code];if(!validateBindings(result))throw Error('La combinación produce teclas duplicadas.');return result;
}
const label=code=>({Space:'Espacio',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Escape:'Esc',Backspace:'Retroceso',ShiftLeft:'Mayús izq.',ShiftRight:'Mayús der.'}[code]||code.replace(/^Key|^Digit|^Numpad/,''));
export function installKeyboard(keys,canvas,input=null){
 const storage='downhill.keyboard.v1';let bindings=defaults(),editing=null;const pressed=new Map();
 const panel=document.getElementById('controls'),grid=document.getElementById('keyboard-bindings'),message=document.getElementById('keyboard-message');
 try{const stored=JSON.parse(localStorage.getItem(storage));if(validateBindings(stored))bindings=stored;}catch{}
 const set=input?input.set:(key,down)=>Atomics.store(keys,key,down?1:0);
 const clear=()=>{for(const vk of pressed.values())set(vk,false);pressed.clear();};
 const save=()=>{try{localStorage.setItem(storage,JSON.stringify(bindings));message.textContent='Guardado en este navegador.';}catch{message.textContent='Aplicado. El navegador no permite guardar los cambios.';}};
 const draw=()=>{grid.replaceChildren();for(const [id,text] of ACTIONS){const row=document.createElement('div');row.className='key-row';const title=document.createElement('span');title.textContent=text;const button=document.createElement('button');button.type='button';button.textContent=editing===id?'Pulsa una tecla…':bindings[id].map(label).join(' / ');button.setAttribute('aria-label','Cambiar '+text);button.setAttribute('aria-pressed',String(editing===id));button.onclick=()=>{clear();editing=id;message.textContent='Pulsa la nueva tecla. Esc cancela.';draw();grid.querySelector(`[aria-label="Cambiar ${text}"]`)?.focus();};row.append(title,button);grid.append(row);}};
 draw();
 document.getElementById('reset-keyboard').onclick=()=>{clear();editing=null;bindings=defaults();save();draw();};
 addEventListener('keydown',e=>{
  if(editing){e.preventDefault();e.stopImmediatePropagation();if(e.code==='Escape'){editing=null;message.textContent='Cambio cancelado.';draw();return;}if(e.repeat||e.ctrlKey||e.altKey||e.metaKey)return;try{bindings=rebind(bindings,editing,e.code);editing=null;save();draw();}catch(error){message.textContent=error.message;}return;}
  if(!panel.hidden||document.activeElement!==canvas||e.ctrlKey||e.altKey||e.metaKey)return;
  if(window.nativeTextInputActive?.()&&!e.code.startsWith('Arrow'))return;
  const action=ACTIONS.find(([id])=>bindings[id].includes(e.code));if(!action)return;
  e.preventDefault();if(!pressed.has(e.code)){pressed.set(e.code,action[2]);set(action[2],true);}
 },true);
 addEventListener('keyup',e=>{if(!pressed.has(e.code))return;const vk=pressed.get(e.code);pressed.delete(e.code);if(![...pressed.values()].includes(vk))set(vk,false);e.preventDefault();},true);
 addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 document.addEventListener('pointerdown',e=>{if(e.target!==canvas)clear();},true);
 new MutationObserver(()=>{if(panel.hidden){editing=null;draw();}else clear();}).observe(panel,{attributes:true,attributeFilter:['hidden']});
 return {clear};
}
