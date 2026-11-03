// SPDX-License-Identifier: GPL-3.0-or-later
import {exportSaves,exportPreviousSaves,validateBackup,restoreSaves} from './saves.js';
export function installSaveUI(){
 const $=id=>document.getElementById(id),message=$('backup-message'),input=$('restore-file'),panel=$('restore-panel');let text='';
 $('backupButton').onclick=async()=>{try{message.textContent=`Copia descargada: ${await exportSaves()} archivos.`;}catch(e){message.textContent=e.message;}};
 $('previousBackupButton').onclick=async()=>{try{await exportPreviousSaves();message.textContent='Copia anterior descargada.';}catch(e){message.textContent=e.message;}};
 $('restoreButton').onclick=()=>input.click();
 input.onchange=async()=>{text='';const file=input.files[0];if(!file)return;
  try{if(file.size>24*1024*1024)throw Error('Copia demasiado grande (máximo 24 MiB).');text=await file.text();const info=await validateBackup(text);
   const cards=info.cards.map(card=>card.slice(-1)).sort().join(' y ');
   $('restore-summary').textContent=`Tarjetas ${cards} · ${info.fileCount} archivos · ${(info.bytes/1024).toFixed(1)} KiB. Se reemplazará su contenido completo, incluidas las carpetas vacías, y se conservará una copia anterior. Las otras pestañas del juego también se detendrán.${info.legacy?' Copia antigua: no incluye comprobación SHA-256.':''}`;
   panel.hidden=false;$('restore-confirm').disabled=false;$('restore-cancel').focus();
  }catch(e){message.textContent=e.message;}finally{input.value='';}
 };
 $('restore-cancel').onclick=()=>{panel.hidden=true;text='';};
 $('restore-confirm').onclick=async()=>{
  $('restore-confirm').disabled=true;try{await restoreSaves(text);location.assign(location.pathname);}catch(e){$('restore-summary').textContent=e.message;$('restore-confirm').disabled=false;}
 };
 panel.addEventListener('keydown',e=>{if(e.key==='Escape')$('restore-cancel').click();if(e.key==='Tab'){const items=[...panel.querySelectorAll('button')].filter(b=>!b.disabled);if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}}});
}
