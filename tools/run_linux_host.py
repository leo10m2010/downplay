#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Run the prepared game on loopback, optionally behind an email-protected tunnel."""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import sys
import time
from urllib.request import urlopen
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parents[1]

def read_config(path):
    value=json.loads(Path(path).read_text(encoding='utf-8'))
    if not isinstance(value,dict):raise ValueError('La configuración debe ser un objeto JSON.')
    port=value.get('port',8095)
    if type(port)is not int or not 1024<=port<=65535:raise ValueError('Puerto inválido.')
    relay=value.get('relay')
    if relay is None:relay=''
    if not isinstance(relay,str):raise ValueError('Dirección de salas inválida.')
    if relay:
        url=urlsplit(relay)
        if url.scheme!='wss' or not url.hostname or url.username or url.password or url.query or url.fragment or url.path not in ('','/'):
            raise ValueError('El relay debe ser wss://servidor, sin credenciales ni rutas.')
    emails=value.get('allowedEmails',[])
    if not isinstance(emails,list) or any(not isinstance(e,str) or not re.fullmatch(r'[^\s@,*]+@[^\s@,*]+\.[^\s@,*]+',e) for e in emails):
        raise ValueError('allowedEmails debe contener direcciones de correo concretas.')
    result={'port':port,'relay':relay,'allowedEmails':emails}
    if value.get('publicHostname'):
        hostname=value['publicHostname']
        if not isinstance(hostname,str) or not re.fullmatch(r'(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}',hostname):raise ValueError('Nombre de dominio inválido.')
        result['publicHostname']=hostname.lower()
    return result

def tunnel_command(executable,url,emails):
    if not emails:raise ValueError('Indica tu correo en allowedEmails antes de abrir el túnel privado.')
    command=[executable,'tunnel','--url',url]
    for email in emails:command+=['--allowed-mail',email]
    return command

