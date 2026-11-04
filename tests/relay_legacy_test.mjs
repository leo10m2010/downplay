// SPDX-License-Identifier: GPL-3.0-or-later
// Exercise the old route after a dual-protocol Worker deployment.
import assert from 'node:assert/strict';
const base=process.env.DHD_TEST_RELAY||'ws://127.0.0.1:8788';
const health=await (await fetch(base.replace(/^ws/,'http')+'/v1/health')).json();
assert.equal(health.protocol,1);assert.equal(health.minVersion,'0.7.2');
const sockets=[];
async function open(path,name){
 const ws=new WebSocket(base+path),messages=[];sockets.push(ws);
 const wait=check=>new Promise((resolve,reject)=>{const deadline=Date.now()+15000;const timer=setInterval(()=>{if(check()){clearInterval(timer);resolve();}else if(Date.now()>deadline){clearInterval(timer);reject(Error('Legacy route timeout: '+JSON.stringify(messages)));}},25);});
 ws.onmessage=e=>{if(typeof e.data==='string')messages.push(JSON.parse(e.data));};
 await wait(()=>ws.readyState===WebSocket.OPEN);
 ws.send(JSON.stringify({type:'hello',protocol:1,version:'0.7.2',clientVersion:'0.7.2',isoSha256:'a'.repeat(64),name,features:[]}));
 await wait(()=>messages.some(m=>m.type==='welcome'));
 return {ws,messages,wait};
}
try{
 const host=await open('/v1/rooms/new','LegacyHost'),code=host.messages.find(m=>m.type==='welcome').code;
 const guest=await open('/v1/rooms/'+code,'LegacyGuest');
 await host.wait(()=>host.messages.some(m=>m.type==='room'&&m.members.length===2));
 host.ws.send(JSON.stringify({type:'ready',ready:true}));guest.ws.send(JSON.stringify({type:'ready',ready:true}));
 await host.wait(()=>host.messages.some(m=>m.type==='room'&&m.members.length===2&&m.members.every(x=>x.ready)));
 host.ws.send(JSON.stringify({type:'start'}));await host.wait(()=>host.messages.some(m=>m.type==='start'));
 assert.equal(host.messages.find(m=>m.type==='start').players.length,2);
 console.log('Legacy protocol 1: health, create, join, ready and two-player start passed.');
}finally{for(const ws of sockets)ws.close();}
