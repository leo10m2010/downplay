// SPDX-License-Identifier: GPL-3.0-or-later
// External launchers use the original host barrier, not the server's >=2 countdown.
export function transportText(text,externalLauncher){
 if(!externalLauncher)return text;
 try{const value=JSON.parse(text);if(value.type==='hello'&&Array.isArray(value.features)){value.features=value.features.filter(feature=>feature!=='countdown');return JSON.stringify(value);}}catch{}
 return text;
}
