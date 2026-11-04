// SPDX-License-Identifier: GPL-3.0-or-later
import type {Room} from './room';
import type {LobbyIndex} from './lobbies';
export type Protocol2Env=Omit<Env,'ROOM'|'LOBBIES'|'MIN_VERSION'>&{
 ROOM:DurableObjectNamespace<Room>;
 LOBBIES:DurableObjectNamespace<LobbyIndex>;
 MIN_VERSION:string;
};
