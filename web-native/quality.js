// SPDX-License-Identifier: GPL-3.0-or-later
// Rendering only: never changes game speed, input timing or simulation state.
export function createAutoQuality({maximum=4,cooldown=15000}={}){
 let low=0,high=0,critical=0,lastChange=null,lastTime=null;
 return {sample({fps,riding,scale},now){
  if(!Number.isFinite(now))return null;
  if(lastTime===null||now<lastTime||now-lastTime>3000){low=high=critical=0;lastTime=now;return null;}
  const elapsed=Math.min(1500,now-lastTime);lastTime=now;
  if(!Number.isFinite(fps)||fps<0||!Number.isInteger(scale)||scale<1||scale>8){low=high=critical=0;return null;}
  low=fps<48?Math.min(5000,low+elapsed):0;
  critical=fps<25?Math.min(2500,critical+elapsed):0;
  high=riding&&fps>=58?Math.min(20000,high+elapsed):0;
  let next=null;
  // Severe sustained overload needs a faster response, including in menus.
  // A long blocked read/hidden-tab gap is excluded above, not treated as GPU load.
  if(critical>=2500&&scale>1&&(lastChange===null||now-lastChange>=5000))next=Math.max(1,Math.floor(scale/2));
  else if(lastChange===null||now-lastChange>=cooldown){
   if(low>=5000&&scale>1)next=scale-1;
   else if(high>=20000&&scale<maximum)next=scale+1;
  }
  if(next!==null){lastChange=now;low=high=critical=0;}return next;
 }};
}
