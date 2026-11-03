// SPDX-License-Identifier: GPL-3.0-or-later
async(page)=>{
 for(const p of page.context().pages())if(p!==page)await p.close();
 const base='http://127.0.0.1:8109/';await page.bringToFront();await page.goto(base);
 await page.getByRole('combobox',{name:'Número de jugadores'}).selectOption('3');
 await page.getByRole('textbox',{name:'Nombre del jugador'}).fill('Host3');
 await page.getByRole('button',{name:'Crear sala para tres',exact:true}).click();
 await page.waitForFunction(()=>window.nativeNetworkDiagnostics?.connected&&window.nativeNetworkDiagnostics.code,null,{timeout:30000});
 const code=await page.evaluate(()=>window.nativeNetworkDiagnostics.code),clients=[page];
 for(let i=2;i<=3;i++){
  if(i===3){await page.waitForFunction(()=>window.nativeNetworkDiagnostics?.members.length===2,null,{timeout:15000});await page.waitForTimeout(7000);if(await page.evaluate(()=>window.nativeNetworkDiagnostics.racing))throw Error('Started before the third player joined');}
  const guest=await page.context().newPage();clients.push(guest);await guest.goto(base+'?room='+code);
  await guest.getByRole('textbox',{name:'Nombre del jugador'}).fill('Player'+i);await guest.getByRole('button',{name:'Unirse a la sala',exact:true}).click();
  await guest.waitForFunction(()=>window.nativeNetworkDiagnostics?.connected,null,{timeout:30000});
 }
 const states=await Promise.all(clients.map(async p=>{
  await p.waitForFunction(()=>window.nativeNetworkDiagnostics?.racing&&window.nativeNetworkDiagnostics.members.length===3&&window.nativeNetworkDiagnostics.sentStates>10&&window.nativeNetworkDiagnostics.receivedStates>10&&window.dhdStatus?.riding,null,{timeout:180000});
  const state=await p.evaluate(()=>({network:window.nativeNetworkDiagnostics,position:document.getElementById('log').textContent.match(/player \d of 3/)?.[0]}));
  await p.evaluate(()=>{const start=performance.now(),samples=[];let count=0;const sample=()=>{samples.push({atMs:performance.now()-start,game:window.dhdStatus,network:window.nativeNetworkDiagnostics,resource:window.nativeResourceProgress,jsHeapBytes:performance.memory?.usedJSHeapSize,logBytes:document.getElementById('log').textContent.length});if(samples.length>400)samples.shift();count++;};sample();const timer=setInterval(sample,10000);window.nativeSoakReport=()=>({kind:'online-three',targetMs:1800000,elapsedMs:performance.now()-start,count,samples});window.nativeStopSoak=()=>{clearInterval(timer);sample();return window.nativeSoakReport();};});
  return state;
 }));
 if(new Set(states.map(s=>s.position)).size!==3||states.some(s=>!s.position))throw Error('Game did not assign three distinct slots');
 return {passed:true,code,states,soakStartedMinutes:30};
}
