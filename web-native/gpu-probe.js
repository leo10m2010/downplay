// SPDX-License-Identifier: GPL-3.0-or-later
// Exercise the masked CAS used by raster.wgsl. API presence alone is insufficient:
// affected WebKit builds generate a Metal struct with an illegal thread-qualified field.
// Upstream fix: WebKit/WebKit@4f56cc248e8a2e447f77d54d7612d2a6128daccb.
export const ATOMIC_PROBE=`
@group(0) @binding(0) var<storage, read_write> words: array<atomic<u32>>;
@compute @workgroup_size(1) fn main() {
 var old = atomicLoad(&words[0]);
 loop {
  let r = atomicCompareExchangeWeak(&words[0], old, (old & 0xffffff00u) | 1u);
  if (r.exchanged) { break; }
  old = r.old_value;
 }
}`;
export function graphicsFailureMessage(error){
 const text=String(error?.message||error||'Error gráfico desconocido');
 if(/field may not be qualified with an address space|__atomic_compare_exchange_result<thread/is.test(text))
  return 'El navegador tiene un fallo al compilar una operación gráfica necesaria (WebGPU/Metal). En iPhone, actualiza iOS desde Ajustes → General → Actualización de software y vuelve a probar. Cambiar entre Safari y Chrome puede conservar el mismo fallo. Si persiste, esa versión del sistema todavía no es compatible con el renderizador. El detalle está en Abrir registro.';
 return 'No se pudo preparar WebGPU para el juego. '+text.slice(0,500);
}
export async function probeAtomicShader(adapter,signal){
 let device;
 const cancel=()=>device?.destroy();
 try{
  signal?.throwIfAborted();
  device=await adapter.requestDevice();
  signal?.throwIfAborted();signal?.addEventListener('abort',cancel,{once:true});
  const module=device.createShaderModule({label:'Downplay: comprobar operación atómica',code:ATOMIC_PROBE});
  await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
 }finally{signal?.removeEventListener('abort',cancel);device?.destroy();}
}

// WebKit stacks can omit the message entirely. Preserve it when crossing workers.
export function formatRuntimeError(error){
 const message=String(error?.message||error||'Error desconocido'),stack=String(error?.stack||'');
 const text=stack.includes(message)?stack:message+(stack?'\n'+stack:'');
 return text.length<=32768?text:text.slice(0,4096)+'\n[… registro abreviado …]\n'+text.slice(-28600);
}
