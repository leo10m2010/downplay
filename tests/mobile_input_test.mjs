// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {createKeyInput} from '../web-native/input-state.js';
import {isTouchDevice,mobileDefaults} from '../web-native/mobile.js';
const keys=new Uint8Array(new SharedArrayBuffer(256)),input=createKeyInput(keys);
const keyboard=input.source(),thumb=input.source(),second=input.source();
keyboard.set(88,true);thumb.set(88,true);second.set(37,true);
keyboard.clear();assert.equal(keys[88],1);assert.equal(keys[37],1);
thumb.set(88,true);thumb.clear();assert.equal(keys[88],0);assert.equal(keys[37],1);
second.clear();assert(keys.every(x=>x===0));
thumb.set(-1,true);thumb.set(256,true);thumb.set(NaN,true);assert(keys.every(x=>x===0));
for(let i=0;i<100;i++){thumb.set(69,true);second.set(69,true);thumb.clear();assert.equal(keys[69],1);second.clear();}
assert(keys.every(x=>x===0));
assert.equal(isTouchDevice({navigator:{maxTouchPoints:5}}),true);
assert.equal(isTouchDevice({navigator:{maxTouchPoints:0},matchMedia:()=>({matches:true})}),true);
assert.equal(isTouchDevice({navigator:{maxTouchPoints:0}}),false);
assert.deepEqual(mobileDefaults({},true),{DHD_SCALE:'1',DHD_AUTO_MAX_SCALE:'2'});
assert.equal(mobileDefaults({DHD_SCALE:'3'},true).DHD_SCALE,'3');
assert.deepEqual(mobileDefaults({},false),{});
console.log('Shared touch/keyboard ownership, repeated/cancelled holds and mobile graphics defaults passed.');
