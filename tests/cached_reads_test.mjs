// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {copyCachedRange} from '../web-native/resource-cache.js';
const memory=new Map([[0,Uint8Array.of(0,1,2,3)],[1,Uint8Array.of(4,5,6,7)],[2,Uint8Array.of(8,9)]]);
let out=new Uint8Array(7);assert.equal(copyCachedRange(memory,4,10,2,out),7);assert.deepEqual([...out],[2,3,4,5,6,7,8]);
out=new Uint8Array(4).fill(255);assert.equal(copyCachedRange(memory,4,10,8,out),2);assert.deepEqual([...out],[8,9,255,255]);
memory.delete(1);out=new Uint8Array(7).fill(255);assert.equal(copyCachedRange(memory,4,10,1,out),null);assert(out.every(x=>x===255));
assert.equal(copyCachedRange(memory,4,10,10,out),0);assert.equal(copyCachedRange(memory,4,10,15,out),0);
assert.equal(copyCachedRange(memory,4,10,0,new Uint8Array()),0);
for(const pos of [-1,NaN,1.5,Infinity])assert.throws(()=>copyCachedRange(memory,4,10,pos,out));
const lru=new Map([[0,Uint8Array.of(0,1,2,3)],[1,Uint8Array.of(4,5,6,7)]]);
copyCachedRange(lru,4,8,0,new Uint8Array(1));assert.deepEqual([...lru.keys()],[1,0]);
console.log('Synchronous RAM reads: cross-block bytes, EOF, all-or-nothing misses, LRU and invalid offsets passed.');
