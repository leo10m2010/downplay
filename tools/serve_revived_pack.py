#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Loopback-only Revived evaluation backed by prepared resources, without an ISO.

Preserves the original core's sector-read contract using PreparedDisc. The
application does not yet use a new file-level API inside the WASM core.
"""
import argparse
from functools import partial
import hashlib
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import json
from pathlib import Path
import re
import os
import logging
from logging.handlers import RotatingFileHandler
from urllib.parse import unquote,urlsplit,parse_qs

from prepared_disc import PreparedDisc,ROOT,BLOCK
from http_code_cache import CodeCache,accepts_gzip
from project_paths import RUNTIME,NETWORK,ASSETS

PUBLIC={'index.html','main.js','worker.js','settings.js','graphics_common.js','graphics.js','net.js','net_layout.js',
        'vu.js','vfs.js','thunks.js','audio.js','build/imports.json','build/dhd_settings.wasm',
        'build/dhd_core.wasm','build/graphics.wasm','build/gqueue.wasm','build/vu.wasm',
        'build/renderer/dhd_render.js','build/renderer/dhd_render_bg.wasm'}
TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
       '.json':'application/json','.wasm':'application/wasm','.css':'text/css; charset=utf-8'}
ADAPTERS={name:ROOT/'web-native'/name for name in ('index.html','shell.css','ui.js','keyboard.js','gamepads.js','network.js','network-launcher.js','quality.js','lifecycle.js','saves.js','load-progress.js','audio-ring.js')}
ADAPTERS['LICENSE']=ROOT/'LICENSE'
ADAPTERS.update({name:ROOT/'web-native'/name for name in ('mobile.js','input-state.js')})
ADAPTERS['gpu-probe.js']=ROOT/'web-native/gpu-probe.js'
ADAPTERS['network-policy.js']=ROOT/'web-native/network-policy.js'
ADAPTERS.update({name:ROOT/'web-native'/name for name in ('bootstrap.js','compatibility.js','runtime-session.js','save-store.js','save-ui.js','resource-cache.js','audio.js','audio-consumer.js','frame-metrics.js')})
ADAPTERS.update({name:NETWORK/name for name in ('network-core.js','network-core.wasm')})
CODE_CACHE=CodeCache()

class GameHTTPServer(ThreadingHTTPServer):
    request_queue_size=128


def adapt_main(source):
    source=source.replace('\r\n','\n')
    source=source.replace("import { startSettings } from './settings.js';", "import { startSettings } from './settings.js';\nimport { createGamepadInput } from './gamepads.js';")
    source="import {installNetworkLauncher} from './network-launcher.js';\ninstallNetworkLauncher().catch(console.error);\n"+source
    source="import {installKeyboard} from './keyboard.js';\nimport {createKeyInput} from './input-state.js';\nimport {installTouch,installFullscreen,mobileDefaults} from './mobile.js';\n"+source
    source="import {installLifecycle} from './lifecycle.js';\n"+source
    source=source.replace("const addLog = text => { log.textContent += text + '\\n'; log.scrollTop = log.scrollHeight; };", "const addLog = text => { log.textContent=(log.textContent+text+'\\n').slice(-65536);log.scrollTop=log.scrollHeight; };")
    source=source.replace("const worker = new Worker('worker.js', { type: 'module' });", "const worker = new Worker('worker.js', { type: 'module' });\n  window.gameWorker=worker;")
    source=source.replace("window.dhdStatus = m; (window.dhdHistory ??= []).push([m.field, +m.fps.toFixed(2), m.draws]);", "window.dhdStatus=m;(window.dhdHistory??=[]).push([m.field,+m.fps.toFixed(2),m.draws]);if(window.dhdHistory.length>120)window.dhdHistory.shift();")
    start=source.index('// KeyboardEvent.code');end=source.index('// Standard-mapping gamepads',start)
    source=source[:start]+'''let running=false;
const keyInput=createKeyInput(keys);
installKeyboard(keys,canvas,keyInput.source());
installTouch(keyInput,canvas);
const syncVisibility=()=>Atomics.store(mouse,13,document.hidden?1:0);
syncVisibility();document.addEventListener('visibilitychange',syncVisibility);
window.nativeKeyboardDiagnostics=()=>Array.from(keys);
'''+source[end:]
    source=source.replace("if (m.type === 'log') addLog(m.text);", "if (m.type === 'network-status') {window.nativeNetworkDiagnostics=m;const label=document.getElementById('network-room');if(label&&m.code)label.textContent='Sala '+m.code+(m.connected?' · conectada':' · desconectada');}\n    else if (m.type === 'log') addLog(m.text);")
    source=source.replace("else if (m.type === 'log') addLog(m.text);", "else if(m.type==='load-progress') {window.nativeLoadProgress??={};window.nativeLoadProgress[m.url]=m;}\n    else if (m.type === 'log') addLog(m.text);")
    source=source.replace("window.nativeNetworkDiagnostics=m;", "window.nativeNetworkDiagnostics=m;dispatchEvent(new Event('network-update'));")
    start=source.index('// Standard-mapping gamepads');end=source.index('// The mouse and touch',start)
    source=source[:start]+'''const pollGamepads=createGamepadInput(pads,(names,unsupported)=>{
 const info=document.getElementById('gamepad-status');if(info)info.textContent=(names.some(Boolean)?names.map((n,i)=>n?'Jugador '+(i+1)+': '+n:'').filter(Boolean).join(' · '):unsupported.length?'':'Mando: conecta USB/Bluetooth y pulsa un botón')+(unsupported.length?' '+unsupported.join(', ')+': el navegador no reconoce su asignación. Activa el modo XInput si el mando lo permite.':'');
});
window.nativeGamepadDiagnostics=()=>Array.from(pads);
function pollPads(){pollGamepads(navigator.getGamepads?.(),document.hasFocus()&&!document.hidden&&document.getElementById('controls').hidden&&document.getElementById('logPanel').hidden&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName));cursor();requestAnimationFrame(pollPads);}
addEventListener('blur',()=>pollGamepads(navigator.getGamepads?.(),false));
'''+source[end:]
    start=source.index('const fullscreen =');end=source.index('// The Controls and Log buttons',start)
    source=source[:start]+"installFullscreen(canvas,addLog);\n\n"+source[end:]
    source=source.replace("env: { DHD_SETTINGS: 'none', ...env }", "env: mobileDefaults({DHD_SETTINGS:'dhd.ini',...env})")
    source=source.replace("if (params.get('iso') === 'test') start({ isoUrl: '/test-iso'", "if (true) start({ isoUrl: '/game-data'")
    source=source.replace('context.resume();',"installLifecycle(context,audio,keys,canvas);")
    source=source.replace("  const worker = new Worker('worker.js'", "  if(window.nativeSessionStopped)return;\n  const worker = new Worker('worker.js'")
    source=source.replace("new AudioWorkletNode(context,", "const audioNode=new AudioWorkletNode(context,")
    source=source.replace("processorOptions: { ring: audio } }).connect(context.destination);", "processorOptions: { ring: audio } });audioNode.connect(context.destination);audioNode.port.onmessage=e=>{window.nativeAudioStats=e.data;};")
    source=source.replace("if (m.type === 'network-status')", "if(m.type==='resource-progress'){window.nativeResourceProgress=m;}\n    else if(m.type==='load-stage'){window.nativeLoadStage=m.text;}\n    else if (m.type === 'network-status')")
    source=source.replace("worker.onerror = e => addLog('worker error: ' + e.message);", "worker.onerror=e=>{addLog('worker error: '+e.message);status.textContent='stopped: '+e.message;};")
    source=source.replace("else if (m.type === 'log') addLog(m.text);", "else if(m.type==='log'){addLog(m.text);if(/saves stay in memory only|memory card write failed/.test(m.text))document.getElementById('compatibility-message').textContent='No se pudo guardar la partida en este navegador. Permite el almacenamiento o libera espacio antes de cerrar el juego.';}")
    source=source.replace("else if (m.type === 'running') status.textContent = 'running';","else if(m.type==='running'){status.textContent='running';try{sessionStorage.removeItem('downhill.bootstrap.retries');}catch{}}")
    return source.replace("!['INPUT','TEXTAREA']", "document.getElementById('restore-panel').hidden&&!['INPUT','TEXTAREA','SELECT']")


def adapt_worker(source):
    source=source.replace('\r\n','\n')
    source=adapt_error_messages(source)
    source=source.replace('...BROWSER_PC_SETTINGS, ...(m.env || {})', "...BROWSER_PC_SETTINGS,DHD_FPS_MAX:'60',...(m.env||{})")
    source="import {menuStickButtons} from './gamepads.js';\nimport {createBrowserNetwork} from './network.js';\nimport {createAutoQuality} from './quality.js';\nimport {fetchWithProgress} from './load-progress.js';\nimport {writePcm} from './audio-ring.js';\n"+source
    pad_start='  function pad(port, out) {'
    pad_buttons='    o[0] = buttons & 255; o[1] = buttons >> 8;'
    if source.count(pad_start)!=1 or source.count(pad_buttons)!=1:raise ValueError('Unsupported controller insertion point')
    source=source.replace(pad_start,'  const menuSticks=new Uint16Array(4);\n'+pad_start)
    source=source.replace(pad_buttons,'''    menuSticks[port]=dv.getInt32(0x0829E290,true)?0:menuStickButtons(o[4],o[5],menuSticks[port]);
    buttons|=menuSticks[port];
'''+pad_buttons)
    start=source.index('    host_sound_write:');end=source.index('    // The VBLANK',start)
    source=source[:start]+'''    host_sound_write:(a,frames)=>{soundFrames+=frames;writePcm(ring,span(a,frames*4));},
'''+source[end:]
    source=source.replace("const fetchBytes = async url => { const r = await fetch(url); if (!r.ok) throw Error(`${url}: ${r.status}`); return r.arrayBuffer(); };", "const fetchBytes=url=>fetchWithProgress(url,progress=>post('load-progress',progress));")
    source=source.replace("  const settings = await createSettings(env, say);", "  const settings = await createSettings(env, say);\n  const autoQuality=createAutoQuality({maximum:env.DHD_AUTO_MAX_SCALE==='4'?4:2});let firstFrameMs=0;")
    # Pin the ordinary in-game online menus to this server as well. An explicit
    # URL environment override still wins; saved upstream defaults must not.
    source=source.replace("  const env = { DHD_ISO:", "  const networkResponse=await fetch('network-config.json',{cache:'no-store'});if(!networkResponse.ok)throw Error('No se pudo leer la configuración de salas.');const networkConfig=await networkResponse.json();\n  const env = { DHD_NET_SERVER:networkConfig.relay||'', DHD_ISO:")
    source=source.replace('lastReport = performance.now(), lastField = 0;', 'lastReport = performance.now(), lastField = 0, lastShown = 0;')
    source=source.replace('if (now - lastReport >= 1000) {', 'if (now - lastReport >= 1000) {\n        const presentFps=Math.max(0,(shown-lastShown)*1000/(now-lastReport));')
    source=source.replace("post('status', { field, fps:", "post('status', { presentFps,field,fps:")
    source=source.replace('lastReport = now; lastField = field;', 'lastReport = now; lastField = field; lastShown = shown;')
    source=source.replace("    size = Number(head.getResponseHeader('Content-Length'));", "    if(head.status!==200)throw Error('No se encuentran los recursos preparados.');\n    size=Number(head.getResponseHeader('Content-Length'));if(!Number.isSafeInteger(size)||size<=0)throw Error('Tamaño de recursos inválido.');")
    source=source.replace("if (x.status !== 206) throw Error(`disc read ${x.status}`); return new Uint8Array(x.response);", "if(x.status!==206||x.response?.byteLength!==n)throw Error('Lectura de recursos incompleta ('+x.status+').');return new Uint8Array(x.response);")
    source=source.replace("    while (done < out.length && pos + done < size) {", "    if(!Number.isSafeInteger(pos)||pos<0)throw Error('Posición de lectura inválida.');\n    while (done < out.length && pos + done < size) {")
    source=source.replace("      const n = Math.min(out.length - done, b.length - off);", "      const n = Math.min(out.length - done, b.length - off);if(n<=0)throw Error('Recurso truncado.');")
    source=source.replace("      const now = performance.now();\n      if (now - lastReport >= 1000)", "      const now = performance.now();if(!firstFrameMs)firstFrameMs=now-t0;\n      if (now - lastReport >= 1000)")
    source=source.replace("      const now = performance.now();if(!firstFrameMs)", "      riding=dv.getInt32(0x0829E290,true)!==0;Atomics.store(mouse,12,riding?1:0);\n      const now = performance.now();if(!firstFrameMs)")
    source=source.replace("renderer: 'rust', submits: stats(3), scale: stats(4), workers: threaded ? 3 : 1 });", "renderer:'rust',submits:stats(3),scale:stats(4),workers:threaded?3:1,memoryBytes:memory.buffer.byteLength,bootMs:firstFrameMs });\n        if(env.DHD_AUTO_QUALITY!=='0'){const next=autoQuality.sample({fps:Math.min(presentFps,(field-lastField)*1000/(now-lastReport)),riding,scale:stats(4)},now);if(next!==null){setEnv('DHD_SCALE',String(next));say('Calidad automática: resolución x'+next);}}")
    anchor='  const graphicsExports = new Set('
    if source.count(anchor)!=1:raise ValueError('Unsupported network insertion point')
    source=source.replace(anchor,"  Object.assign(impl,(await createBrowserNetwork({env,span,str,say})).services);\n"+anchor)
    # Resource reads suspend the original C caller through the same JSPI fibers.
    source="import {createResourceSource} from './resource-cache.js';\nimport {createFrameMetrics} from './frame-metrics.js';\n"+source
    start=source.index('function discSource(m)');end=source.index('// keyboard.c',start)
    source=source[:start]+source[end:]
    source=source.replace('  const disc = discSource(m);', "  post('load-stage',{text:'Verificando recursos y caché local…'});\n  const disc=await createResourceSource(m,data=>post('resource-progress',data));")
    start=source.index('    host_file_read:');end=source.index('    host_file_write:',start)
    source=source[:start]+'''    host_file_read:new WebAssembly.Suspending((id,a,n)=>{
      const f=files.get(id);if(!f||f.sink)return 0n;
      const out=span(a,n);if(!f.disc)return BigInt(vfs.read(f,out));
      const cached=disc.readCached(f.pos,out);if(cached!==null){f.pos+=cached;return BigInt(cached);}
      return disc.read(f.pos,out).then(got=>{f.pos+=got;return BigInt(got);});
    }),
'''+source[end:]
    source=source.replace('  const autoQuality=createAutoQuality(', '  const frameMetrics=createFrameMetrics();const autoQuality=createAutoQuality(')
    source=source.replace('const now = performance.now();if(!firstFrameMs)', 'const now = performance.now();frameMetrics.sample(now);if(!firstFrameMs)')
    source=source.replace('memoryBytes:memory.buffer.byteLength,bootMs:firstFrameMs', 'memoryBytes:memory.buffer.byteLength,bootMs:firstFrameMs,frameMetrics:frameMetrics.snapshot()')
    source=source.replace('  const [coreModule, graphicsModule, queueModule, vuModule]', "  post('load-stage',{text:'Compilando el motor y los módulos gráficos…'});\n  const [coreModule, graphicsModule, queueModule, vuModule]")
    source=source.replace('  const t0 = performance.now();', "  const t0=performance.now(),loadTimings={};let stage='download',stageAt=t0,firstRaceMs=0;const loadStage=(key,text)=>{loadTimings[stage]=(loadTimings[stage]||0)+performance.now()-stageAt;stage=key;stageAt=performance.now();post('load-stage',{stage:key,text,timings:{...loadTimings}});};")
    source=source.replace("post('load-stage',{text:'Compilando el motor y los módulos gráficos…'});", "loadStage('compile','Compilando el motor y los módulos gráficos…');")
    source=source.replace("post('load-stage',{text:'Verificando recursos y caché local…'});", "loadStage('resources','Verificando recursos y caché local…');")
    source=source.replace('  const vfs = await createVfs(say);', "  loadStage('memory','Preparando memoria y partidas guardadas…');\n  const vfs=await createVfs(say);")
    source=source.replace("    post('running', {});", "    loadStage('startup','Iniciando el juego…');post('running', {});")
    source=source.replace("  post('running', {});", "  loadStage('startup','Iniciando el juego…');post('running', {});")
    source=source.replace('if(!firstFrameMs)firstFrameMs=now-t0;', "if(!firstFrameMs){firstFrameMs=now-t0;loadStage('menu','Menú original listo.');}if(riding&&!firstRaceMs){firstRaceMs=now-t0;loadStage('race','En pista.');}")
    source=source.replace('frameMetrics:frameMetrics.snapshot()', 'frameMetrics:frameMetrics.snapshot(),resourceIO:{syncReads:disc.stats.syncReads,asyncReads:disc.stats.asyncReads},loadTimings:{...loadTimings,firstMenuMs:firstFrameMs,firstRaceMs}')
    source=source.replace("if(env.DHD_AUTO_QUALITY!=='0'){", "if(env.DHD_AUTO_QUALITY!=='0'&&!Atomics.load(mouse,13)){")
    return source

def adapt_error_messages(source):
    return "import {formatRuntimeError} from './gpu-probe.js';\n"+source.replace('String(err?.stack || err)','formatRuntimeError(err)')


def adapt_vfs(source):
    source=source.replace('\r\n','\n')
    return source.replace("const t = db.transaction(STORE, 'readwrite'); value ?", "const t=db.transaction(STORE,'readwrite');t.onerror=t.onabort=()=>log('memory card write failed: '+(t.error?.name||'storage unavailable'));value ?")


class Handler(BaseHTTPRequestHandler):
    def __init__(self,*args,disc,relay=None,**kwargs):
        self.disc=disc;self.relay=relay;super().__init__(*args,**kwargs)

    def end_headers(self):
        for k,v in {'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp',
                    'Cross-Origin-Resource-Policy':'same-origin','Cache-Control':getattr(self,'cache_control','no-store'),
                    'X-Content-Type-Options':'nosniff'}.items():self.send_header(k,v)
        super().end_headers()

    def do_HEAD(self):self.respond(head=True)
    def do_GET(self):self.respond()
    def log_message(self,format,*args):
        logger=getattr(self.server,'request_logger',None)
        if logger:logger.info('%s %s',self.client_address[0],format%args)

    def respond(self,head=False):
        self.cache_control='no-store'
        route=unquote(urlsplit(self.path).path)
        if route=='/release.json':
            data=(ROOT/'release.json').read_bytes()
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers()
            if not head:self.wfile.write(data)
            return
        if route in ('/game-identity.json','/network-config.json'):
            data=json.dumps({'filesSha256':self.disc.files_sha256,'resourceSha256':getattr(self.disc,'sha256',None)} if route=='/game-identity.json' else {'relay':self.relay}).encode()
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers()
            if not head:self.wfile.write(data)
            return
        if route=='/game-data':
            requested=parse_qs(urlsplit(self.path).query).get('version',[])
            if requested and (len(requested)!=1 or requested[0]!=getattr(self.disc,'sha256',None)):
                self.send_error(412,'Resource version changed; reload the page');return
            if head:
                self.send_response(200);self.send_header('Content-Length',str(self.disc.size));self.end_headers();return
            match=re.fullmatch(r'bytes=(\d+)-(\d+)',self.headers.get('Range',''))
            if not match:self.send_error(416,'Use a bounded resource range');return
            start,end=map(int,match.groups());length=end-start+1
            if length<=0 or length>4*BLOCK or start>=self.disc.size or end>=self.disc.size:
                self.send_error(416,'Resource range out of bounds');return
            try:data=self.disc.read(start,length)
            except (OSError,ValueError):self.send_error(500,'Prepared resource unreadable');return
            self.send_response(206);self.send_header('Content-Type','application/octet-stream')
            self.send_header('Content-Length',str(length));self.send_header('Content-Range',f'bytes {start}-{end}/{self.disc.size}')
            self.send_header('X-Content-SHA256',hashlib.sha256(data).hexdigest())
            self.send_header('Accept-Ranges','bytes');self.end_headers();self.wfile.write(data);return
        name=route.lstrip('/') or 'index.html'
        if name not in PUBLIC and name not in ADAPTERS:self.send_error(404);return
        path=ADAPTERS[name] if name in ADAPTERS else RUNTIME/name
        transform={'main.js':adapt_main,'worker.js':adapt_worker,'vfs.js':adapt_vfs,
                   'graphics.js':adapt_error_messages,'vu.js':adapt_error_messages}.get(name)
        raw,compressed,etag=CODE_CACHE.get(path,transform)
        zipped=compressed is not raw and accepts_gzip(self.headers.get('Accept-Encoding',''))
        data=compressed if zipped else raw
        # Different encoded representations have different strong validators.
        if zipped:etag=etag[:-1]+'-gzip"'
        self.cache_control='private, max-age=0, must-revalidate'
        if etag in [part.strip() for part in self.headers.get('If-None-Match','').split(',')]:
            self.send_response(304);self.send_header('ETag',etag);self.send_header('Vary','Accept-Encoding');self.end_headers();return
        self.send_response(200);self.send_header('Content-Type',TYPES.get(Path(name).suffix,'application/octet-stream'))
        self.send_header('ETag',etag);self.send_header('Vary','Accept-Encoding')
        self.send_header('X-Uncompressed-Length',str(len(raw)))
        if zipped:self.send_header('Content-Encoding','gzip')
        self.send_header('Content-Length',str(len(data)));self.end_headers()
        if not head:self.wfile.write(data)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--assets',type=Path,default=ASSETS)
    p.add_argument('--port',type=int,default=8093)
    p.add_argument('--relay',default=os.environ.get('DHD_NET_SERVER'),help='WebSocket relay for online rooms; no automatic public connection')
    p.add_argument('--request-log',type=Path,help='Registro limitado a 3 archivos de 2 MiB')
    a=p.parse_args()
    if not 1024<=a.port<=65535:p.error('Puerto inválido.')
    disc=PreparedDisc(a.assets,verify=True)
    records={r['name']:r for r in json.loads((RUNTIME/'download-manifest.json').read_text())['files']}
    for name in PUBLIC:
        raw=(RUNTIME/name).read_bytes()
        if hashlib.sha256(raw).hexdigest()!=records[name]['sha256']:p.error('Código de evaluación modificado: '+name)
    main_source=(RUNTIME/'main.js').read_text()
    if "if (params.get('iso') === 'test') start({ isoUrl: '/test-iso'" not in main_source:p.error('Arranque upstream incompatible.')
    if not all(path.is_file() for path in ADAPTERS.values()):p.error('Build the network adapter with tools/build_browser_network.py')
    if a.relay:
        relay_url=urlsplit(a.relay)
        if relay_url.scheme not in ('ws','wss') or not relay_url.netloc or relay_url.username or relay_url.password or relay_url.query or relay_url.fragment:p.error('Relay WebSocket inválido.')
    server=GameHTTPServer(('127.0.0.1',a.port),partial(Handler,disc=disc,relay=a.relay))
    if a.request_log:
        a.request_log.parent.mkdir(parents=True,exist_ok=True)
        logger=logging.getLogger('downhill.requests');logger.setLevel(logging.INFO);logger.propagate=False
        handler=RotatingFileHandler(a.request_log,maxBytes=2*1024*1024,backupCount=2,encoding='utf-8');logger.addHandler(handler);server.request_logger=logger
    print(f'http://127.0.0.1:{a.port}/ · paquete preparado; ninguna ISO abierta',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()


if __name__=='__main__':main()
