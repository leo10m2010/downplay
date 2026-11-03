#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Compile the pinned Revived C network client for a single browser worker.

No game data is needed. SDL mutexes/conditions are no-ops only in this side
module: all C calls and transport callbacks execute serially on one JS worker.
"""
import os
import argparse
import shutil
from pathlib import Path
import subprocess
from check_revived_disc import REVISION
from project_paths import UPSTREAM,EMSDK

ROOT=Path(__file__).resolve().parents[1]


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--upstream',type=Path,default=UPSTREAM)
    parser.add_argument('--emcc',help='Compilador Emscripten; por defecto SDK local o PATH')
    parser.add_argument('--sdk',type=Path,default=EMSDK,help='SDK compartido, fuera del proyecto; también DHD_EMSDK')
    args=parser.parse_args();checkout=args.upstream.resolve()
    if subprocess.check_output(['git','-C',str(checkout),'rev-parse','HEAD'],text=True).strip()!=REVISION:raise SystemExit('Unexpected upstream revision')
    build=ROOT/'build/network';shim=build/'include/SDL3';shim.mkdir(parents=True,exist_ok=True)
    (shim/'SDL_mutex.h').write_text('''#pragma once
typedef int SDL_Mutex;typedef int SDL_Condition;
static inline SDL_Mutex* SDL_CreateMutex(void){static int m;return &m;}
static inline SDL_Condition* SDL_CreateCondition(void){static int c;return &c;}
static inline void SDL_DestroyMutex(SDL_Mutex* m){(void)m;}
static inline void SDL_DestroyCondition(SDL_Condition* c){(void)c;}
static inline void SDL_LockMutex(SDL_Mutex* m){(void)m;}
static inline void SDL_UnlockMutex(SDL_Mutex* m){(void)m;}
static inline void SDL_BroadcastCondition(SDL_Condition* c){(void)c;}
''')
    (shim/'SDL_timer.h').write_text('''#pragma once
#include <stdint.h>
#include <emscripten.h>
static inline uint64_t SDL_GetTicksNS(void){return (uint64_t)(emscripten_get_now()*1000000.0);}
''')
    output=build/'public';output.mkdir(exist_ok=True)
    (output/'package.json').write_text('{"type":"module"}\n')
    env=os.environ.copy();sdk=args.sdk.expanduser().resolve()
    bundled=sdk/'upstream/emscripten'/('emcc.exe' if os.name=='nt' else 'emcc')
    compiler=args.emcc or (str(bundled) if bundled.is_file() else shutil.which('emcc'))
    if not compiler:parser.error('Instala/activa Emscripten o indica --emcc.')
    if not args.emcc and compiler==str(bundled) and (sdk/'.emscripten').is_file():env['EM_CONFIG']=str(sdk/'.emscripten')
    for key in ('TEMP','TMP','TMPDIR'):env[key]=str(build)
    cmd=[compiler,str(ROOT/'web-native/network.c'),str(checkout/'port/net/client.c'),str(checkout/'port/net/json.c'),str(checkout/'port/net/hash.c'),
         '-I'+str(build/'include'),'-I'+str(checkout/'port/net'),'-O2','--no-entry','-sMODULARIZE=1','-sEXPORT_ES6=1','-sENVIRONMENT=web,node',
         '-sFILESYSTEM=0','-sALLOW_MEMORY_GROWTH=1',"-sEXPORTED_RUNTIME_METHODS=['HEAPU8']","-sEXPORTED_FUNCTIONS=['_malloc','_free','_net_hash64']",'-o',str(output/'network-core.js')]
    subprocess.run(cmd,check=True,env=env)
    print(output)


if __name__=='__main__':main()
