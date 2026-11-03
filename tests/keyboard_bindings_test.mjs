// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../web-native/keyboard.js',import.meta.url),'utf8');
const {defaults,validateBindings,rebind}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const original=defaults();assert(validateBindings(original));
let changed=rebind(original,'cross','KeyP');assert.deepEqual(changed.cross,['KeyP']);assert.deepEqual(original.cross,['KeyX','Space']);
changed=rebind(original,'cross','KeyS');assert.deepEqual(changed.triangle,['KeyX','Backspace']);assert(validateBindings(changed));
changed=rebind(original,'cross','Space');assert.deepEqual(changed.cross,['Space']);assert(validateBindings(changed));
assert(!validateBindings({...original,cross:['KeyS']}));assert(!validateBindings({...original,start:[]}));
assert(!validateBindings({...original,unexpected:'bad'}));
assert.throws(()=>rebind(original,'cross','F5'));assert.throws(()=>rebind(original,'missing','KeyP'));
console.log('Keyboard assignments: defaults, conflicts, aliases, validation and immutable updates passed.');
