// SPDX-License-Identifier: GPL-3.0-or-later
// Small adaptive prefill prevents isolated empty quanta from repeatedly clicking.
export function createPcmConsumer(ring,rate=48000){
 const h=new Int32Array(ring,0,2),data=new Int16Array(ring,8),cap=data.length/2;
 let primed=false,played=false,need=Math.min(1536,cap-1),gain=0,lastL=0,lastR=0,underruns=0,starved=0,trimmed=0;
 return {read(left,right){
  let r=Atomics.load(h,1),w=Atomics.load(h,0),available=(w-r+cap)%cap;
  if(available>Math.min(Math.floor(rate*.12),cap-1)){const keep=Math.min(Math.floor(rate*.06),cap-1);trimmed+=available-keep;r=(w-keep+cap)%cap;available=keep;gain=0;}
  if(!primed&&available>=need)primed=true;
  let broke=false;
  for(let i=0;i<left.length;i++){
   if(primed&&r!==w){lastL=data[r*2]/32768;lastR=data[r*2+1]/32768;r=(r+1)%cap;gain=Math.min(1,gain+1/128);played=true;}
   else{if(primed&&!broke){underruns++;broke=true;need=Math.min(Math.floor(rate*.064),cap-1);}primed=false;if(played)starved++;gain=Math.max(0,gain-1/128);}
   left[i]=lastL*gain;right[i]=lastR*gain;
  }
  Atomics.store(h,1,r);
 },stats(){return {underruns,starvedFrames:starved,trimmedFrames:trimmed,queuedMs:((Atomics.load(h,0)-Atomics.load(h,1)+cap)%cap)*1000/rate,prefillMs:need*1000/rate};}};
}
