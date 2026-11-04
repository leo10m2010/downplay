# SPDX-License-Identifier: GPL-3.0-or-later
"""Canonical private/development paths, with migration support for old installations."""
from pathlib import Path
import os
ROOT=Path(__file__).resolve().parents[1]
ORIGINALS=Path(os.environ.get('DHD_ORIGINALS_DIR') or ROOT.parent/'downhill-originales').expanduser()
DEFAULT_ISO=ROOT/'Downhill Domination (USA).iso'
if not DEFAULT_ISO.is_file():DEFAULT_ISO=ORIGINALS/'Downhill Domination (USA).iso'
EMSDK=Path(os.environ.get('DHD_EMSDK') or (ROOT/'.tools/emsdk' if (ROOT/'.tools/emsdk').exists() else Path.home()/'.cache/downhill-toolchains/emsdk-6.0.12')).expanduser()
def location(current,legacy):
    target=ROOT/current
    return target if target.exists() else ROOT/legacy
ASSETS=location('private/game-data','out/local-game-usa')
RUNTIME=location('private/runtime','out/research/revived-runtime')
NETWORK=location('build/network/public','out/research/browser-network/public')
UPSTREAM=location('vendor/revived-079','vendor/revived')
LAYOUT_MOVES={
    'out/local-game-usa':'private/game-data',
    'out/research/revived-runtime':'private/runtime',
    'out/research/browser-network/public':'build/network/public',
}
