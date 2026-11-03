// SPDX-License-Identifier: GPL-3.0-or-later
import {createPcmConsumer} from './audio-consumer.js';
class Ring extends AudioWorkletProcessor{
 constructor(options){super();this.reader=createPcmConsumer(options.processorOptions.ring,sampleRate);this.elapsed=0;}
 process(_inputs,outputs){const [left,right]=outputs[0];this.reader.read(left,right);this.elapsed+=left.length;
  if(this.elapsed>=sampleRate){this.elapsed=0;this.port.postMessage(this.reader.stats());}return true;
 }
}
registerProcessor('dhd-ring',Ring);
