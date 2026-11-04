#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Validate the maintained dual-protocol relay without overwriting its adapters.

The old scaffolder copied upstream over the active server. Keep both protocol
implementations and their Durable Object identities when preparing a deployment.
No credentials, game resources or generated deployment bundles are written.
"""
import json
from pathlib import Path
from check_revived_disc import REVISION

ROOT=Path(__file__).resolve().parents[1]


def main():
    relay=ROOT/'relay'
    config=json.loads((relay/'wrangler.json').read_text())
    source=json.loads((relay/'SOURCE.json').read_text())
    expected={'ROOM':'Room','LOBBIES':'LobbyIndex','ROOM_V2':'RoomV2','LOBBIES_V2':'LobbyIndexV2'}
    bindings={item['name']:item['class_name'] for item in config['durable_objects']['bindings']}
    if any(bindings.get(name)!=value for name,value in expected.items()):
        raise SystemExit('The relay must preserve both protocol namespaces.')
    if source['protocol2']['revision']!=REVISION:
        raise SystemExit('Protocol 2 source revision does not match the browser core.')
    for name in ('src/index.ts','src/room.ts','src/lobbies.ts','src/v2/index.ts','src/v2/room.ts','src/v2/lobbies.ts'):
        if not (relay/name).is_file():raise SystemExit('Missing relay source: '+name)
    migrations={item['tag']:set(item.get('new_sqlite_classes',[])) for item in config['migrations']}
    if migrations.get('v1')!={'Room','LobbyIndex'} or migrations.get('protocol-2')!={'RoomV2','LobbyIndexV2'}:
        raise SystemExit('Do not replace or rename the existing Durable Object migrations.')
    print('Dual-protocol relay ready:',relay)
    print('Next: cd relay; npm ci; npm run typecheck; npm run deploy')


if __name__=='__main__':main()
