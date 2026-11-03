#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Prepare source-only Cloudflare relay deployment; never deploys or copies game data."""
import json
from pathlib import Path
import shutil
import subprocess
from check_revived_disc import REVISION,UPSTREAM
from project_paths import UPSTREAM as SOURCE_PATH

ROOT=Path(__file__).resolve().parents[1]


def main():
    source=SOURCE_PATH;server=source/'online/server'
    if subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],text=True).strip()!=REVISION:raise SystemExit('Unexpected source revision')
    output=ROOT/'relay';output.mkdir(exist_ok=True)
    copied=[]
    for directory in ('src',):
        for path in (server/directory).glob('*.ts'):
            if path.name=='worker-configuration.d.ts':continue
            target=output/directory/path.name;target.parent.mkdir(exist_ok=True);shutil.copyfile(path,target)
            copied.append(target)
    shutil.copyfile(server/'tsconfig.json',output/'tsconfig.json')
    template=ROOT/'tools/relay-package'
    for name in ('package.json','package-lock.json'):
        shutil.copyfile(template/name,output/name)
    shutil.copyfile(template/'relay-env.d.ts',output/'src/relay-env.d.ts')
    shutil.copyfile(source/'LICENSE',output/'LICENSE')
    config={'name':'downhill-web-relay','main':'src/index.ts','compatibility_date':'2026-10-01','workers_dev':True,
            'vars':{'MIN_VERSION':'0.7.2'},'durable_objects':{'bindings':[{'name':'ROOM','class_name':'Room'},{'name':'LOBBIES','class_name':'LobbyIndex'}]},
            'migrations':[{'tag':'v1','new_sqlite_classes':['Room','LobbyIndex']}]}
    (output/'wrangler.json').write_text(json.dumps(config,indent=2))
    (output/'SOURCE.json').write_text(json.dumps({'upstream':UPSTREAM,'revision':REVISION,'license':'GPL-3.0-or-later','changes':'workers.dev deployment; official domain and analytics binding removed; optional analytics type declaration; pinned deploy-only tool dependencies. Runtime server TypeScript unchanged.','gameDataIncluded':False},indent=2))
    # Dependency/cache folders created by Wrangler may already exist on reruns.
    # Check the deliberately selected source files, never copy those folders.
    assert all(p.suffix=='.ts' and p.stat().st_size<1024*1024 for p in copied)
    print('Source-only relay prepared:',output)


if __name__=='__main__':main()
