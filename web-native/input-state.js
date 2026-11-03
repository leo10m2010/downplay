// SPDX-License-Identifier: GPL-3.0-or-later
// Multiple physical sources share the core's key array without releasing each other.
export function createKeyInput(keys){
 const counts=new Uint16Array(keys.length);
 return {source(){
  const held=new Set();
  const set=(key,down)=>{
   if(!Number.isInteger(key)||key<0||key>=keys.length)return;
   if(down&&!held.has(key)){held.add(key);counts[key]++;}
   else if(!down&&held.delete(key))counts[key]--;
   Atomics.store(keys,key,counts[key]>0?1:0);
  };
  return {set,clear(){for(const key of [...held])set(key,false);}};
 }};
}
