// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const text=await readFile(new URL('../web-native/quality.js',import.meta.url),'utf8');
const {createAutoQuality}=await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
function run(controller,fps,riding,startScale,end){let scale=startScale;const changes=[];for(let now=1000;now<=end;now+=1000){const next=controller.sample({fps,riding,scale},now);if(next!==null){scale=next;changes.push([now,next]);}}return changes;}
assert.deepEqual(run(createAutoQuality({maximum:4}),40,true,4,25000),[[4000,3],[19000,2]]);
assert.deepEqual(run(createAutoQuality(),12,true,4,12000),[[4000,2],[9000,1]]);
assert.deepEqual(run(createAutoQuality(),12,false,4,12000),[[4000,2],[9000,1]]);
assert.deepEqual(run(createAutoQuality({maximum:4}),60,true,2,24000),[[21000,3]]);
assert.deepEqual(run(createAutoQuality(),60,true,2,60000),[]);
assert.deepEqual(run(createAutoQuality(),52,true,2,6000),[[4000,1]]);
assert.deepEqual(run(createAutoQuality({maximum:2}),60,true,1,60000),[[21000,2]]);
assert.deepEqual(run(createAutoQuality(),60,false,1,40000),[]);
const floor=createAutoQuality();for(let now=1000;now<40000;now+=1000)assert.equal(floor.sample({fps:10,riding:true,scale:1},now),null);
const pause=createAutoQuality();pause.sample({fps:12,riding:true,scale:4},1000);pause.sample({fps:12,riding:true,scale:4},2000);
assert.equal(pause.sample({fps:12,riding:true,scale:4},10000),null);assert.equal(pause.sample({fps:12,riding:true,scale:4},11000),null);
// A rejected resolution stays rejected during this session instead of oscillating.
const adaptive=createAutoQuality({maximum:4});let rejectedScale=3;const changes=[];
for(let time=1000;time<=120000;time+=1000){const next=adaptive.sample({fps:rejectedScale>2?40:60,riding:true,scale:rejectedScale},time);if(next!==null){rejectedScale=next;changes.push(next);}}
assert.deepEqual(changes,[2]);
const hitch=createAutoQuality();for(let now=1000;now<=14000;now+=1000)assert.equal(hitch.sample({fps:now===3000?12:60,riding:true,scale:4},now),null);
console.log('Automatic quality: sustained severe/moderate load, menu recovery, hysteresis, long pauses and transient hitches passed.');
