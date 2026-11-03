#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Verify every file of a full private release and optionally extract to a fresh directory."""
import argparse,hashlib,json,os,tarfile
from pathlib import Path
from apply_update import safe
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--archive',type=Path,required=True);p.add_argument('--extract',type=Path);args=p.parse_args();archive=args.archive.resolve()
 manifest=json.loads(archive.with_name(archive.name+'.manifest.json').read_text(encoding='utf-8'));records={r['path']:r for r in manifest['files']}
 with archive.open('rb') as stream:
  if hashlib.file_digest(stream,'sha256').hexdigest()!=manifest['sha256']:raise ValueError('El paquete está dañado.')
 target=args.extract.resolve() if args.extract else None
 if target:
  if target.exists():raise ValueError('La carpeta de extracción debe ser nueva; no se reemplazan datos existentes.')
  if target==Path(target.anchor):raise ValueError('No se puede extraer sobre la raíz del disco.')
  target.mkdir(parents=True)
 seen=set()
 with tarfile.open(archive,'r|gz') as package:
  for member in package:
   if not member.isfile() or member.name in seen or member.name not in records and member.name not in {'host.json','release-manifest.json'}:raise ValueError('Entrada inesperada en el paquete.')
   path=safe(target or archive.parent,member.name);seen.add(member.name);digest=hashlib.sha256();written=0
   output=None
   try:
    if target:path.parent.mkdir(parents=True,exist_ok=True);output=path.open('xb')
    with package.extractfile(member) as stream:
     while block:=stream.read(1048576):
      digest.update(block);written+=len(block)
      if output:output.write(block)
   finally:
    if output:output.close();path.chmod(0o700 if member.name.endswith('.sh') else 0o600)
   if member.name in records:
    expected=records[member.name]
    if written!=expected['bytes'] or digest.hexdigest()!=expected['sha256']:raise ValueError('Archivo dañado: '+member.name)
 if seen!=set(records)|{'host.json','release-manifest.json'}:raise ValueError('El paquete está incompleto.')
 print(json.dumps({'verified':True,'files':len(seen),'archiveBytes':archive.stat().st_size,'appVersion':manifest['appVersion'],'extractedTo':str(target) if target else None}))
if __name__=='__main__':main()
