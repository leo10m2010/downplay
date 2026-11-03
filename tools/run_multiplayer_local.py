#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Run the prepared-resource game and the original relay on loopback only."""
import argparse
from pathlib import Path
import os
import shutil
import socket
import subprocess
import sys
import time
import webbrowser
from project_paths import ASSETS,NETWORK,UPSTREAM

ROOT=Path(__file__).resolve().parents[1]


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--port',type=int,default=8095);p.add_argument('--relay-port',type=int,default=8787)
    p.add_argument('--open',action='store_true',help='Abrir el navegador cuando el juego esté listo')
    args=p.parse_args()
    if args.port==args.relay_port or not all(1024<=n<=65535 for n in (args.port,args.relay_port)):p.error('Puertos inválidos.')
    for port in (args.port,args.relay_port):
        with socket.socket() as sock:
            if sock.connect_ex(('127.0.0.1',port))==0:p.error(f'El puerto {port} ya está ocupado; no se detuvo ningún proceso.')
    server=ROOT/'relay' if (ROOT/'relay').is_dir() else UPSTREAM/'online/server'
    if not (server/'node_modules/wrangler/bin/wrangler.js').is_file():p.error('Faltan las dependencias del relay; instala su package-lock con npm ci.')
    if not (ASSETS/'index.json').is_file():p.error('Prepara primero los recursos con tools/prepared_disc.py.')
    if not (NETWORK/'network-core.wasm').is_file():p.error('Compila primero tools/build_browser_network.py.')
    node=shutil.which('node')
    if not node:p.error('No se encuentra Node.js.')
    log=ROOT/'logs/local-multiplayer.log';log.parent.mkdir(exist_ok=True);children=[]
    flags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0
    print('Verificando recursos e iniciando el juego…',flush=True)
    try:
        with log.open('a',encoding='utf-8') as stream:
            children.append(subprocess.Popen([node,'node_modules/wrangler/bin/wrangler.js','dev','--local','--ip','127.0.0.1','--port',str(args.relay_port),'--persist-to',str(ROOT/'private/relay-state'/str(args.relay_port))],cwd=server,stdout=stream,stderr=stream,creationflags=flags))
            children.append(subprocess.Popen([sys.executable,str(ROOT/'tools/serve_revived_pack.py'),'--port',str(args.port),'--relay',f'ws://127.0.0.1:{args.relay_port}'],cwd=ROOT,stdout=stream,stderr=stream,creationflags=flags))
            deadline=time.monotonic()+60
            while True:
                if any(child.poll() is not None for child in children):raise RuntimeError('No se pudo iniciar. Consulta '+str(log))
                ready=True
                for port in (args.port,args.relay_port):
                    with socket.socket() as probe:
                        probe.settimeout(.2)
                        ready=probe.connect_ex(('127.0.0.1',port))==0 and ready
                if ready:break
                if time.monotonic()>deadline:raise RuntimeError('El arranque tardó demasiado. Consulta '+str(log))
                time.sleep(.2)
            url=f'http://127.0.0.1:{args.port}/'
            print(f'Juego listo: {url} · Ctrl+C para detener',flush=True)
            if args.open:webbrowser.open(url)
            while all(child.poll() is None for child in children):
                try:children[0].wait(timeout=1)
                except subprocess.TimeoutExpired:pass
    except KeyboardInterrupt:pass
    except RuntimeError as error:p.exit(1,str(error)+'\n')
    finally:
        for child in reversed(children):
            if child.poll() is None:
                if os.name=='nt':subprocess.run(['taskkill','/PID',str(child.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
                else:child.terminate()


if __name__=='__main__':main()
