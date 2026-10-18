// Offline asset build: node scripts/build-voice-pack.mjs <tool-directory> [--pilot]
// Needs @huggingface/transformers 4.0.0, pinned timestamped Kokoro model/voice files,
// and the venv with PyAV. These build dependencies are not served to visitors.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {Worker} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {voiceCorpus,spokenText,splitSpeech} from './voice-corpus.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),build=resolve(process.argv[2]),pilot=process.argv.includes('--pilot');
const out=resolve(root,'static/voice'),raw=resolve(build,'raw');await mkdir(out,{recursive:true});await mkdir(raw,{recursive:true});
const facts=JSON.parse(await readFile(resolve(root,'static/profile.json'))),corpus=voiceCorpus(facts);
const wrapper=resolve(build,'transformers-configured.mjs');
await writeFile(wrapper,`export * from './node_modules/@huggingface/transformers/dist/transformers.node.mjs';\nimport {StyleTextToSpeech2Model,env} from './node_modules/@huggingface/transformers/dist/transformers.node.mjs';\nenv.allowRemoteModels=false;\nconst load=StyleTextToSpeech2Model.from_pretrained.bind(StyleTextToSpeech2Model);\nStyleTextToSpeech2Model.from_pretrained=(name,options)=>load(name,{...options,session_options:{intraOpNumThreads:4,interOpNumThreads:1}});\n`);
const worker=new Worker(new URL('../static/vendor/headtts/modules/worker-tts.mjs',import.meta.url));
let sequence=0,readyResolve,readyReject;const pending=new Map();const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject});
worker.on('error',error=>{readyReject(error);for(const call of pending.values())call.reject(error);pending.clear()});
worker.on('message',data=>{
 if(data.type==='ready'){readyResolve();return}if(data.type==='progress')return;
 const call=pending.get(data.ref);if(!call)return;pending.delete(data.ref);
 if(data.type==='error')call.reject(new Error(data.data.error));else call.resolve(data.data);
});
worker.postMessage({type:'connect',data:{transformersModule:pathToFileURL(wrapper).href,model:resolve(build,'model'),dtype:'fp32',device:'cpu',styleDim:256,audioSampleRate:24000,frameRate:40,languages:['en-us'],dictionaryPath:resolve(root,'static/vendor/headtts/dictionaries'),voicePath:resolve(build,'voices'),voices:['am_fenrir'],deltaStart:0,deltaEnd:0,trace:0,verifyDurationAlignment:true}});
await ready;console.log('Full-precision Kokoro ready');
const synth=(text,voice)=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});worker.postMessage({type:'synthesize',id,data:{input:text,voice,language:'en-us',speed:.96,audioEncoding:'wav'}})});
try{
 const entries=[];
 const work=pilot?[corpus.find(c=>c.id==='agents')]:corpus;
 for(const entry of work){
  const text=spokenText(entry.text),id=createHash('sha256').update(entry.text).digest('hex').slice(0,20);
  const targets=pilot?['am_fenrir','am_michael']:['am_fenrir'];
  for(const voice of targets){
   const key=pilot?`${id}-${voice}`:id;let cached;
   try{cached=JSON.parse(await readFile(resolve(out,key+'.json')))}catch{}
   if(cached?.text===entry.text&&cached?.timingVersion===2&&cached.voice===voice&&cached.spokenText===text){entries.push({text:entry.text,id:key});continue}
   const chunks=[];let i=0;
   for(const part of splitSpeech(text)){
    const data=await synth(part,voice),path=resolve(raw,key+'-'+i+'.wav');await writeFile(path,Buffer.from(data.audio));delete data.audio;chunks.push({path,...data});i++;
   }
   const source=resolve(raw,key+'.json');await writeFile(source,JSON.stringify({id:key,text:entry.text,spokenText:text,voice,chunks}));
   const encoded=spawnSync(resolve(build,'venv/bin/python'),[resolve(root,'scripts/encode-voice.py'),source,out],{encoding:'utf8'});
   if(encoded.status!==0)throw new Error(encoded.stderr);entries.push({text:entry.text,id:key});
   console.log(`${entries.length}/${pilot?2:corpus.length} ${entry.id} ${encoded.stdout.trim()}`);
  }
 }
 if(!pilot){const provenance=JSON.parse(await readFile(resolve(build,'source.json')));await writeFile(resolve(out,'manifest.json'),JSON.stringify({version:2,voice:'am_fenrir',precision:'fp32',timing:'decoder-quantized frames',...provenance,entries}));console.log('Voice pack complete',entries.length);}
}finally{await worker.terminate()}
