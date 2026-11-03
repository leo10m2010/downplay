// SPDX-License-Identifier: GPL-3.0-or-later
export function createFrameMetrics(capacity=120){
 const samples=new Float64Array(capacity);let count=0,index=0,last=null,stalls=0;
 return {sample(now){if(!Number.isFinite(now))return;const gap=last===null?0:now-last;last=now;if(gap<=0||gap>2000)return;samples[index]=gap;index=(index+1)%capacity;count=Math.min(capacity,count+1);if(gap>50)stalls++;},
  snapshot(){const sorted=Array.from(samples.subarray(0,count)).sort((a,b)=>a-b);return {samples:count,p50Ms:sorted.length?sorted[Math.floor((count-1)*.5)]:0,p95Ms:sorted.length?sorted[Math.floor((count-1)*.95)]:0,maxMs:sorted.at(-1)||0,stalls};}
 };
}
