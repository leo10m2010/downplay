// SPDX-License-Identifier: GPL-3.0-or-later
// Exercise the compiled original Revived client, not a JS protocol substitute.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const create=(await import('../build/network/public/network-core.js')).default;
const net=await create({wasmBinary:await readFile(new URL('../build/network/public/network-core.wasm',import.meta.url))});
const emitted=[];net.onSend=(binary,bytes)=>emitted.push({binary,bytes});
const string=(value,fn)=>{const bytes=new TextEncoder().encode(value+'\0'),p=net._malloc(bytes.length);try{net.HEAPU8.set(bytes,p);return fn(p);}finally{net._free(p);}};
string('Test "rider"',n=>string('test-browser-build',v=>string('a'.repeat(64),h=>net._wn_init(n,v,h))));
net._wn_open();const hello=JSON.parse(new TextDecoder().decode(emitted.at(-1).bytes));
assert.equal(hello.type,'hello');assert.equal(hello.name,'Test "rider"');assert.equal(hello.protocol,1);assert.equal(hello.isoSha256,'a'.repeat(64));
const receive=(binary,data)=>{const b=typeof data==='string'?new TextEncoder().encode(data):data;net.HEAPU8.set(b,net._wn_buffer());net._wn_message(binary,b.length);};
receive(0,JSON.stringify({type:'welcome',code:'ABC234',memberId:7,host:false,serverTime:Date.now()}));
let at=net._wn_lobby();assert.equal(new TextDecoder().decode(net.HEAPU8.subarray(at+8,at+14)),'ABC234');
receive(0,JSON.stringify({type:'room',code:'ABC234',hostId:2,members:[{id:2,name:'Host',ready:true,rider:1,bike:1,rttMs:42},{id:7,name:'Guest',ready:false,rider:2,bike:1}]}));
net._wn_lobby();assert.equal(net._wn_member_count(),2);assert.equal(net._wn_member_ready(0),1);assert.equal(net._wn_member_ready(1),0);
const nameAt=net._wn_member_name(0);assert.equal(new TextDecoder().decode(net.HEAPU8.subarray(nameAt,nameAt+4)),'Host');assert.equal(net._wn_member_ready(99),0);
net._wn_pick(-1,2,1);assert.equal(JSON.parse(new TextDecoder().decode(emitted.at(-1).bytes)).rider,2);
net._wn_ready(1);assert.equal(JSON.parse(new TextDecoder().decode(emitted.at(-1).bytes)).ready,true);
receive(0,JSON.stringify({type:'start',yourSlot:1,track:0,laps:0,seed:123,players:[{slot:0,memberId:2,name:'Host',rider:1,bike:1},{slot:1,memberId:7,name:'Guest',rider:2,bike:1}],serverTime:Date.now(),startAt:Date.now()+1000}));
assert.equal(net._wn_racing(),1);
// The sender leaves the slot byte at zero; the relay assigns it from the socket.
net.HEAPU8.set([1,2,3],net._wn_buffer());assert.equal(net._wn_send(5,3),1);assert.deepEqual([...emitted.at(-1).bytes],[5,0,1,2,3]);
receive(1,new Uint8Array([5,0,9,8]));assert.equal(net._wn_receive(3072),4);assert.deepEqual([...net.HEAPU8.subarray(net._wn_buffer(),net._wn_buffer()+4)],[5,0,9,8]);
assert.equal(net._wn_receive(3072),0);assert.equal(net._wn_send(5,3071),0);
const p=net._malloc(1);assert.equal(BigInt.asUintN(64,net._net_hash64(p,0,0n)),0xef46db3751d8e999n);net._free(p);
receive(0,'{"type":"ended"}');assert.equal(net._wn_racing(),0);
console.log('Original C client: hello, selection, ready, race slots, binary state relay, bounds and XXH64 passed.');
