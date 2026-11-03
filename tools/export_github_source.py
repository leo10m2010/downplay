#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Export a source-only snapshot; never copy the private research/build folders."""
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT=Path(__file__).resolve().parents[1]
DIRS={'tests','tools','docs','web-native','licenses','.github','.githooks','relay'}
FILES={'README.md','LICENSE','AUTHORS','SECURITY.md','.gitignore','.gitattributes','DEPLOYMENT.md','release.json','.githooks/pre-commit'}
SUFFIXES={'.py','.cpp','.hpp','.h','.c','.java','.js','.mjs','.ts','.json','.jsonc','.md','.txt','.html','.css','.cmake','.sh','.ps1','.yml','.yaml','.patch'}

def candidates():
    raw=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=ROOT)
    for name in sorted(set(raw.decode().split('\0'))- {''}):
        relative=Path(name)
        if relative.is_absolute() or '..' in relative.parts:raise ValueError('Unsafe source path')
        if name not in FILES and (relative.parts[0] not in DIRS or relative.suffix.lower() not in SUFFIXES):continue
        source=ROOT/relative
        if source.is_symlink() or not source.is_file():continue
        if not source.resolve().is_relative_to(ROOT):raise ValueError('Source outside checkout')
        if any(part in {'node_modules','__pycache__','.git','.env','.wrangler'} for part in relative.parts):continue
        if source.stat().st_size>5*1024*1024:raise ValueError('Unexpected large source file: '+name)
        yield name,source
    # Corresponding source for the distributed C side-module, with upstream license.
    from project_paths import UPSTREAM
    if (UPSTREAM/'port/net').is_dir():
        for source in sorted((UPSTREAM/'port/net').iterdir()):
            if source.is_file() and source.suffix in {'.c','.h'}:yield 'third_party/revived-net/'+source.name,source
        yield 'third_party/revived-net/LICENSE',UPSTREAM/'LICENSE'

def main():
    destination=ROOT/'out/github-source.zip';destination.parent.mkdir(exist_ok=True)
    records=[]
    with zipfile.ZipFile(destination,'w',zipfile.ZIP_DEFLATED) as archive:
        for name,source in candidates():
            data=source.read_bytes();archive.writestr(name,data)
            records.append({'path':name,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
        archive.writestr('SOURCE-MANIFEST.json',json.dumps(records,indent=2)+'\n')
    print(f'{destination}: {len(records)} source files; no ISO/assets/build folders included.')

if __name__=='__main__':main()
