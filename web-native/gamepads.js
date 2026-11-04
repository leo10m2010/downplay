// SPDX-License-Identifier: GPL-3.0-or-later
// Standard Gamepad API -> original libpad bits. Keep players in stable slots
// when another controller disconnects; clear every field on focus loss.
const buttons=[16384,8192,32768,4096,1024,2048,256,512,1,8,2,4,16,64,128,32];
const axis=value=>{const v=Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0;return Math.abs(v)<.12?128:Math.round(128+v*(v<0?128:127));};
// The original menus read digital directions only. Convert the left stick in
// the worker at read time, where the game's menu/riding mode is authoritative.
// Separate press/release thresholds prevent drift and edge chatter.
export function menuStickButtons(x,y,previous=0){
 const direction=(v,negative,positive)=>{
  if(!Number.isFinite(v))return 0;
  if(v<80)return negative;if(v>176)return positive;
  if((previous&negative)&&v<96)return negative;
  if((previous&positive)&&v>160)return positive;
  return 0;
 };
 return direction(x,128,32)|direction(y,16,64);
}
export function createGamepadInput(pads,onDevices=()=>{}) {
 const slots=Array(4).fill(null);let last='';
 return (list,active=true)=>{
  const connected=Array.from(list||[]).filter(p=>p&&p.connected!==false);
  const devices=connected.filter(p=>p.mapping==='standard');
  for(let i=0;i<4;i++)if(slots[i]!==null&&!devices.some(p=>p.index===slots[i]))slots[i]=null;
  for(const p of devices)if(!slots.includes(p.index)){const i=slots.indexOf(null);if(i>=0)slots[i]=p.index;}
  for(let i=0;i<4;i++){
   const p=active?devices.find(p=>p.index===slots[i]):null,o=i*8;
   for(let k=0;k<8;k++)Atomics.store(pads,o+k,k>=2&&k<=5?128:0);
   if(!p)continue;
   let mask=0;p.buttons.forEach((b,k)=>{if(b?.pressed&&buttons[k])mask|=buttons[k];});
   Atomics.store(pads,o+1,mask);
   for(let k=0;k<4;k++)Atomics.store(pads,o+2+k,axis(p.axes[[2,3,0,1][k]]??0));
   Atomics.store(pads,o,1);
  }
  const names=slots.map(index=>devices.find(p=>p.index===index)?.id||''),unsupported=connected.filter(p=>p.mapping!=='standard').map(p=>p.id||'Mando');const signature=JSON.stringify([names,unsupported]);
  if(signature!==last){last=signature;onDevices(names,unsupported);}
 };
}
