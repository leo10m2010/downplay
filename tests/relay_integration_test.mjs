// SPDX-License-Identifier: GPL-3.0-or-later
// Actual C clients and the configured relay; protocol test, not a game simulation.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import create from '../build/network/public/network-core.js';
import {transportText} from '../web-native/network-policy.js';
const base=process.env.DHD_TEST_RELAY||'wss://downhill-web-relay.dowh.workers.dev/v2';
const identity=await (await fetch((process.env.DHD_TEST_ORIGIN||'http://127.0.0.1:8096')+'/game-identity.json')).json();
const wasmBinary=await readFile(new URL('../build/network/public/network-core.wasm',import.meta.url)),clients=[];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(check,description){const until=Date.now()+20000;while(!check()){if(Date.now()>until)throw Error('Timeout: '+description);await pause(50);}}
async function client(name,path){
 const net=await create({wasmBinary}),ws=new WebSocket(base+path),messages=[];ws.binaryType='arraybuffer';
 const string=(value,fn)=>{const data=new TextEncoder().encode(value+'\0'),p=net._malloc(data.length);try{net.HEAPU8.set(data,p);return fn(p);}finally{net._free(p);}};
 string(name,n=>string('0.7.9',v=>string(identity.filesSha256,h=>net._wn_init(n,v,h))));
 net.onSend=(binary,bytes)=>{if(ws.readyState===WebSocket.OPEN)ws.send(binary?bytes:transportText(new TextDecoder().decode(bytes),true));};
 ws.onopen=()=>net._wn_open();ws.onmessage=event=>{const data=typeof event.data==='string'?new TextEncoder().encode(event.data):new Uint8Array(event.data);if(typeof event.data==='string')messages.push(JSON.parse(event.data));net.HEAPU8.set(data,net._wn_buffer());net._wn_message(typeof event.data==='string'?0:1,data.length);};
 ws.onclose=event=>string(event.reason,p=>net._wn_closed(event.code,p));
 const timer=setInterval(()=>{if(ws.readyState===WebSocket.OPEN)net._wn_tick();},100);
 const item={net,ws,messages,refresh(){net._wn_lobby();return net;},room(){return messages.findLast(m=>m.type==='room');},stop(){clearInterval(timer);net._wn_leave();ws.close();}};clients.push(item);return item;
}
try{
 const host=await client('ProtocolHost','/v1/rooms/new');await wait(()=>host.messages.some(m=>m.type==='welcome'),'host welcome');
 const code=host.messages.find(m=>m.type==='welcome').code;
 host.net._wn_room(0,0,0,3,1n,0);host.net._wn_ready(1);
 const guest=await client('ProtocolGuest','/v1/rooms/'+code);await wait(()=>guest.room()?.members.length===2,'second member');guest.net._wn_ready(1);
 await pause(6500);assert(!host.messages.some(m=>m.type==='start'),'Server started with only two of three players');
 guest.stop();await wait(()=>host.room()?.members.length===1,'guest leaves lobby');
 const second=await client('ProtocolSecond','/v1/rooms/'+code),third=await client('ProtocolThird','/v1/rooms/'+code);
 await wait(()=>host.room()?.members.length===3,'three members');second.net._wn_ready(1);third.net._wn_ready(1);
 await wait(()=>host.room().members.every(m=>m.ready),'all ready');host.net._wn_start();
 await wait(()=>host.messages.some(m=>m.type==='start'),'explicit start');assert.equal(host.messages.find(m=>m.type==='start').players.length,3);
 const late=await client('ProtocolLate','/v1/rooms/'+code);await wait(()=>late.messages.some(m=>m.type==='error')||late.ws.readyState===WebSocket.CLOSED,'late join rejected');
 const oldHost=host.room().hostId;host.stop();await wait(()=>second.room()?.hostId!==oldHost&&second.room()?.members.length===2,'host departure');
 assert(second.refresh()._wn_racing());
 console.log(JSON.stringify({passed:true,code,serverCountdownDidNotStartEarly:true,guestLeftLobby:true,threeSlotsStarted:true,lateJoinRejected:true,hostDepartureReported:true,testType:'original C protocol clients; no game simulation'}));
}finally{for(const item of clients)item.stop();await pause(200);}
