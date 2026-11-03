// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../web-native/gamepads.js',import.meta.url),'utf8');
const {createGamepadInput}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const pads=new Int32Array(new SharedArrayBuffer(128));let names;
const poll=createGamepadInput(pads,value=>names=value);
const controller=(index,id)=>({index,id,connected:true,mapping:'standard',buttons:Array.from({length:16},()=>({pressed:false})),axes:[0,0,0,0]});
const a=controller(4,'PlayStation'),b=controller(8,'Xbox');a.buttons[0].pressed=true;a.axes[0]=1;
poll([a,b]);assert.equal(pads[0],1);assert.equal(pads[1],16384);assert.equal(pads[4],255);assert.equal(pads[8],1);
poll([null,b]);assert.equal(pads[0],0);assert.equal(pads[8],1);assert.equal(names[1],'Xbox');
poll([b,a]);assert.equal(names[0],'PlayStation');assert.equal(names[1],'Xbox');
poll([a,b],false);for(let i=0;i<2;i++){assert.equal(pads[i*8],0);assert.equal(pads[i*8+1],0);assert.deepEqual([...pads.slice(i*8+2,i*8+6)],[128,128,128,128]);}
for(let button=0;button<16;button++){
 a.buttons.forEach(b=>b.pressed=false);a.buttons[button].pressed=true;poll([a]);
 assert.equal(pads[1],[16384,8192,32768,4096,1024,2048,256,512,1,8,2,4,16,64,128,32][button]);
}
a.axes=[.05,NaN,Infinity,-1];poll([a]);assert.deepEqual([...pads.slice(2,6)],[128,1,128,128]);
poll([{...a,mapping:''}]);assert.equal(pads[0],0);
console.log('Gamepad mapping, stable player slots, deadzone, disconnect and focus clearing passed.');
