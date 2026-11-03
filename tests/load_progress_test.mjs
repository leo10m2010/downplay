// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../web-native/load-progress.js',import.meta.url),'utf8');
const {fetchWithProgress}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const updates=[],bytes=Uint8Array.from([1,2,3,4,5]);
const result=await fetchWithProgress('core',p=>updates.push(p),async()=>new Response(bytes,{headers:{'Content-Length':'3','Content-Encoding':'gzip','X-Uncompressed-Length':'5'}}));
assert.deepEqual(new Uint8Array(result),bytes);assert.equal(updates.at(-1).total,5);assert(updates.at(-1).done);
await assert.rejects(()=>fetchWithProgress('missing',()=>{},async()=>new Response('',{status:404})),/404/);
await assert.rejects(()=>fetchWithProgress('short',()=>{},async()=>new Response(bytes,{headers:{'Content-Length':'10'}}),{delay:async()=>{}}),/incompleta/);
let attempts=0;const recovered=await fetchWithProgress('retry',()=>{},async()=>{if(++attempts<3)throw Error('network');return new Response(bytes);},{delay:async()=>{}});
assert.equal(attempts,3);assert.deepEqual(new Uint8Array(recovered),bytes);
attempts=0;await assert.rejects(()=>fetchWithProgress('missing',()=>{},async()=>{attempts++;return new Response('',{status:404});}),/404/);assert.equal(attempts,1);
console.log('Progress: decoded bytes, compressed sizes, failed responses and truncation passed.');
await assert.rejects(()=>fetchWithProgress('stalled',()=>{},()=>new Promise(()=>{}),{attempts:1,timeoutMs:10}),/demasiado/);
await assert.rejects(()=>fetchWithProgress('stalled body',()=>{},async()=>new Response(new ReadableStream({pull(){return new Promise(()=>{});}})),{attempts:1,timeoutMs:10}),/demasiado/);
