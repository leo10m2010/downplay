// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {probeAtomicShader,ATOMIC_PROBE,formatRuntimeError,graphicsFailureMessage} from '../web-native/gpu-probe.js';
let destroyed=0;
const device={createShaderModule({code}){assert.equal(code,ATOMIC_PROBE);return {};},async createComputePipelineAsync(){},destroy(){destroyed++;}};
await probeAtomicShader({async requestDevice(){return device;}});assert.equal(destroyed,1);
const metal=Error('program_source:38:7: error: field may not be qualified with an address space');
await assert.rejects(()=>probeAtomicShader({async requestDevice(){return {...device,async createComputePipelineAsync(){throw metal;}};}}),/field may not/);
assert.equal(destroyed,2);assert(graphicsFailureMessage(metal).includes('actualiza iOS'));
assert(!graphicsFailureMessage(Error('GPU allocation failed')).includes('actualiza iOS'));
const safariError={message:'GS: renderer failed',stack:'startRenderer@https://example.test/graphics_common.js:27:67'};
assert(formatRuntimeError(safariError).startsWith(safariError.message+'\n'));
assert.equal(formatRuntimeError({message:'ordinary',stack:'Error: ordinary\n at start'}),'Error: ordinary\n at start');
const longShader=Error('generated Metal:\n'+'shader source\n'.repeat(5000)+'program_source:38:7: error: field may not be qualified with an address space');
const bounded=formatRuntimeError(longShader);assert(bounded.length<=32768);assert(bounded.includes('generated Metal:'));assert(bounded.includes('program_source:38:7: error: field may not be qualified with an address space'));
let resolveDevice;const controller=new AbortController(),pending=probeAtomicShader({requestDevice(){return new Promise(done=>resolveDevice=done);}},controller.signal);
controller.abort(Error('deadline'));resolveDevice(device);await assert.rejects(()=>pending,/deadline/);assert.equal(destroyed,3);
console.log('Atomic pipeline errors, WebKit message preservation and device cleanup (including late timeout) passed.');
