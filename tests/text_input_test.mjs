// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {createTextInputServices} from '../web-native/text-input.js';
const memory=new Uint8Array(512),allowed='ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789 ',states=[];
const text=createTextInputServices({span:(a,n)=>memory.subarray(a,a+n),str:()=>allowed,onActive:value=>states.push(value)});
const edit=()=>text.services.host_service_text_input_edit(32,7,128),value=()=>new TextDecoder().decode(memory.subarray(32,38)).split('\0')[0];
const type=s=>text.receive(Array.from(s,c=>c.charCodeAt(0)));
type('IGNORE');edit();assert.equal(value(),'');
text.services.host_service_text_input_begin();type('ab01c!é234567');edit();assert.equal(value(),'ABC234');assert.equal(memory[38],0);
text.receive([8,8,13,90]);assert.equal(edit(),1);assert.equal(value(),'ABC2');edit();assert.equal(value(),'ABC2');
type('de');edit();assert.equal(value(),'ABC2DE');text.receive([27]);assert.equal(edit(),-1);
text.services.host_service_text_input_end();type('x');edit();assert.equal(value(),'ABC2DE');
text.services.host_service_text_input_begin();memory.fill(0);text.receive(Array(300).fill(8));type('X');edit();assert.equal(value(),'');
type('X');edit();assert.equal(value(),'X');assert.deepEqual(states,[true,false,true]);
assert.equal(text.services.host_service_text_input_edit(32,0,128),0);
console.log('Original text-entry contract: ASCII filter, uppercase, bounds, queue cap, Backspace, Enter and Escape passed.');
