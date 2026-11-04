// SPDX-License-Identifier: GPL-3.0-or-later
// WebSocket host services around the unchanged Revived C network state machine.
import createNetworkCore from './network-core.js';
import {transportText} from './network-policy.js';

export async function createBrowserNetwork({env,span,str,say}) {
 const net=await createNetworkCore();let socket=null,generation=0,retries=0,identity;
 let init=['Rider','',''],base='',stopping=false,racers=[],loaded=new Set(),go=false,capacity=4;
 const observeEvent=(bytes,sender)=>{if(bytes[0]===6&&bytes.length>=4&&bytes[2]===2){if(bytes[3]===2)loaded.add(sender);if(bytes[3]===5)go=true;}};
 const stats={sentStates:0,receivedStates:0,sentEvents:0,receivedEvents:0};
 const buf=()=>net._wn_buffer();
 const string=(text,fn)=>{if(text===null)return fn(0);const bytes=new TextEncoder().encode(text+'\0'),at=net._malloc(bytes.length);try{net.HEAPU8.set(bytes,at);return fn(at);}finally{net._free(at);}};
 const initialize=()=>string(init[0],n=>string(init[1],v=>string(init[2],h=>net._wn_init(n,v,h))));
 const close=()=>{stopping=true;++generation;net._wn_leave();socket?.close();socket=null;racers=[];loaded.clear();go=false;};
 net.onSend=(binary,bytes)=>{if(socket?.readyState!==WebSocket.OPEN)return;if(socket.bufferedAmount>262144){socket.close(1008,'Network queue full');return;}if(binary)observeEvent(bytes,net._wn_local_slot?.()??0);socket.send(binary?bytes:transportText(new TextDecoder().decode(bytes),Boolean(env.DHD_NET_CREATE||env.DHD_NET_JOIN)));if(binary&&bytes[0]===5)stats.sentStates++;if(binary&&bytes[0]===6)stats.sentEvents++;};
 const connect=(path,rejoin=false)=>{
  if(!base){say('Online: configura DHD_NET_SERVER para tu servidor.');return -1;}
  if(!rejoin){close();initialize();retries=0;}
  stopping=false;const own=++generation;
  socket=new WebSocket(base+'/v2'+path);socket.binaryType='arraybuffer';const current=socket;
  current.onopen=()=>{if(own===generation)net._wn_open();};
  current.onmessage=event=>{
   if(own!==generation)return;
   const bytes=typeof event.data==='string'?new TextEncoder().encode(event.data):new Uint8Array(event.data);
   if(typeof event.data==='string'){try{const message=JSON.parse(event.data);if(message.type==='room'&&Number.isInteger(message.maxPlayers))capacity=message.maxPlayers;if(message.type==='start'){racers=message.players||[];loaded.clear();go=false;}}catch{}}
   else observeEvent(bytes,bytes[1]);
   if(bytes.length>65536){current.close(1009,'Message too large');return;}
   if(typeof event.data!=='string'&&bytes[0]===5)stats.receivedStates++;
   if(typeof event.data!=='string'&&bytes[0]===6)stats.receivedEvents++;
   net.HEAPU8.set(bytes,buf());net._wn_message(typeof event.data==='string'?0:1,bytes.length);
  };
  current.onclose=event=>{
   if(own!==generation)return;
   const reconnect=string(event.reason||'Connection closed',p=>net._wn_closed(event.code,p));
   if(reconnect&&!stopping&&retries++<5){const lobby=net._wn_lobby(),code=new TextDecoder().decode(net.HEAPU8.subarray(lobby+8,lobby+16)).split('\0')[0];setTimeout(()=>{if(own===generation)connect('/v1/rooms/'+code,true);},Math.min(8000,1000*2**(retries-1)));}
  };
  current.onerror=()=>say('Online: no se pudo establecer la conexión.');
  return 0;
 };
 setInterval(()=>{if(socket?.readyState===WebSocket.OPEN&&net._wn_tick())socket.close(1000,'Server timeout');},100);
 const textAt=(at,max)=>new TextDecoder().decode(net.HEAPU8.subarray(at,at+max)).split('\0')[0];
 setInterval(()=>{const p=net._wn_lobby(),code=textAt(p+8,8),members=[];
  for(let i=0;i<Math.min(8,net._wn_member_count());i++){const id=net._wn_member_id?.(i),racer=racers.find(r=>r.memberId===id);members.push({name:textAt(net._wn_member_name(i),100),ready:!!net._wn_member_ready(i),loaded:racer?loaded.has(racer.slot):false,ping:net._wn_member_ping(i)});}
  postMessage({type:'network-status',code,members,capacity,ping:net._wn_ping(),error:textAt(net._wn_error(),200),connected:socket?.readyState===WebSocket.OPEN,racing:!!net._wn_racing(),phase:go?'racing':net._wn_racing()?'loading':'lobby',...stats});
 },1000);
 const copyLobby=a=>{const p=net._wn_lobby(),n=net._wn_lobby_size();span(a,n).set(net.HEAPU8.subarray(p,p+n));};
 // The identity comes from the fully verified extracted files, using the
 // original sorted-path/length/content-hash algorithm. No ISO is needed here.
 let digestJob=0;
 const services={
  host_service_net_offered:()=>1,
  host_service_net_finish:(ticks,place)=>net._wn_finish(ticks,place),
  host_service_net_back:()=>net._wn_back(),
  host_service_net_rules:(finish_window,next,then)=>net._wn_rules(finish_window,next,then),
  host_service_net_rotation:(a,count)=>{if(count>=0&&count<=64){net.HEAPU8.set(span(a,count),buf());net._wn_rotation(count);}},
  host_service_net_end_race:()=>net._wn_end(),
  host_service_net_init:(a,b,c,d)=>{
   const url=env.DHD_NET_SERVER||'';
   if(url){const u=new URL(url);if(!['ws:','wss:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw Error('Dirección WebSocket inválida');base=u.origin;}
   init=[str(b),str(c),str(d)];initialize();
  },
  host_service_net_create_room:()=>connect('/v1/rooms/new'),
  host_service_net_join_room:a=>{const code=str(a).toUpperCase();return /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(code)?connect('/v1/rooms/'+code):-1;},
  host_service_net_leave:close,
  host_service_net_get_lobby:copyLobby,
  host_service_net_set_room:a=>{const bytes=span(a,28),v=new DataView(bytes.buffer,bytes.byteOffset,28);const p=v.getUint32(24,true),expected=Number(env.DHD_NET_PLAYERS),maximum=[2,3,4].includes(expected)?expected:Math.max(2,Math.min(4,v.getInt32(12,true)));return string(p?str(p):null,n=>net._wn_room(v.getInt32(0,true),v.getInt32(4,true),v.getInt32(8,true),maximum,v.getBigInt64(16,true),n));},
  host_service_net_pick:(member,rider,bike)=>net._wn_pick(member,rider,bike),
  host_service_net_set_ready:ready=>net._wn_ready(ready),
  host_service_net_start_race:()=>net._wn_start(),
  host_service_net_racing:()=>net._wn_racing(),
  host_service_net_seconds:()=>net._wn_seconds(),
  host_service_net_server_ms:()=>net._wn_server_ms(),
  host_service_net_send_frame:(type,a,n)=>{if(n>3070)return 0;net.HEAPU8.set(span(a,n),buf());return net._wn_send(type,n);},
  host_service_net_receive_frame:(a,max)=>{const n=net._wn_receive(Math.min(max,3072));if(n)span(a,n).set(net.HEAPU8.subarray(buf(),buf()+n));return n;},
  host_service_net_hash_ranges:(a,count)=>{if(count<0||count>1024)throw Error('Invalid network hash ranges');let hash=0n;const r=span(a,count*8),v=new DataView(r.buffer,r.byteOffset,r.byteLength);for(let i=0;i<count;i++){const addr=v.getUint32(i*8,true),n=v.getUint32(i*8+4,true);if(n>33554432)throw Error('Network hash range too large');const p=net._malloc(Math.max(1,n));try{net.HEAPU8.set(span(addr,n),p);hash=net._net_hash64(p,n,hash);}finally{net._free(p);}}return hash;},
  host_service_disc_check_start:()=>{if(digestJob===1)return 0;digestJob=1;fetch('game-identity.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Identity unavailable');return r.json();}).then(x=>{if(!/^[0-9a-f]{64}$/.test(x.filesSha256))throw Error('Invalid identity');identity=x.filesSha256;digestJob=2;}).catch(()=>digestJob=-1);return 1;},
  host_service_disc_check_poll:(a,note,size)=>{if(digestJob===1)return 0;if(digestJob!==2)return -1;span(a,32).set(Uint8Array.from(identity.match(/../g),x=>parseInt(x,16)));if(size>0)span(note,size).fill(0);digestJob=0;return 1;},
  host_service_net_list_lobbies_start:()=>0,
  host_service_net_list_lobbies_poll:()=>-1,
  host_sleep_ms:new WebAssembly.Suspending(ms=>new Promise(resolve=>setTimeout(resolve,Math.max(0,Math.min(ms,1000)))))
 };
 return {services};
}
