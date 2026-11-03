#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Verify, apply or undo a source/core update without replacing private game data."""
import argparse
import hashlib
import json
import os
from pathlib import Path,PurePosixPath
import shutil
import socket
import stat
import time
import zipfile
from contextlib import contextmanager

MOVES={'out/local-game-usa':'private/game-data','out/research/revived-runtime':'private/runtime','out/research/browser-network/public':'build/network/public'}
def digest(path):
    with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def safe(root,name):
    p=PurePosixPath(name)
    if not name or p.is_absolute() or '..' in p.parts or '\\' in name or ':' in name:raise ValueError('Ruta de actualización inválida.')
    path=root.joinpath(*p.parts)
    if not path.resolve().is_relative_to(root):raise ValueError('La actualización sale de la carpeta del juego.')
    return path
def permitted(name):
    return name in {'LICENSE','LEEME.md','README.md','DEPLOYMENT.md','iniciar.sh','actualizar.sh','release.json','fuentes-proyecto.zip'} or name.startswith(('web-native/','tools/','docs/','licenses/','private/runtime/','build/network/public/'))
def write_json(path,value):
    path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_name(path.name+'.tmp')
    with tmp.open('w',encoding='utf-8') as stream:json.dump(value,stream,indent=2);stream.flush();os.fsync(stream.fileno())
    os.replace(tmp,path)
def check_stopped(root):
    for record in (root/'.run').glob('host-*.json') if (root/'.run').exists() else []:
        value=json.loads(record.read_text(encoding='utf-8'))
        with socket.socket() as probe:
            probe.settimeout(.3)
            if probe.connect_ex(('127.0.0.1',value['port']))==0:raise ValueError('Detén las instancias del juego antes de actualizar.')
    if not (root/'host.json').is_file():return
    config=json.loads((root/'host.json').read_text(encoding='utf-8'))
    with socket.socket() as probe:
        probe.settimeout(.3)
        if probe.connect_ex(('127.0.0.1',config.get('port',8095)))==0:raise ValueError('Detén el lanzador o el servicio antes de actualizar.')
def source_path(root,name):
    target=safe(root,name)
    if target.exists():return target
    for old,new in MOVES.items():
        if name==new or name.startswith(new+'/'):return safe(root,old+name[len(new):])
    return target
def process_alive(pid):
    if pid==os.getpid():return True
    if os.name=='nt':
        import ctypes
        from ctypes import wintypes
        kernel=ctypes.WinDLL('kernel32',use_last_error=True)
        kernel.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD];kernel.OpenProcess.restype=wintypes.HANDLE
        kernel.GetExitCodeProcess.argtypes=[wintypes.HANDLE,ctypes.POINTER(wintypes.DWORD)];kernel.CloseHandle.argtypes=[wintypes.HANDLE]
        handle=kernel.OpenProcess(0x1000,False,pid)
        if not handle:return ctypes.get_last_error()!=87
        try:
            code=wintypes.DWORD();return not kernel.GetExitCodeProcess(handle,ctypes.byref(code)) or code.value==259
        finally:kernel.CloseHandle(handle)
    try:os.kill(pid,0);return True
    except ProcessLookupError:return False
    except PermissionError:return True
@contextmanager
def update_lock(root,recover=False):
    path=root/'.updates/lock.json';path.parent.mkdir(parents=True,exist_ok=True)
    if path.exists():
        pid=json.loads(path.read_text())['pid']
        alive=process_alive(pid)
        if alive or not recover:raise ValueError('Otra actualización está activa o quedó interrumpida. Usa --recover si se interrumpió.')
        path.unlink()
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as stream:json.dump({'pid':os.getpid()},stream)
    try:yield
    finally:path.unlink(missing_ok=True)
def inspect(root,archive):
    with zipfile.ZipFile(archive) as z:
        info=z.infolist();names=[r.filename for r in info]
        if len(names)!=len(set(names)) or 'UPDATE.json' not in names:raise ValueError('Paquete de actualización inválido.')
        if any(stat.S_ISLNK(r.external_attr>>16) for r in info):raise ValueError('El paquete contiene enlaces no permitidos.')
        if sum(r.file_size for r in info)>256*1024*1024:raise ValueError('Actualización demasiado grande.')
        manifest=json.loads(z.read('UPDATE.json'));files=manifest['changed']
        if manifest.get('format')!='downhill-update-v1' or not files:raise ValueError('Formato de actualización no compatible.')
        if len(files)!=len({r['path'] for r in files}):raise ValueError('El manifiesto contiene rutas duplicadas.')
        expected={'UPDATE.json','RELEASE-MANIFEST.json'}|{r['path'] for r in files}
        if set(names)!=expected:raise ValueError('El paquete contiene archivos fuera del manifiesto.')
        for record in files:
            name=record['path'];safe(root,name)
            if not permitted(name):raise ValueError('La actualización intenta reemplazar configuración o recursos privados.')
            data=z.read(name)
            if len(data)!=record['bytes'] or hashlib.sha256(data).hexdigest()!=record['sha256']:raise ValueError('Actualización dañada: '+name)
        index=source_path(root,'private/game-data/index.json')
        if manifest.get('resourceIndexSha256') and (not index.is_file() or digest(index)!=manifest['resourceIndexSha256']):raise ValueError('Esta actualización no corresponde a los recursos instalados.')
        for name,expected_hash in manifest.get('baseFiles',{}).items():
            path=source_path(root,name)
            if not path.is_file() or digest(path)!=expected_hash:raise ValueError('La instalación contiene otra versión o cambios locales: '+name)
        release=json.loads(z.read('RELEASE-MANIFEST.json'))
        if release.get('appVersion')!=manifest['appVersion']:raise ValueError('Versión de actualización inconsistente.')
    return manifest,release
