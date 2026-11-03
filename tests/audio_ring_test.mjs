// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../web-native/audio-ring.js',import.meta.url),'utf8');
const {writePcm}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
for(let cap=2;cap<=32;cap++)for(let w=0;w<cap;w++)for(let r=0;r<cap;r++){
 const ring={head:new Int32Array([w,r]),data:new Int16Array(cap*2).fill(-123),frames:cap};
 const source=new Int16Array(40);for(let i=0;i<source.length;i++)source[i]=i*333-6000;
 const expected=ring.data.slice(),count=Math.min(20,cap-1-((w-r+cap)%cap));
 for(let i=0;i<count;i++){expected[((w+i)%cap)*2]=source[i*2];expected[((w+i)%cap)*2+1]=source[i*2+1];}
 assert.equal(writePcm(ring,new Uint8Array(source.buffer)),count);assert.deepEqual(ring.data,expected);assert.equal(ring.head[0],(w+count)%cap);assert.equal(ring.head[1],r);
}
console.log('PCM bulk copies match the original ring protocol for all tested wrap/full/empty states.');
