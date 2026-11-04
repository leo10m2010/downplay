// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {createCacheWriteQueue,createRequestGate} from '../web-native/resource-cache.js';
const completions=[];let errors=0;
const queue=createCacheWriteQueue(()=>new Promise(resolve=>completions.push(resolve)),()=>errors++);
assert(queue.enqueue('a'));assert(queue.enqueue('b'));assert.equal(queue.enqueue('c'),false);assert.equal(queue.pending,2);
await Promise.resolve();completions.forEach(resolve=>resolve());await queue.drain();assert.equal(queue.pending,0);assert.equal(errors,0);
const failed=createCacheWriteQueue(async()=>{throw Error('quota');},()=>errors++);failed.enqueue();await failed.drain();assert.equal(errors,1);assert.equal(failed.enqueue(),false);
const gate=createRequestGate(1),order=[];let release;
const first=gate(()=>new Promise(resolve=>{release=resolve;order.push('first');}));
const bg=gate(()=>order.push('prefetch'),true),demand=gate(()=>order.push('demand'));
await Promise.resolve();release();await Promise.all([first,bg,demand]);assert.deepEqual(order,['first','demand','prefetch']);
console.log('Cache writes are bounded/nonblocking; quota failure disables caching; demand reads take priority over prefetch.');

const {transportText}=await import('../web-native/network-policy.js');
const hello=JSON.stringify({type:'hello',features:['countdown','other'],protocol:1});
assert.deepEqual(JSON.parse(transportText(hello,true)).features,['other','external-player-barrier']);assert.equal(transportText(hello,false),hello);assert.equal(transportText('raw',true),'raw');
