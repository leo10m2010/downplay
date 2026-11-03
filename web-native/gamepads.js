// SPDX-License-Identifier: GPL-3.0-or-later
// Standard Gamepad API -> original libpad bits. Keep players in stable slots
// when another controller disconnects; clear every field on focus loss.
const buttons=[16384,8192,32768,4096,1024,2048,256,512,1,8,2,4,16,64,128,32];
const axis=value=>Number.isFinite(value)?Math.max(0,Math.min(255,Math.round(128+(Math.abs(value)<.12?0:value)*127.5))):128;
export function createGamepadInput(pads,onDevices=()=>{}) {
 const slots=Array(4).fill(null);let last='';
 return (list,active=true)=>{
  const devices=Array.from(list||[]).filter(p=>p?.connected!==false&&p?.mapping==='standard');
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
  const names=slots.map(index=>devices.find(p=>p.index===index)?.id||'');const signature=JSON.stringify(names);
  if(signature!==last){last=signature;onDevices(names);}
 };
}
