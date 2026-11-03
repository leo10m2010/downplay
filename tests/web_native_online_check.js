// SPDX-License-Identifier: GPL-3.0-or-later
// Two actual browser games, original relay, private prepared assets.
async(page)=>{
 for(const p of page.context().pages())if(p!==page)await p.close();
 await page.bringToFront();await page.goto('http://127.0.0.1:8109/');
 await page.getByRole('combobox',{name:'Número de jugadores'}).selectOption('2');
 await page.getByRole('textbox',{name:'Nombre del jugador'}).fill('Host');await page.getByRole('button',{name:'Crear sala para dos',exact:true}).click();
 await page.waitForFunction(()=>window.nativeNetworkDiagnostics?.connected&&window.nativeNetworkDiagnostics.code,null,{timeout:30000});
 const code=await page.evaluate(()=>window.nativeNetworkDiagnostics.code);
 await page.waitForFunction(()=>!document.querySelector('.network-form button:last-of-type').hidden);
 await page.evaluate(()=>{window.originalClipboard=Object.getOwnPropertyDescriptor(navigator,'clipboard');Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedInvitation=text;}}});});
 try{await page.getByRole('button',{name:'Copiar invitación'}).click();const copied=await page.evaluate(()=>window.copiedInvitation);if(copied!=='http://127.0.0.1:8109/?room='+code)throw Error('Invalid invitation URL');}
 finally{await page.evaluate(()=>{if(window.originalClipboard)Object.defineProperty(navigator,'clipboard',window.originalClipboard);else delete navigator.clipboard;});}
 const guest=await page.context().newPage();await guest.goto('http://127.0.0.1:8109/?room='+code);
 if(await guest.getByRole('textbox',{name:'Código de sala'}).inputValue()!==code)throw Error('Invitation did not fill room code');
 await guest.getByRole('textbox',{name:'Nombre del jugador'}).fill('Guest');await guest.getByRole('button',{name:'Unirse a la sala',exact:true}).click();
 await page.bringToFront();
 for(const p of [page,guest])await p.waitForFunction(()=>window.nativeNetworkDiagnostics?.sentStates>10&&window.nativeNetworkDiagnostics?.receivedStates>10,null,{timeout:160000});
 for(const p of [page,guest])if((await p.locator('.room-roster li').count())!==2)throw Error('Room roster missing players');
 await page.locator('#screen').click();await page.keyboard.down('x');try{await page.waitForTimeout(2500);}finally{await page.keyboard.up('x');}
 await page.locator('#screen').screenshot({path:'output/playwright/native-online-host.png'});await guest.locator('#screen').screenshot({path:'output/playwright/native-online-guest.png'});
 const result=async p=>p.evaluate(()=>({network:window.nativeNetworkDiagnostics,game:window.dhdStatus,countdown:document.getElementById('log').textContent.match(/countdown starts[^\n]*/)?.[0]}));
 return {code,host:await result(page),guest:await result(guest)};
}
