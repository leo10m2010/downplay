#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Install Linux services for the game and a dashboard-managed Cloudflare Tunnel."""
import argparse
import getpass
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from urllib.request import HTTPRedirectHandler,build_opener,Request
from urllib.error import HTTPError,URLError
from urllib.parse import urlsplit

def access_protected(hostname):
    class NoRedirect(HTTPRedirectHandler):
        def redirect_request(self,*args):return None
    try:
        with build_opener(NoRedirect).open(Request('https://'+hostname,method='HEAD'),timeout=15):return False
    except HTTPError as error:
        target=urlsplit(error.headers.get('Location',''))
        return error.code in {301,302,303,307,308} and (target.hostname or '').endswith('.cloudflareaccess.com') and '/cdn-cgi/access/login' in target.path
    except (URLError,OSError):return False

def quote(value):
    if any(c in str(value) for c in '\n\r\x00'):raise ValueError('Ruta inválida.')
    return '"'+str(value).replace('\\','\\\\').replace('"','\\"').replace('%','%%')+'"'
def working_directory(value):
    # WorkingDirectory is a single path setting, not an ExecStart word list.
    if any(c in str(value) for c in '\n\r\x00'):raise ValueError('Ruta inválida.')
    return str(value).replace('%','%%')
def units(root,user,python='/usr/bin/python3',cloudflared='/usr/local/bin/cloudflared',config='/etc/downhill-web/host.json',credential='/etc/cloudflared/downhill.token'):
    if not re.fullmatch(r'[a-zA-Z_][a-zA-Z0-9_-]*[$]?',user):raise ValueError('Usuario de servicio inválido.')
    game=f'''[Unit]
Description=Downhill Web private game resources
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User={user}
WorkingDirectory={working_directory(root)}
ExecStart={quote(python)} {quote(root/'tools/run_linux_host.py')} --config {quote(config)}
Restart=on-failure
RestartSec=5
TimeoutStopSec=20
UMask=0077
Environment=PYTHONUTF8=1
Environment=PYTHONUNBUFFERED=1
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths={quote(root/'logs')} {quote(root/'.run')}
StandardOutput=journal
StandardError=journal
LogNamespace=downhill-web
[Install]
WantedBy=multi-user.target
'''
    tunnel=f'''[Unit]
Description=Cloudflare Tunnel for jugar.cobbleverse.space
After=network-online.target downhill-web.service
Wants=network-online.target downhill-web.service
[Service]
Type=simple
DynamicUser=yes
LoadCredential=token:{credential}
ExecStart={quote(cloudflared)} --no-autoupdate tunnel run --token-file %d/token
Restart=on-failure
RestartSec=5
TimeoutStopSec=20
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
StandardOutput=journal
StandardError=journal
LogNamespace=downhill-web
[Install]
WantedBy=multi-user.target
'''
    return {'downhill-web.service':game,'downhill-tunnel.service':tunnel}
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);p.add_argument('--user',default=os.environ.get('SUDO_USER'));p.add_argument('--hostname',default='jugar.cobbleverse.space');p.add_argument('--relay',default='wss://downhill-web-relay.dowh.workers.dev');p.add_argument('--token-file',type=Path);p.add_argument('--dry-run',type=Path,metavar='OUTPUT_FOLDER');p.add_argument('--enable',action='store_true',help='Activar el arranque automático después de instalar');args=p.parse_args();root=args.root.resolve()
    if sys.platform!='linux':p.error('Este instalador se ejecuta en Linux. Puedes utilizar iniciar.sh sin instalar servicios.')
    import pwd
    if not args.user:p.error('Ejecuta con sudo desde tu usuario habitual o indica --user.')
    try:pwd.getpwnam(args.user)
    except KeyError:p.error('El usuario indicado no existe.')
    if args.user=='root' and not args.dry_run:p.error('El servicio del juego debe utilizar tu usuario normal, no root.')
    if not re.fullmatch(r'(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,63}',args.hostname):p.error('Dominio inválido.')
    executable=shutil.which('cloudflared')
    if not executable and not args.dry_run:p.error('Instala cloudflared desde https://developers.cloudflare.com/tunnel/downloads/')
    output=args.dry_run.resolve() if args.dry_run else Path('/etc/systemd/system')
    if not args.dry_run and os.geteuid()!=0:p.error('Instala los servicios con sudo.')
    if args.enable and not args.dry_run and not access_protected(args.hostname):p.error('No se comprobó la protección Access del dominio. Configura DNS/Access y repite; no se activaron los servicios.')
    code=units(root,args.user,sys.executable,executable or '/usr/local/bin/cloudflared')
    output.mkdir(parents=True,exist_ok=True)
    if args.dry_run:
        for name,text in code.items():(output/name).write_text(text,encoding='utf-8')
        print('Plantillas verificables generadas en '+str(output)+'. No se instalaron servicios ni se leyó ningún token.');return
    # Test actual access as the service user, including parent directory traversal.
    probe="""import json,sys
from pathlib import Path
root=Path(sys.argv[1])
manifest=root/'release-manifest.json'
if manifest.is_file():
    paths=[root/record['path'] for record in json.loads(manifest.read_text())['files']]
else:
    sys.path.insert(0,str(root/'tools'))
    from serve_revived_pack import PUBLIC,ADAPTERS,RUNTIME
    from prepared_disc import PreparedDisc
    from project_paths import ASSETS
    disc=PreparedDisc(ASSETS)
    paths=[RUNTIME/name for name in PUBLIC]+list(ADAPTERS.values())+[ASSETS/'index.json']+disc.paths
for path in paths:
    with path.open('rb') as stream:stream.read(1)
"""
    runner=shutil.which('runuser')
    if not runner:p.error('Falta runuser (util-linux) para comprobar el acceso del usuario del servicio.')
    result=subprocess.run([runner,'-u',args.user,'--',sys.executable,'-c',probe,str(root)],cwd='/',capture_output=True,text=True)
    if result.returncode:p.error('El usuario del servicio no puede leer el paquete. Descomprímelo como ese usuario en una carpeta accesible y repite. No se instalaron servicios.')
    for path in (root/'logs',root/'.run'):path.mkdir(exist_ok=True)
    account=pwd.getpwnam(args.user)
    for path in (root/'logs',root/'.run'):os.chown(path,account.pw_uid,account.pw_gid)
    config=Path('/etc/downhill-web/host.json');config.parent.mkdir(mode=0o755,exist_ok=True)
    if not config.exists():
        value=json.loads((root/'host.json').read_text(encoding='utf-8')) if (root/'host.json').is_file() else {'port':8095,'allowedEmails':[]}
        value.update({'relay':args.relay,'publicHostname':args.hostname});config.write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8');config.chmod(0o644)
    token_path=Path('/etc/cloudflared/downhill.token');token_path.parent.mkdir(mode=0o700,exist_ok=True)
    if not token_path.exists():
        token=args.token_file.read_text(encoding='utf-8').strip() if args.token_file else getpass.getpass('Token del túnel administrado (oculto): ').strip()
        if not re.fullmatch(r'[A-Za-z0-9_+/=-]{40,8192}',token):p.error('Credencial de túnel inválida; no se imprimió ni guardó.')
        fd=os.open(token_path,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
        with os.fdopen(fd,'w',encoding='utf-8') as stream:stream.write(token+'\n')
    for name,text in code.items():
        path=output/name
        if path.exists() and path.read_text(encoding='utf-8')!=text:
            backup=path.with_name(path.name+'.before-downhill')
            if not backup.exists():shutil.copy2(path,backup)
        path.write_text(text,encoding='utf-8');path.chmod(0o644)
    journal=Path('/etc/systemd/journald@downhill-web.conf')
    if not journal.exists():journal.write_text('[Journal]\nSystemMaxUse=64M\nRuntimeMaxUse=16M\nMaxRetentionSec=7day\nRateLimitIntervalSec=30s\nRateLimitBurst=200\n',encoding='utf-8');journal.chmod(0o644)
    subprocess.run(['systemctl','daemon-reload'],check=True)
    if args.enable:subprocess.run(['systemctl','enable','--now','downhill-web.service','downhill-tunnel.service'],check=True)
    print('Servicios instalados. Ruta del túnel en Cloudflare: '+args.hostname+' → http://localhost:8095. Configura Access para los correos permitidos antes de compartir el enlace.')
if __name__=='__main__':main()
