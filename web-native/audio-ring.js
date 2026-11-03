// SPDX-License-Identifier: GPL-3.0-or-later
// The original stereo PCM ring protocol; direct view and at most two bulk copies.
// Full ring keeps the original policy: drop samples that do not fit.
export function writePcm(ring,bytes){
 const source=new Int16Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/2),h=ring.head,cap=ring.frames;
 const w=Atomics.load(h,0),r=Atomics.load(h,1),free=cap-1-((w-r+cap)%cap);
 const count=Math.min(bytes.byteLength/4,free),first=Math.min(count,cap-w);
 ring.data.set(source.subarray(0,first*2),w*2);
 if(first<count)ring.data.set(source.subarray(first*2,count*2),0);
 Atomics.store(h,0,(w+count)%cap);return count;
}
