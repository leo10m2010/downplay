#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Prepare/check a private Cloudflare hostname; credentials are never printed."""
import argparse,getpass,json,os,re,sys
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
from urllib.parse import urlencode

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--domain',default='cobbleverse.space');p.add_argument('--hostname',default='jugar.cobbleverse.space');p.add_argument('--email',action='append',default=[]);p.add_argument('--apply',action='store_true');p.add_argument('--token-file',type=Path,default=Path(__file__).resolve().parents[1]/'private/cloudflared.token');p.add_argument('--state',type=Path,default=Path(__file__).resolve().parents[1]/'private/cloudflare-state.json')
 p.add_argument('--prompt-token',action='store_true')
 args=p.parse_args()
 token=getpass.getpass('Token API de Cloudflare (oculto): ').strip() if args.prompt_token else os.environ.get('CLOUDFLARE_API_TOKEN')
 if not token:p.error('Define CLOUDFLARE_API_TOKEN en tu terminal. No lo envíes por chat. Permisos: Tunnel Edit, DNS Edit y Access Apps/Policies/Identity Providers Edit, limitados a tu cuenta y dominio.')
 if not args.hostname.endswith('.'+args.domain) or not re.fullmatch(r'[A-Za-z0-9.-]+',args.hostname):p.error('Dominio inválido.')
 if args.apply and (not args.email or any(not re.fullmatch(r'[^\s@,*]+@[^\s@,*]+\.[^\s@,*]+',e) for e in args.email)):p.error('--apply requiere al menos un --email concreto.')
 def api(method,path,data=None):
  request=Request('https://api.cloudflare.com/client/v4'+path,data=json.dumps(data).encode() if data is not None else None,method=method,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','User-Agent':'Downhill-Web-Setup/1.0'})
  try:
   with urlopen(request,timeout=30) as response:result=json.load(response)
  except HTTPError as error:
   try:message='; '.join(str(e.get('message','')) for e in json.load(error).get('errors',[]))
   except ValueError:message=''
   raise ValueError(f'Cloudflare rechazó {method} {path} (HTTP {error.code}). Comprueba los permisos del token. '+message) from None
  if not result.get('success'):raise ValueError('Cloudflare no aceptó la operación solicitada.')
  return result.get('result')
 state=json.loads(args.state.read_text(encoding='utf-8')) if args.state.exists() else {}
 def save():
  args.state.parent.mkdir(parents=True,exist_ok=True);args.state.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
 zones=api('GET','/zones?'+urlencode({'name':args.domain}));
 if len(zones)!=1 or zones[0]['status']!='active':raise ValueError('El dominio debe estar activo en esta cuenta de Cloudflare.')
 zone=zones[0];account=zone['account']['id'];prefix='/accounts/'+account;zone_path='/zones/'+zone['id']
 records=api('GET',zone_path+'/dns_records?'+urlencode({'name':args.hostname}));tunnels=api('GET',prefix+'/cfd_tunnel?is_deleted=false');apps=api('GET',prefix+'/access/apps');providers=api('GET',prefix+'/access/identity_providers')
 owned_tunnel=next((t for t in tunnels if t['id']==state.get('tunnelId')),None)
 owned_app=next((a for a in apps if a['id']==state.get('appId')),None)
 if records and not owned_tunnel:raise ValueError('El hostname ya tiene un registro DNS. No se reemplazó. Revisa esa configuración primero.')
 if any(a.get('domain')==args.hostname and a['id']!=state.get('appId') for a in apps):raise ValueError('Ya existe otra aplicación Access para ese hostname. No se modificó.')
 if not args.apply:
  print(json.dumps({'domain':args.domain,'hostname':args.hostname,'accountAccessible':True,'existingOwnedTunnel':bool(owned_tunnel),'existingOwnedAccess':bool(owned_app),'dnsRecords':len(records),'changesApplied':False},indent=2));return
 state.update({'hostname':args.hostname,'domain':args.domain,'accountId':account,'zoneId':zone['id']});save()
 otp=next((provider for provider in providers if provider['type']=='onetimepin'),None)
 if not otp:otp=api('POST',prefix+'/access/identity_providers',{'name':'Downhill email PIN','type':'onetimepin','config':{}})
 if not owned_app:
  owned_app=api('POST',prefix+'/access/apps',{'name':'Downhill Web (private)','type':'self_hosted','domain':args.hostname,'session_duration':'24h','allowed_idps':[otp['id']],'app_launcher_visible':False});state['appId']=owned_app['id'];save()
 policy={'name':'Downhill allowed players','decision':'allow','include':[{'email':{'email':email}} for email in args.email],'precedence':1}
 if state.get('policyId'):api('PUT',prefix+'/access/apps/'+state['appId']+'/policies/'+state['policyId'],policy)
 else:state['policyId']=api('POST',prefix+'/access/apps/'+state['appId']+'/policies',policy)['id'];save()
 # Access is installed before any public DNS route is created.
 if not owned_tunnel:
  created=api('POST',prefix+'/cfd_tunnel',{'name':'downhill-web-cobbleverse','config_src':'cloudflare'});state['tunnelId']=created['id'];save()
 tunnel_id=state['tunnelId'];target=tunnel_id+'.cfargotunnel.com'
 if any(r['type']!='CNAME' or r['content']!=target for r in records):raise ValueError('El DNS existente apunta a otro servicio. No se reemplazó.')
 api('PUT',prefix+'/cfd_tunnel/'+tunnel_id+'/configurations',{'config':{'ingress':[{'hostname':args.hostname,'service':'http://localhost:8095'},{'service':'http_status:404'}]}})
 if not args.token_file.exists():
  credential=api('GET',prefix+'/cfd_tunnel/'+tunnel_id+'/token');args.token_file.parent.mkdir(parents=True,exist_ok=True);fd=os.open(args.token_file,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
  with os.fdopen(fd,'w',encoding='utf-8') as stream:stream.write(credential+'\n')
 if not records:state['dnsId']=api('POST',zone_path+'/dns_records',{'type':'CNAME','name':args.hostname,'content':target,'proxied':True,'ttl':1})['id'];save()
 print('Dominio, Access y túnel configurados. Credencial guardada localmente, sin imprimirla. Instala el servicio en Linux para conectar el túnel.')
if __name__=='__main__':
 try:main()
 except (ValueError,OSError,KeyError) as error:print(str(error),file=sys.stderr);raise SystemExit(1)
