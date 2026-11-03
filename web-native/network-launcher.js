// SPDX-License-Identifier: GPL-3.0-or-later
export async function installNetworkLauncher(){
 const slot=document.getElementById('network-slot');
 let config;try{const response=await fetch('network-config.json',{cache:'no-store'});if(!response.ok)throw Error();config=await response.json();}catch{slot.textContent='Las salas no están disponibles. Puedes seguir jugando en solitario.';return;}
 if(!config.relay){slot.textContent='Modo individual disponible. Las salas online aún no están habilitadas en este servidor.';return;}
 const form=document.createElement('form');form.setAttribute('aria-label','Partida online');
 form.className='network-form';
 const name=document.createElement('input');name.placeholder='Tu nombre';name.maxLength=24;name.required=true;name.setAttribute('aria-label','Nombre del jugador');name.value=sessionStorage.getItem('rider-name')||'';
 const code=document.createElement('input');code.placeholder='Código de sala';code.maxLength=6;code.setAttribute('aria-label','Código de sala');
 const invite=new URL(location.href).searchParams.get('room');if(invite&&/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(invite.toUpperCase()))code.value=invite.toUpperCase();
 const players=document.createElement('select');players.setAttribute('aria-label','Número de jugadores');
 for(const count of [2,3,4]){const option=document.createElement('option');option.value=String(count);option.textContent=count+' jugadores';players.append(option);}players.value='4';
 const create=document.createElement('button');create.type='button';create.className='create-room';
 const updatePlayers=()=>{create.textContent='Crear sala para '+({'2':'dos','3':'tres','4':'cuatro'}[players.value]);};players.onchange=updatePlayers;updatePlayers();
 const join=document.createElement('button');join.type='submit';join.textContent='Unirse a la sala';join.className='join-room';
 const info=document.createElement('span');info.id='network-room';info.setAttribute('aria-live','polite');
 const share=document.createElement('button');share.type='button';share.className='quiet';share.textContent='Copiar invitación';share.hidden=true;
 const hint=document.createElement('span');hint.className='muted';hint.setAttribute('role','status');
 const roster=document.createElement('ul');roster.className='room-roster';roster.setAttribute('aria-label','Jugadores de la sala');
 const latency=document.createElement('span');latency.className='muted';
 const update=()=>{const state=window.nativeNetworkDiagnostics;share.hidden=!state?.code;
  roster.replaceChildren(...(state?.members||[]).map(member=>{const row=document.createElement('li');row.textContent=member.name+' · '+(state.phase==='racing'?'En carrera':state.racing?(member.loaded?'Pista cargada':'Cargando pista…'):member.ready?'Listo':'Preparándose');return row;}));
  latency.textContent=state?.connected===false&&state.racing?'Conexión interrumpida. No se puede volver a esta carrera; vuelve a la sala al terminar.':state?.error?state.error:state?.connected&&state.ping>=0?'Conexión al servidor: '+state.ping+' ms':'';
 };
 share.onclick=async()=>{const room=window.nativeNetworkDiagnostics?.code;if(!room)return;const url=new URL(location.pathname,location.origin);url.searchParams.set('room',room);
  try{await navigator.clipboard.writeText(url.href);hint.textContent=['127.0.0.1','localhost','[::1]'].includes(location.hostname)?'Enlace local copiado. Solo funciona en este equipo.':'Enlace copiado. Compártelo con tu compañero.';}catch{hint.textContent='Invitación: '+url.href;}
 };
 addEventListener('network-update',update);
 const launch=async host=>{
  if(!name.reportValidity())return;if(!name.value.trim()){name.focus();return;}const room=code.value.trim().toUpperCase();
  if(!host&&!/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(room)){info.textContent='Introduce el código de seis caracteres.';return;}
  const count=['2','3','4'].includes(players.value)?players.value:'4';
  create.disabled=join.disabled=players.disabled=true;info.textContent='Preparando conexión…';
  const response=await fetch('game-identity.json',{cache:'no-store'});if(!response.ok)throw Error('No se pudieron verificar los recursos.');const identity=await response.json();
  const params=new URLSearchParams();params.set('env.DHD_NET_SERVER',config.relay);params.set('env.DHD_NET_NAME',name.value.trim());params.set('env.DHD_NET_ISO_SHA256',identity.filesSha256);if(host)params.set('env.DHD_NET_PLAYERS',count);
  if(host)params.set('env.DHD_NET_CREATE','1');else params.set('env.DHD_NET_JOIN',room);
  sessionStorage.setItem('rider-name',name.value.trim());location.assign('/?'+params);
 };
 const failed=e=>{info.textContent=e.message;create.disabled=join.disabled=players.disabled=false;};
 create.onclick=()=>launch(true).catch(failed);
 form.onsubmit=e=>{e.preventDefault();launch(false).catch(failed);};
 const field=(text,input)=>{const label=document.createElement('label');label.append(text,input);return label;};
 const divider=document.createElement('span');divider.className='network-separator';divider.textContent='O ÚNETE CON UN CÓDIGO';
 code.autocomplete='off';code.spellcheck=false;code.addEventListener('input',()=>code.value=code.value.toUpperCase());
 form.append(field('Tu nombre',name),field('Jugadores de tu sala',players),create,divider,field('Código de seis caracteres',code),join,info,roster,latency,share,hint);slot.replaceChildren(form);update();
}
