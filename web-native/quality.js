// SPDX-License-Identifier: GPL-3.0-or-later
// Rendering only: never changes game speed, input timing or simulation state.
export function createAutoQuality({maximum=4,cooldown=15000}={}){
 let low=0,high=0,lastChange=0,lastTime=0;
 return {sample({fps,riding,scale},now){
  if(!Number.isFinite(now)||now-lastTime>3000||!riding){low=high=0;lastTime=now;return null;}
  const elapsed=Math.max(0,Math.min(1500,now-lastTime));lastTime=now;
  if(!Number.isFinite(fps)||!Number.isInteger(scale)||scale<1||scale>8)return null;
  low=fps<48?low+elapsed:0;high=fps>=58?high+elapsed:0;
  if(now-lastChange<cooldown)return null;
  let next=null;
  if(low>=5000&&scale>1)next=scale-1;
  else if(high>=20000&&scale<maximum)next=scale+1;
  if(next!==null){lastChange=now;low=high=0;}return next;
 }};
}
