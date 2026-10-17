import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserChat, groundedReply } from '../static/browser-ai.js';
import { BrowserSpeech } from '../static/browser-speech.js';
import { readFileSync } from 'node:fs';
const facts=JSON.parse(readFileSync(new URL('../static/profile.json',import.meta.url),'utf8'));

test('a fabricated generic agent answer becomes a clearly attributed profile excerpt',()=>{
  const result=groundedReply(facts,'What have you built with multi-agent systems?',
    'The company has built a multi-agent system that enables multiple teams to collaborate without prior knowledge. It identifies effective leads based on their interests.');
  assert.equal(result.excerpt,true);assert.match(result.text,/Plena Data/);assert.match(result.text,/five specialized agents/);
});

test('grounding rejects invented metrics and unrelated questions',()=>{
  assert.equal(groundedReply(facts,'Tell me about Plena','Plena Data built five specialized agents and improved sales by 95%.').excerpt,true);
  assert.match(groundedReply(facts,'What is the weather in Paris?','Sunny.').text,/don.t have profile facts/);
  const supported=groundedReply(facts,'Tell me about Plena','Plena Data Inc. built a desktop sales platform with five specialized agents for lead research, enrichment and multi-channel outreach.');
  assert.equal(supported.excerpt,false);
});

class WorkerStub {
  constructor(){this.messages=[];this.terminated=false;}
  postMessage(message){this.messages.push(message);}
  terminate(){this.terminated=true;}
  emit(data){this.onmessage({data});}
}

test('stopping browser generation rejects promptly and ignores a late answer',async()=>{
  const original=globalThis.Worker;globalThis.Worker=WorkerStub;
  try{
    const client=new BrowserChat(),controller=new AbortController();let tokens='';
    const pending=client.answer([{role:'user',content:'A question'}],text=>tokens+=text,controller.signal);
    const id=client.worker.messages[0].id;
    controller.abort();await assert.rejects(pending,{name:'AbortError'});
    assert.equal(client.worker.messages.at(-1).type,'cancel');
    client.worker.emit({id,type:'delta',delta:'late'});client.worker.emit({id,type:'answer',answer:'late'});
    assert.equal(tokens,'');assert.equal(client.pending.size,0);client.destroy();
  }finally{globalThis.Worker=original;}
});

test('closing during model download terminates the worker and settles loading',async()=>{
  const original=globalThis.Worker;globalThis.Worker=WorkerStub;
  try{
    const client=new BrowserChat(),loading=client.init(()=>{});
    client.destroy();await assert.rejects(loading,{name:'AbortError'});
    assert.equal(client.worker.terminated,true);assert.equal(client.pending.size,0);
  }finally{globalThis.Worker=original;}
});

test('worker failure rejects outstanding operations instead of leaving the UI busy',async()=>{
  const original=globalThis.Worker;globalThis.Worker=WorkerStub;
  try{
    const client=new BrowserChat(),pending=client.init(()=>{});
    client.worker.onerror();await assert.rejects(pending,/worker stopped/);assert.equal(client.pending.size,0);client.destroy();
  }finally{globalThis.Worker=original;}
});

test('stopping while microphone permission is pending closes a subsequently granted stream',async()=>{
  const originalContext=globalThis.AudioContext,originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  class ContextStub {resume(){return Promise.resolve();}close(){}}
  globalThis.AudioContext=ContextStub;
  let grantPermission,stopped=0;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(resolve=>grantPermission=resolve)}}});
  try{
    const speech=new BrowserSpeech(),recording=speech.record();speech.cancelRecording();
    grantPermission({getTracks:()=>[{stop:()=>stopped++}]});
    assert.equal(await recording,null);assert.equal(stopped,1);assert.equal(speech.recorder,null);speech.destroy();
  }finally{
    globalThis.AudioContext=originalContext;
    if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else delete globalThis.navigator;
  }
});
