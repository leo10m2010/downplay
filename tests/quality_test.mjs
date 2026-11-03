// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const text=await readFile(new URL('../web-native/quality.js',import.meta.url),'utf8');
const {createAutoQuality}=await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
const quality=createAutoQuality();let changes=[];
for(let now=1000;now<=25000;now+=1000){const next=quality.sample({fps:40,riding:true,scale:4},now);if(next!==null)changes.push([now,next]);}
assert.deepEqual(changes,[[15000,3]]);
const fast=createAutoQuality();changes=[];
for(let now=1000;now<=24000;now+=1000){const next=fast.sample({fps:60,riding:true,scale:2},now);if(next!==null)changes.push(next);}
assert.deepEqual(changes,[3]);
const menu=createAutoQuality();for(let now=1000;now<40000;now+=1000)assert.equal(menu.sample({fps:10,riding:false,scale:2},now),null);
const floor=createAutoQuality();for(let now=1000;now<40000;now+=1000)assert.equal(floor.sample({fps:10,riding:true,scale:1},now),null);
console.log('Automatic quality: sustained load, recovery, cooldown, menus and minimum scale passed.');
