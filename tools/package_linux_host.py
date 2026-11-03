#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Build a private full Linux bundle or a verified code/core-only differential update."""
import argparse,hashlib,json,tarfile,zipfile
from pathlib import Path,PurePosixPath
from prepared_disc import PreparedDisc,ROOT
from serve_revived_pack import RUNTIME,PUBLIC,ADAPTERS
from project_paths import ASSETS,LAYOUT_MOVES
from run_linux_host import read_config

def checksum(path):
    with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def canonical(name):
    for old,new in LAYOUT_MOVES.items():
        if name==old or name.startswith(old+'/'):return new+name[len(old):]
    return name
def entries(disc):
    selected={}
    def add(path,name):
        if PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts or '\\' in name:raise ValueError('Ruta de paquete inválida: '+name)
        if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(ROOT):raise ValueError('Archivo no permitido: '+name)
        if name in selected:raise ValueError('Ruta duplicada: '+name)
        selected[name]=path
    for name in PUBLIC:add(RUNTIME/name,'private/runtime/'+name)
    add(RUNTIME/'download-manifest.json','private/runtime/download-manifest.json')
    for name,path in ADAPTERS.items():
        target='build/network/public/'+name if name.startswith('network-core.') else path.relative_to(ROOT).as_posix()
        if target not in selected:add(path,target)
    for name in ('serve_revived_pack.py','prepared_disc.py','http_code_cache.py','run_linux_host.py','project_paths.py','apply_update.py','install_linux_host.py','configure_cloudflare.py','validate_release.py'):
        add(ROOT/'tools'/name,'tools/'+name)
    add(ROOT/'release.json','release.json');add(ROOT/'tools/linux-host/start.sh','iniciar.sh');add(ROOT/'tools/linux-host/update.sh','actualizar.sh');add(ROOT/'tools/linux-host/LEEME.md','LEEME.md')
    for name in ('README.md','DEPLOYMENT.md','docs/RELEASE.md','docs/TESTING.md','docs/SOURCE-PROVENANCE.md','licenses/SOURCE-NOTICE.md'):add(ROOT/name,name)
    add(disc.directory/'index.json','private/game-data/index.json')
    for record in disc.segments:
        name='private/game-data/'+record['file']
        if name not in selected:add(disc.directory/record['file'],name)
    return selected

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--assets',type=Path,default=ASSETS);p.add_argument('--output',type=Path,default=ROOT/'out/releases/1.0.0-rc.1/downhill-linux-private.tar.gz');p.add_argument('--base-manifest',type=Path);p.add_argument('--relay',default='wss://downhill-web-relay.dowh.workers.dev');args=p.parse_args();output=args.output.resolve()
    if not output.is_relative_to(ROOT/'out') or output==ROOT/'out':p.error('El paquete privado debe quedar dentro de out/.')
    partial=output.with_name(output.name+'.partial')
    if output.exists() or partial.exists():p.error('La salida ya existe; elige otra ruta para conservarla.')
    output.parent.mkdir(parents=True,exist_ok=True)
    config_path=output.parent/'default-host.json';config_path.write_text(json.dumps({'port':8095,'relay':args.relay or None,'allowedEmails':[],'publicHostname':'jugar.cobbleverse.space'},indent=2)+'\n',encoding='utf-8');read_config(config_path)
    disc=PreparedDisc(args.assets,verify=not bool(args.base_manifest));selected=entries(disc)
    runtime={r['name']:r for r in json.loads((RUNTIME/'download-manifest.json').read_text(encoding='utf-8'))['files']}
    for name in PUBLIC:
        if checksum(RUNTIME/name)!=runtime[name]['sha256']:p.error('Módulo de evaluación alterado: '+name)
    from export_github_source import candidates
    sources=output.parent/'sources.zip'
    with zipfile.ZipFile(sources,'w',zipfile.ZIP_DEFLATED) as z:
        for name,path in candidates():z.write(path,name)
    selected['fuentes-proyecto.zip']=sources
    resource_records={'private/game-data/'+r['file']:r for r in disc.segments}
    records=[]
    for name,path in sorted(selected.items()):
        kind='resources' if name.startswith('private/game-data/') else 'core' if name.startswith(('private/runtime/','build/network/')) else 'app'
        records.append({'path':name,'bytes':path.stat().st_size,'sha256':resource_records[name]['sha256'] if name in resource_records else checksum(path),'kind':kind})
    release=json.loads((ROOT/'release.json').read_text(encoding='utf-8'));release.update({'format':'downhill-release-v1','resourceId':disc.sha256,'files':records})
    manifest_path=output.parent/'release-manifest.json';manifest_path.write_text(json.dumps(release,indent=2)+'\n',encoding='utf-8')
    if args.base_manifest:
        if output.suffix!='.zip':p.error('Usa una salida .zip para la actualización diferencial.')
        base=json.loads(args.base_manifest.read_text(encoding='utf-8'));old={canonical(r['path']):r for r in base['files']}
        index='private/game-data/index.json';index_hash=next(r['sha256'] for r in records if r['path']==index)
        if index not in old or old[index]['sha256']!=index_hash:p.error('La base contiene otros recursos; no se preparó una actualización de datos.')
        changed=[r for r in records if r['kind']!='resources' and (r['path'] not in old or old[r['path']]['sha256']!=r['sha256'])]
        if not changed:p.error('No hay archivos modificados.')
        update={'format':'downhill-update-v1','appVersion':release['appVersion'],'resourceIndexSha256':index_hash,'baseFiles':{r['path']:old[r['path']]['sha256'] for r in changed if r['path'] in old},'changed':changed}
        with zipfile.ZipFile(partial,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
            z.writestr('UPDATE.json',json.dumps(update));z.writestr('RELEASE-MANIFEST.json',json.dumps(release))
            for r in changed:z.write(selected[r['path']],r['path'])
        with zipfile.ZipFile(partial) as z:
            if z.testzip():raise ValueError('No se pudo verificar la actualización.')
        print('Actualización: '+str(len(changed))+' archivos; configuración y recursos excluidos.',flush=True)
    else:
        selected['host.json']=config_path;selected['release-manifest.json']=manifest_path
        total=sum(path.stat().st_size for path in selected.values());done=0;last=-1
        print(f'Empaquetando {len(selected)} archivos; {total/1e9:.2f} GB...',flush=True)
        with tarfile.open(partial,'w:gz',compresslevel=1,format=tarfile.PAX_FORMAT) as z:
            for name,path in sorted(selected.items()):
                info=z.gettarinfo(str(path),arcname=name);info.uid=info.gid=0;info.uname=info.gname='';info.mode=0o700 if name.endswith('.sh') else 0o600
                with path.open('rb') as stream:z.addfile(info,stream)
                done+=path.stat().st_size;percent=int(100*done/total)//10*10
                if percent!=last:print(f'Paquete: {percent}%',flush=True);last=percent
    digest=checksum(partial);partial.rename(output)
    output.with_name(output.name+'.sha256').write_text(digest+'  '+output.name+'\n',encoding='utf-8')
    output.with_name(output.name+'.manifest.json').write_text(json.dumps({**release,'archiveBytes':output.stat().st_size,'sha256':digest},indent=2)+'\n',encoding='utf-8')
    print(f'Listo: {output} ({output.stat().st_size/1048576:.2f} MiB)',flush=True)
if __name__=='__main__':main()