def rollback(root,state):
    if state.get('status') not in {'committed','applying'}:raise ValueError('Esta actualización ya fue revertida.')
    for record in state.get('files',[]):
        backup=safe(root,record['backup'])
        if record['existed'] and (not backup.is_file() or record.get('backupSha256') and digest(backup)!=record['backupSha256']):raise ValueError('La copia anterior está ausente o dañada; no se modificó la instalación.')
    for record in reversed(state.get('files',[])):
        path=safe(root,record['path']);backup=safe(root,record['backup'])
        if record['existed']:
            if backup.is_file():path.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(backup,path)
        elif path.exists():path.unlink()
    for record in reversed(state.get('moves',[])):
        old=safe(root,record['old']);new=safe(root,record['new'])
        if new.exists() and not old.exists():old.parent.mkdir(parents=True,exist_ok=True);os.replace(new,old)
    previous=safe(root,state['previousManifest'])
    if previous.exists():shutil.copy2(previous,root/'release-manifest.json')
    elif (root/'release-manifest.json').exists():(root/'release-manifest.json').unlink()
    state['status']='rolled-back';write_json(root/'.updates/journal.json',state)
def recover(root,state):
    if state.get('status')!='applying':raise ValueError('No hay una actualización interrumpida. Usa --rollback para volver a la versión anterior.')
    rollback(root,state)
def prune_backups(root,keep):
    """Only remove our marked backup folders; never infer ownership from a name."""
    warnings=[];parent=(root/'.updates').resolve()
    for folder in parent.iterdir():
        if folder==keep or not folder.name.isdecimal() or folder.is_symlink() or not folder.is_dir():continue
        marker=folder/'backup-owner.json'
        try:
            if not marker.is_file() or json.loads(marker.read_text()).get('format')!='downhill-update-backup-v1':continue
            if folder.resolve().parent!=parent:raise ValueError('Ruta de recuperación inválida.')
            shutil.rmtree(folder)
        except (OSError,ValueError) as error:warnings.append(folder.name+': '+str(error))
    return warnings
def _apply(root,archive,fail_after=None):
    root=root.resolve();check_stopped(root);manifest,release=inspect(root,archive)
    current=root/'.updates/journal.json'
    if current.exists() and json.loads(current.read_text())['status']=='applying':raise ValueError('Hay una actualización interrumpida. Ejecuta primero --recover.')
    folder=root/'.updates'/str(time.time_ns());folder.mkdir(parents=True)
    write_json(folder/'backup-owner.json',{'format':'downhill-update-backup-v1'})
    state={'status':'applying','appVersion':manifest['appVersion'],'files':[],'moves':[],'previousManifest':(folder/'previous-manifest.json').relative_to(root).as_posix()}
    if (root/'release-manifest.json').is_file():shutil.copy2(root/'release-manifest.json',safe(root,state['previousManifest']))
    with zipfile.ZipFile(archive) as z:
        for record in manifest['changed']:
            name=record['path'];stage=folder/'stage'/name;stage.parent.mkdir(parents=True,exist_ok=True);stage.write_bytes(z.read(name))
    write_json(current,state)
    try:
        for old,new in MOVES.items():
            source=safe(root,old);target=safe(root,new)
            if source.exists() and not target.exists():
                state['moves'].append({'old':old,'new':new});write_json(current,state);target.parent.mkdir(parents=True,exist_ok=True);os.replace(source,target)
        for i,record in enumerate(manifest['changed']):
            name=record['path'];target=safe(root,name);backup=folder/'previous'/name;existed=target.is_file()
            if existed:backup.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,backup)
            state['files'].append({'path':name,'existed':existed,'backup':backup.relative_to(root).as_posix(),'backupSha256':digest(backup) if existed else None});write_json(current,state)
            target.parent.mkdir(parents=True,exist_ok=True);os.replace(folder/'stage'/name,target)
            if name.endswith('.sh'):target.chmod(0o700)
            if digest(target)!=record['sha256']:raise ValueError('No se pudo verificar el archivo instalado.')
            if fail_after is not None and i+1>=fail_after:raise OSError('Injected update failure')
        for record in release['files']:
            if record.get('kind')=='resources':continue
            path=safe(root,record['path'])
            if not path.is_file() or digest(path)!=record['sha256']:raise ValueError('La versión instalada está incompleta o contiene cambios locales: '+record['path'])
        write_json(root/'release-manifest.json',release);state['status']='committed';write_json(current,state)
    except BaseException:
        rollback(root,state);raise
    warnings=prune_backups(root,folder)
    if warnings:state['retentionWarnings']=warnings;write_json(current,state)
    return state
def apply(root,archive,fail_after=None):
    root=root.resolve()
    with update_lock(root):return _apply(root,archive,fail_after)
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);parser.add_argument('--archive',type=Path);parser.add_argument('--verify-only',action='store_true');parser.add_argument('--rollback',action='store_true');parser.add_argument('--recover',action='store_true');args=parser.parse_args();root=args.root.resolve()
    try:
        if args.rollback or args.recover:
            check_stopped(root)
            with update_lock(root,recover=args.recover):
                state=json.loads((root/'.updates/journal.json').read_text())
                (recover if args.recover else rollback)(root,state)
            print('Versión anterior restaurada.')
        elif args.archive:
            if args.verify_only:inspect(root,args.archive);print('Actualización verificada; recursos y configuración conservados.')
            else:apply(root,args.archive);print('Actualización instalada. Se conserva una copia de recuperación.')
        else:parser.error('Indica --archive, --rollback o --recover.')
    except (OSError,ValueError,KeyError,zipfile.BadZipFile) as error:parser.exit(1,str(error)+'\n')
if __name__=='__main__':main()
