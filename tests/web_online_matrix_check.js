// SPDX-License-Identifier: GPL-3.0-or-later
// Playwright CLI run-code: real cores, local dual-protocol relay, same PC.
async(page)=>{
 await page.goto('about:blank');const results=[];
 for(const count of [2,3,4]){
  const context=await page.context().browser().newContext(),clients=[];
  try{
   await context.route('**/network-config.json',route=>route.fulfill({json:{relay:'ws://127.0.0.1:8788'}}));
   const host=await context.newPage();clients.push(host);await host.goto('http://127.0.0.1:8096/');
   await host.getByRole('combobox',{name:'Número de jugadores'}).selectOption(String(count));
   await host.getByRole('textbox',{name:'Nombre del jugador'}).fill('Host'+count);
   await host.getByRole('button',{name:/Crear sala para/}).click();
   await host.waitForFunction(()=>window.nativeNetworkDiagnostics?.connected&&window.nativeNetworkDiagnostics.code,null,{timeout:45000});
   const code=await host.evaluate(()=>window.nativeNetworkDiagnostics.code);
   for(let i=2;i<=count;i++){
    if(i===count&&count>2){
     await host.waitForFunction(n=>window.nativeNetworkDiagnostics?.members.length===n,count-1,{timeout:30000});
     await host.waitForTimeout(7000);
     if(await host.evaluate(()=>window.nativeNetworkDiagnostics.racing))throw Error('Started before '+count+' players');
    }
    const guest=await context.newPage();clients.push(guest);await guest.goto('http://127.0.0.1:8096/?room='+code);
    await guest.getByRole('textbox',{name:'Nombre del jugador'}).fill('Player'+i);
    await guest.getByRole('button',{name:'Unirse a la sala',exact:true}).click();
    await guest.waitForFunction(()=>window.nativeNetworkDiagnostics?.connected,null,{timeout:45000});
   }
   const states=await Promise.all(clients.map(async tab=>{
    await tab.waitForFunction(n=>window.nativeNetworkDiagnostics?.racing&&window.nativeNetworkDiagnostics.members.length===n&&window.nativeNetworkDiagnostics.sentStates>10&&window.nativeNetworkDiagnostics.receivedStates>10&&window.dhdStatus?.riding,count,{timeout:180000});
    return tab.evaluate(()=>({network:window.nativeNetworkDiagnostics,game:window.dhdStatus,slot:document.getElementById('log').textContent.match(/player \d of \d/)?.[0]}));
   }));
   if(states.some(s=>!s.slot)||new Set(states.map(s=>s.slot)).size!==count)throw Error('Slots not distinct: '+JSON.stringify(states));
   await host.close();await clients[1].waitForFunction(n=>window.nativeNetworkDiagnostics?.members.length===n,count-1,{timeout:20000});
   results.push({count,code,states,hostDepartureReported:true});
  }catch(error){const logs=await Promise.all(clients.filter(p=>!p.isClosed()).map(p=>p.locator('#log').textContent().catch(()=>'')));throw Error(String(error)+' '+JSON.stringify(logs));}
  finally{await context.close();}
 }
 return {passed:true,testType:'real browser cores, same PC, local relay',results};
}
