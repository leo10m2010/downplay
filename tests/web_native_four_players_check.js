// SPDX-License-Identifier: GPL-3.0-or-later
// Four real game instances using the configured public relay and private assets.
async(page)=>{
 for(const p of page.context().pages())if(p!==page)await p.close();
 const base='http://127.0.0.1:8109/';
 await page.bringToFront();await page.goto(base);
 await page.getByRole('combobox',{name:'Número de jugadores'}).selectOption('4');
 await page.getByRole('textbox',{name:'Nombre del jugador'}).fill('Host4');
 await page.getByRole('button',{name:'Crear sala para cuatro',exact:true}).click();
 await page.waitForFunction(()=>window.nativeNetworkDiagnostics?.code&&window.nativeNetworkDiagnostics.connected,null,{timeout:30000});
 if(await page.evaluate(()=>new URL(location.href).searchParams.get('env.DHD_NET_PLAYERS'))!=='4')throw Error('Host did not request four players');
 const code=await page.evaluate(()=>window.nativeNetworkDiagnostics.code),clients=[page];
 for(let i=2;i<=4;i++){
  if(i===4){
   await page.waitForFunction(()=>window.nativeNetworkDiagnostics?.members.length===3,null,{timeout:15000});
   await page.waitForTimeout(7000);
   if(await page.evaluate(()=>window.nativeNetworkDiagnostics.racing))throw Error('Race started before the fourth player joined');
  }
  const guest=await page.context().newPage();clients.push(guest);
  await guest.goto(base+'?room='+code);
  await guest.getByRole('textbox',{name:'Nombre del jugador'}).fill('Player'+i);
  await guest.getByRole('button',{name:'Unirse a la sala',exact:true}).click();
  await guest.waitForFunction(()=>window.nativeNetworkDiagnostics?.connected&&window.nativeNetworkDiagnostics.members.length>=2,null,{timeout:30000});
 }
 await page.bringToFront();
 const results=await Promise.all(clients.map(async p=>{
  await p.waitForFunction(()=>window.nativeNetworkDiagnostics?.members.length===4&&window.nativeNetworkDiagnostics.racing&&window.nativeNetworkDiagnostics.sentStates>10&&window.nativeNetworkDiagnostics.receivedStates>10&&window.dhdStatus?.riding,null,{timeout:150000});
  if(await p.locator('.room-roster li').count()!==4)throw Error('Incomplete roster');
  return p.evaluate(()=>({network:window.nativeNetworkDiagnostics,game:window.dhdStatus,crossOriginIsolated,position:document.getElementById('log').textContent.match(/player \d of 4/)?.[0]}));
 }));
 await page.locator('#screen').screenshot({path:'output/playwright/four-players-host.png'});
 if(new Set(results.map(r=>r.position)).size!==4||results.some(r=>!r.position))throw Error('The game did not assign four distinct player slots');
 return {passed:true,code,clients:results};
}
