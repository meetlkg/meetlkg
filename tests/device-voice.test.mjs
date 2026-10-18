import test from 'node:test';
import assert from 'node:assert/strict';
import {DeviceVoice,mouthCues} from '../static/device-voice.js';
function setup(t){
 const previous={synth:globalThis.speechSynthesis,utterance:globalThis.SpeechSynthesisUtterance};
 const synth=new EventTarget();synth.voices=[{name:'Remote voice',lang:'en-US',localService:false},{name:'Daniel',lang:'en-GB',localService:true}];
 synth.getVoices=()=>synth.voices;synth.speak=utterance=>{synth.utterance=utterance};synth.cancel=()=>{synth.cancelled=(synth.cancelled||0)+1};
 globalThis.speechSynthesis=synth;globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
 t.after(()=>{globalThis.speechSynthesis=previous.synth;globalThis.SpeechSynthesisUtterance=previous.utterance});
 return {synth,voice:new DeviceVoice()};
}
test('speech uses an installed voice and never falls back to a remote service',async t=>{
 const {synth,voice}=setup(t);assert.equal(voice.selectVoice().name,'Daniel');
 synth.voices=synth.voices.filter(v=>!v.localService);assert.equal(voice.selectVoice(),undefined);
 const pending=voice.voice();synth.dispatchEvent(new Event('voiceschanged'));
 await assert.rejects(pending,/no installed English voice/);
});
test('stop cancels speech, closes the mouth and ignores late start callbacks',async t=>{
 const {synth,voice}=setup(t),states=[],shapes=[];t.after(()=>voice.destroy());
 const done=voice.say('A bright day',s=>states.push(s),s=>shapes.push(s));await Promise.resolve();
 const utterance=synth.utterance,start=utterance.onstart;
 assert.equal(utterance.voice.localService,true);start();assert.equal(states.at(-1),'speaking');
 voice.stop();await done;assert.equal(states.at(-1),'idle');assert.equal(shapes.at(-1),'sil');
 const length=states.length;start();assert.equal(states.length,length);assert.equal(utterance.onboundary,null);
});
test('closing while voices are loading prevents delayed autoplay',async t=>{
 const {synth,voice}=setup(t);synth.voices=[];
 const done=voice.say('hello');voice.stop();
 synth.voices=[{name:'Daniel',lang:'en-GB',localService:true}];synth.dispatchEvent(new Event('voiceschanged'));
 await done;assert.equal(synth.utterance,undefined);
});
test('audio completion resets animation and cues contain open and closed mouth shapes',async t=>{
 const {synth,voice}=setup(t),states=[],shapes=[];t.after(()=>voice.destroy());
 const done=voice.say('Maybe a blue moon',s=>states.push(s),s=>shapes.push(s));await Promise.resolve();
 synth.utterance.onstart();synth.utterance.onend();await done;
 assert.deepEqual(states,['speaking','idle']);assert.equal(shapes.at(-1),'sil');
 const cues=mouthCues('Maybe a blue moon.');
 assert.ok(cues.some(c=>c.shapes.includes('PP')));assert.ok(cues.some(c=>c.shapes.includes('aa')));
 assert.ok(cues.some(c=>c.shapes.includes('U')));assert.ok(cues.every((c,i)=>!i||c.start>cues[i-1].start));
});
test('word boundaries realign the animated mouth to the spoken word',async t=>{
 const {synth,voice}=setup(t),shapes=[];t.after(()=>voice.destroy());
 const done=voice.say('A moon',()=>{},s=>shapes.push(s));await Promise.resolve();
 synth.utterance.onstart();
 await new Promise(resolve=>setTimeout(resolve,45));assert.ok(shapes.includes('aa'));
 synth.utterance.onboundary({name:'word',charIndex:2});
 await new Promise(resolve=>setTimeout(resolve,40));assert.ok(shapes.includes('PP'));
 voice.stop();await done;assert.equal(shapes.at(-1),'sil');
});