def stop(child):
    if child.poll() is not None:return
    if os.name=='nt':
        subprocess.run(['taskkill','/PID',str(child.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    else:
        try:os.killpg(child.pid,signal.SIGTERM)
        except ProcessLookupError:return
        try:child.wait(timeout=8)
        except subprocess.TimeoutExpired:
            try:os.killpg(child.pid,signal.SIGKILL)
            except ProcessLookupError:pass
    try:child.wait(timeout=5)
    except subprocess.TimeoutExpired:pass

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config',type=Path,default=ROOT/'host.json')
    parser.add_argument('--port',type=int,help='Puerto alternativo para una prueba local')
    parser.add_argument('--tunnel',action='store_true',help='Crear URL HTTPS temporal protegida por correo')
    parser.add_argument('--quick-tunnel',action='store_true',help='Prueba temporal protegida por correo, en lugar del dominio fijo')
    parser.add_argument('--tunnel-token-file',type=Path,default=Path('/etc/cloudflared/downhill.token'))
    parser.add_argument('--startup-timeout',type=int,default=300,help='Máximo para verificar recursos al iniciar, en segundos')
    args=parser.parse_args()
    if sys.version_info<(3,11):parser.error('Se necesita Python 3.11 o posterior.')
    try:config=read_config(args.config)
    except (OSError,ValueError) as error:parser.error(str(error))
    port=args.port if args.port is not None else config['port']
    if not 1024<=port<=65535:parser.error('Puerto inválido.')
    with socket.socket() as probe:
        probe.settimeout(.5)
        if probe.connect_ex(('127.0.0.1',port))==0:parser.error(f'El puerto {port} está ocupado; no se detuvo ningún proceso.')
    url=f'http://127.0.0.1:{port}'
    tunnel=None
    if args.tunnel or args.quick_tunnel:
        executable=shutil.which('cloudflared')
        if not executable:parser.error('Instala cloudflared: https://developers.cloudflare.com/tunnel/downloads/')
        if config.get('publicHostname') and not args.quick_tunnel:
            if not args.tunnel_token_file.is_file():parser.error('Falta el archivo de credencial del túnel. Ejecuta el instalador Linux o indica --tunnel-token-file. No se abrió ningún túnel.')
            from install_linux_host import access_protected
            if not access_protected(config['publicHostname']):parser.error('No se comprobó Access en el dominio. Configura la protección antes de abrir el túnel.')
            tunnel=[executable,'--no-autoupdate','tunnel','run','--token-file',str(args.tunnel_token_file)]
        else:
            try:tunnel=tunnel_command(executable,url,config['allowedEmails'])
            except ValueError as error:parser.error(str(error))
            try:help_result=subprocess.run([executable,'tunnel','--help'],capture_output=True,text=True,timeout=15)
            except (OSError,subprocess.TimeoutExpired) as error:parser.error('No se pudo comprobar cloudflared: '+str(error))
            if '--allowed-mail' not in help_result.stdout+help_result.stderr:parser.error('Tu cloudflared no admite --allowed-mail. Actualízalo; no se abrió ningún túnel sin protección.')
    logs=ROOT/'logs';logs.mkdir(exist_ok=True);children=[]
    command=[sys.executable,str(ROOT/'tools/serve_revived_pack.py'),'--port',str(port),'--relay',config['relay'],'--request-log',str(logs/'requests.log')]
    state_dir=ROOT/'.run';state_dir.mkdir(exist_ok=True);state_file=state_dir/f'host-{port}.json'
    if (ROOT/'.updates/journal.json').is_file() and json.loads((ROOT/'.updates/journal.json').read_text())['status']=='applying':parser.error('Hay una actualización interrumpida. Ejecuta tools/apply_update.py --recover antes de iniciar.')
    if (logs/'game.log').exists() and (logs/'game.log').stat().st_size>5*1024*1024:os.replace(logs/'game.log',logs/'game.log.1')
    env=os.environ.copy();env['PYTHONIOENCODING']='utf-8';env['PYTHONUNBUFFERED']='1'
    options={'start_new_session':True} if os.name!='nt' else {'creationflags':subprocess.CREATE_NO_WINDOW}
    def interrupted(*_):raise KeyboardInterrupt
    previous=signal.signal(signal.SIGTERM,interrupted)
    try:
        with (logs/'game.log').open('a',encoding='utf-8') as stream:
            state_file.write_text(json.dumps({'pid':os.getpid(),'port':port}),encoding='utf-8')
            children.append(subprocess.Popen(command,cwd=ROOT,stdout=stream,stderr=stream,env=env,**options))
            print('Verificando recursos e iniciando el motor...',flush=True)
            deadline=time.monotonic()+max(30,args.startup_timeout)
            while True:
                if children[0].poll() is not None:raise RuntimeError('El motor no pudo arrancar. Consulta logs/game.log.')
                try:
                    with urlopen(url+'/network-config.json',timeout=1) as response:
                        if response.status==200:break
                except OSError:pass
                if time.monotonic()>deadline:raise RuntimeError('El arranque tardó demasiado. Consulta logs/game.log.')
                time.sleep(.2)
            print('Juego listo: '+url+' · Ctrl+C para detener',flush=True)
            if config.get('publicHostname'):print('Dirección configurada: https://'+config['publicHostname']+' (requiere túnel y Access configurados)',flush=True)
            if tunnel:
                print('Cloudflare mostrará la URL HTTPS. El acceso requerirá uno de los correos configurados.',flush=True)
                children.append(subprocess.Popen(tunnel,cwd=ROOT,**options))
            while all(child.poll() is None for child in children):time.sleep(.5)
            raise RuntimeError('Uno de los servicios se detuvo. Reinicia el lanzador para intentarlo de nuevo.')
    except KeyboardInterrupt:return 0
    except (OSError,RuntimeError) as error:
        print(str(error),file=sys.stderr);return 1
    finally:
        for child in reversed(children):stop(child)
        state_file.unlink(missing_ok=True)
        signal.signal(signal.SIGTERM,previous)

if __name__=='__main__':raise SystemExit(main())
