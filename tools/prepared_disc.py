#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Extract a private file-backed disc view; runtime never opens the source ISO.

The game still sees its original sector addresses. Files and layout fragments
preserve that contract without retaining a monolithic disc image.
"""
import argparse
from bisect import bisect_right
import hashlib
import json
import struct
import stat
from pathlib import Path
from project_paths import ASSETS,DEFAULT_ISO

ROOT=Path(__file__).resolve().parents[1]
BLOCK=1024*1024


def extract(iso,output):
    import pycdlib
    from check_revived_disc import inspect_disc
    iso=Path(iso).resolve();output=Path(output).resolve()
    if not ((output.is_relative_to(ROOT/'out') and output!=ROOT/'out') or (output.is_relative_to(ROOT/'private') and output!=ROOT/'private')):
        raise ValueError('Los recursos privados deben quedar en una subcarpeta nueva de private/ u out/.')
    report=inspect_disc(iso)
    if not report['compatible']:raise ValueError(report['message'])
    disc=pycdlib.PyCdlib();entries=[]
    try:
        disc.open(str(iso))
        for directory,_,names in disc.walk(iso_path='/'):
            for name in names:
                original=directory.rstrip('/')+'/'+name
                record=disc.get_record(iso_path=original)
                if record.data_length:
                    entries.append((record.extent_location()*2048,record.data_length,original))
    finally:disc.close()
    entries.sort();size=iso.stat().st_size;cursor=0;segments=[]
    for offset,length,original in entries:
        if offset<cursor or offset+length>size:raise ValueError('Extensiones ISO solapadas o fuera de límites.')
        if offset>cursor:segments.append((cursor,offset-cursor,None))
        segments.append((offset,length,original));cursor=offset+length
    if cursor<size:segments.append((cursor,size-cursor,None))
    output.mkdir(parents=True,exist_ok=False)
    records=[];image_hash=hashlib.sha256();started=__import__('time').perf_counter()
    with iso.open('rb') as source:
        for i,(offset,length,original) in enumerate(segments):
            # Numeric storage paths avoid names/traversal from a disc's directory.
            name=f'files/{i:05d}.data' if original else f'layout/{i:05d}.data'
            target=output/name;target.parent.mkdir(exist_ok=True);digest=hashlib.sha256()
            source.seek(offset);remaining=length
            with target.open('xb') as dest:
                while remaining:
                    block=source.read(min(BLOCK,remaining))
                    if not block:raise ValueError('ISO truncada durante la extracción.')
                    dest.write(block);digest.update(block);image_hash.update(block);remaining-=len(block)
            records.append(dict(offset=offset,size=length,file=name,sha256=digest.hexdigest(),original=original))
            if i%400==0:print(f'Preparando recursos: {100*(offset+length)/size:.1f}%',flush=True)
    manifest=dict(schema=1,size=size,sha256=image_hash.hexdigest(),executableSha1=report['executableSha1'],segments=records)
    (output/'index.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print(f'Paquete privado: {len(entries)} archivos, {size} bytes, {__import__("time").perf_counter()-started:.1f} s',flush=True)
    return manifest


class PreparedDisc:
    """Bounded random reads from extracted files, including cross-file reads."""
    def __init__(self,directory,verify=False):
        self.directory=Path(directory).resolve()
        data=json.loads((self.directory/'index.json').read_text(encoding='utf-8'))
        self.sha256=data.get('sha256')
        self.size=data['size'];self.segments=data['segments'];self.offsets=[];self.paths=[];parents={}
        if data.get('schema')!=1 or type(self.size)is not int or self.size<=0 or not 1<=len(self.segments)<=10000:
            raise ValueError('Índice de recursos incompatible.')
        cursor=0
        for record in self.segments:
            offset,length=record['offset'],record['size']
            if type(offset)is not int or type(length)is not int or offset!=cursor or length<=0 or offset+length>self.size:
                raise ValueError('Índice con huecos, solapamientos o tamaños inválidos.')
            name=record['file']
            if not isinstance(name,str) or '\\' in name or ':' in name or Path(name).is_absolute() or '..' in Path(name).parts:raise ValueError('Ruta de recurso inválida.')
            relative=Path(name)
            try:
                if relative.parent not in parents:parents[relative.parent]=(self.directory/relative.parent).resolve()
                parent=parents[relative.parent]
                if not parent.is_relative_to(self.directory):raise ValueError('Recurso fuera del paquete.')
                path=parent/relative.name;info=path.stat(follow_symlinks=False)
                if not stat.S_ISREG(info.st_mode) or info.st_size!=length:raise ValueError('Recurso ausente o fuera del paquete: '+name)
            except OSError as error:raise ValueError('Recurso ausente o fuera del paquete: '+name) from error
            if verify:
                with path.open('rb') as f:
                    if hashlib.file_digest(f,'sha256').hexdigest()!=record['sha256']:raise ValueError('Recurso dañado: '+record['file'])
            self.offsets.append(offset);self.paths.append(path);cursor+=length
        if cursor!=self.size:raise ValueError('Paquete incompleto.')
        identity=hashlib.sha256()
        files=sorted((r['original'].lstrip('/').split(';')[0].rstrip('.'),r) for r in self.segments if r.get('original'))
        for name,record in files:
            identity.update(name.encode()+b'\0'+struct.pack('<Q',record['size'])+bytes.fromhex(record['sha256']))
        self.files_sha256=identity.hexdigest()

    def read(self,offset,length):
        if type(offset)is not int or type(length)is not int or offset<0 or length<0 or length>4*BLOCK or offset+length>self.size:
            raise ValueError('Lectura de recursos fuera de límites.')
        result=bytearray();i=bisect_right(self.offsets,offset)-1
        while len(result)<length:
            record=self.segments[i];local=offset+len(result)-record['offset'];count=min(length-len(result),record['size']-local)
            with self.paths[i].open('rb') as source:
                source.seek(local);part=source.read(count)
            if len(part)!=count:raise ValueError('Recurso truncado después de iniciar el motor.')
            result.extend(part);i+=1
        return bytes(result)


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--iso',type=Path,default=DEFAULT_ISO)
    p.add_argument('--output',type=Path,default=ASSETS)
    p.add_argument('--verify',action='store_true')
    a=p.parse_args()
    if a.verify:
        disc=PreparedDisc(a.output,verify=True);print(f'Paquete íntegro: {disc.size} bytes; no se abrió ninguna ISO.')
    else:extract(a.iso,a.output)
