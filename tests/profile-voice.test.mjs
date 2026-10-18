import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ProfileVoice} from '../static/profile-voice.js';
import {voiceCorpus,spokenText} from '../scripts/voice-corpus.mjs';

const track={voice:'dapper-honey-5958__gokul',timingVersion:3,duration:1,visemes:[['aa',100,150],['PP',250,90]],energy:Array(101).fill(1),energyStepMs:10};
function setup(t){
 const previous=globalThis.AudioContext;
 const sources=[];let startError;
 globalThis.AudioContext=class{
  currentTime=0;state='running';destination={};
  resume(){return Promise.resolve()}
  close(){return Promise.resolve()}
  createGain(){return {connect(){},disconnect(){}}}
  createBufferSource(){const source={connect(){},disconnect(){source.disconnected=true},start(at){if(startError)throw startError;source.started=true;source.startsAt=at},stop(){source.stopped=true}};sources.push(source);return source}
 };
 t.after(()=>globalThis.AudioContext=previous);
 const voice=new ProfileVoice();voice.load=async()=>({track,buffer:{duration:1}});
 t.after(()=>voice.destroy());
 return {voice,sources,failStart(){startError=new Error('Playback unavailable')}};
}
async function flush(){for(let i=0;i<15;i++)await Promise.resolve()}
test('audio-only playback completes cleanly and can replay the same reply',async t=>{
 const {voice,sources}=setup(t),states=[];
 const done=voice.say('A recorded reply',s=>states.push(s));await flush();
 assert.equal(sources[0].started,true);assert.equal(states.at(-1),'speaking');
 assert.equal(sources[0].startsAt,.05);assert.equal(sources[0].buffer.duration,1);
 sources[0].onended();await done;assert.equal(states.at(-1),'idle');assert.equal(sources[0].disconnected,true);
 const replay=voice.say('A recorded reply');await flush();assert.equal(sources.length,2);sources[1].onended();await replay;
});
test('audio-only loading does not request facial motion even when a manifest offers it',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 const voice=new ProfileVoice(),id='0123456789abcdefabcd',requests=[];
 voice.prepare=async()=>({version:3,voice:track.voice,motion:{rig:'speech-20261018-7'},entries:[{id,text:'A reply'}]});
 globalThis.fetch=async url=>{requests.push(new URL(url).pathname);return new URL(url).pathname.endsWith('.json')?{ok:true,json:async()=>({...track,text:'A reply',audio:id+'.mp3'})}:{ok:true,arrayBuffer:async()=>new ArrayBuffer(4)};};
 voice.context={decodeAudioData:async()=>({duration:1})};
 const result=await voice.load('A reply',new AbortController().signal);
 assert.equal(result.buffer.duration,1);assert.equal(requests.length,2);assert.ok(requests.every(path=>!path.includes('/motion/')));
 await voice.load('A reply',new AbortController().signal);assert.equal(requests.length,2,'replay reuses cached audio');
});
test('stop settles a pending clip and ignores a late download or decode',async t=>{
 const {voice,sources}=setup(t),states=[];let loaded;
 voice.load=()=>new Promise(resolve=>loaded=resolve);
 const done=voice.say('A reply',s=>states.push(s));await flush();voice.stop();await done;
 assert.equal(states.at(-1),'idle');loaded({track,buffer:{duration:1}});await flush();assert.equal(sources.length,0);
});
test('stop during AudioContext resume also settles immediately',async t=>{
 const {voice,sources}=setup(t);let resumed;voice.prime=()=>new Promise(resolve=>resumed=resolve);
 const done=voice.say('A reply');voice.stop();await done;resumed();await flush();assert.equal(sources.length,0);
});
test('playback error is reported and cancelling active speech disconnects it',async t=>{
 const {voice,sources,failStart}=setup(t),states=[];
 const done=voice.say('A reply',s=>states.push(s));await flush();voice.stop();await done;
 assert.equal(sources[0].stopped,true);assert.equal(states.at(-1),'idle');assert.equal(sources[0].onended,null);
 failStart();await assert.rejects(voice.say('Another reply'),/Playback unavailable/);
});
test('a mismatched text or audio duration cannot play a stale narration',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 const voice=new ProfileVoice(),id='0123456789abcdefabcd';
 voice.prepare=async()=>({version:3,voice:track.voice,entries:[{id,text:'A reply'}]});
 globalThis.fetch=async url=>new URL(url).pathname.endsWith('.json')?{ok:true,json:async()=>({...track,text:'Old facts',audio:id+'.mp3'})}:{ok:true,arrayBuffer:async()=>new ArrayBuffer(4)};
 voice.context={decodeAudioData:async()=>({duration:1})};
 await assert.rejects(voice.load('A reply',new AbortController().signal),/do not match/);
 await assert.rejects(voice.load('Unrecorded text',new AbortController().signal),/isn’t available/);
 globalThis.fetch=async url=>new URL(url).pathname.endsWith('.json')?{ok:true,json:async()=>({...track,text:'A reply',audio:id+'.mp3'})}:{ok:true,arrayBuffer:async()=>new ArrayBuffer(4)};
 voice.context.decodeAudioData=async()=>({duration:2});await assert.rejects(voice.load('A reply',new AbortController().signal),/does not match/);
});
test('the browser loads the custom voice pack and can recover from a stale manifest',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 const voice=new ProfileVoice();let wrongVoice=true;
 globalThis.fetch=async url=>{
  assert.ok(new URL(url).pathname.endsWith('/voice-inworld/manifest.json'));
  return {ok:true,json:async()=>({provider:'Inworld',version:3,voice:wrongVoice?'another-voice':track.voice,entries:[]})};
 };
 await assert.rejects(voice.prepare(),/does not match Gokul/);
 wrongVoice=false;assert.equal((await voice.prepare()).voice,track.voice);
});
test('voice corpus covers every answer variant, including follow-ups and unknowns',async()=>{
 const facts=JSON.parse(await readFile(new URL('../static/profile.json',import.meta.url)));
 const corpus=voiceCorpus(facts),texts=corpus.map(c=>c.text);
 assert.equal(new Set(texts).size,texts.length);assert.ok(texts.length>=40);
 assert.ok(texts.some(text=>/You’re welcome/.test(text)));assert.ok(texts.some(text=>/don’t have that detail/.test(text)));
 assert.match(spokenText('YOLOv2, ML and MCP at LaunchAI, 0→1.'),/YOLO version two, machine learning and M C P at Launch A I, zero to one/);
});
test('every reachable reply uses Gokul’s Inworld voice with matching audio and mouth timing',async()=>{
 const facts=JSON.parse(await readFile(new URL('../static/profile.json',import.meta.url)));
 const root=new URL('../static/voice-inworld/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',root)));
 assert.equal(manifest.provider,'Inworld');assert.equal(manifest.voice,'dapper-honey-5958__gokul');assert.equal(manifest.model,'inworld-tts-2');
 assert.equal(manifest.entries.length,voiceCorpus(facts).length);
 for(const answer of voiceCorpus(facts)){
  const entry=manifest.entries.find(item=>item.text===answer.text);assert.ok(entry,answer.id);
  assert.match(entry.id,/^[a-f0-9]{20}$/);
  const timing=JSON.parse(await readFile(new URL(entry.id+'.json',root)));
  const audio=await readFile(new URL(entry.id+'.mp3',root));
  assert.equal(timing.text,answer.text);assert.equal(timing.audio,entry.id+'.mp3');assert.equal(timing.timingVersion,3);assert.equal(timing.spokenText,spokenText(answer.text));
  assert.equal(timing.voice,manifest.voice);assert.equal(timing.provider,manifest.provider);assert.equal(timing.model,manifest.model);assert.equal(timing.sampleRate,48000);
  assert.ok(audio.length>10000);assert.ok(timing.duration>0);assert.ok(timing.visemes.length>0);
  for(const [name,start,duration] of timing.visemes){
   assert.ok(['sil','PP','FF','TH','DD','kk','CH','SS','nn','RR','aa','E','I','O','U'].includes(name));
   assert.ok(Number.isFinite(start)&&start>=0);assert.ok(Number.isFinite(duration)&&duration>0);
   assert.ok(start+duration<=timing.duration*1000+60);
  }
  assert.ok(timing.energy.every(value=>Number.isFinite(value)&&value>=0&&value<=1));
 }
});
