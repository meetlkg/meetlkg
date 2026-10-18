import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {neuralSpeechRevision,neuralSpeechChannels,validateNeuralMotion,sampleNeuralMotion} from '../static/portrait-neural-speech.js';
import {nativeExpressionWeights} from '../static/portrait-behavior.js';
import {sampleSpeech} from '../static/portrait-speech.js';

function fixture(){
 const frames=Array.from({length:31},(_,i)=>neuralSpeechChannels.map((_,c)=>c===0?-i/30:c===16?i/60:0));
 return {version:1,rig:neuralSpeechRevision,model:'StreamingTalker',audio:'test.mp3',duration:1,fps:30,channels:neuralSpeechChannels,frames};
}
test('signed learned motion interpolates on the audio clock and resets out of range',()=>{
 const motion=validateNeuralMotion(fixture(),{audio:'test.mp3',duration:1});
 const value=sampleNeuralMotion(motion,.25);
 assert.ok(Math.abs(value.speechMotion00+.25)<1e-7);
 assert.ok(Math.abs(value.speechColor00-.125)<1e-7);
 for(const time of [-.1,1.01,NaN])assert.equal(sampleNeuralMotion(motion,time),null);
 const weights=nativeExpressionWeights({speaking:true,interest:1,gazeX:1,mouth:{neural:value}});
 assert.equal(weights.speechMotion00,-.25);assert.equal(weights.interested,0);assert.ok(weights.gazeRight>0);
 for(const name of ['speechAA','speechEE','jawOpen','lipPress'])assert.equal(weights[name],0);
 assert.ok(Object.values(nativeExpressionWeights({speaking:true,paused:true,mouth:{neural:value}})).every(v=>v===0));
});
test('motion validation rejects the wrong recording, rig, damaged frames and nonfinite values',()=>{
 const track={audio:'test.mp3',duration:1};
 for(const change of [{audio:'wrong.mp3'},{duration:2},{rig:'old'},{channels:[]},{frames:[]}])assert.throws(()=>validateNeuralMotion({...fixture(),...change},track));
 const corrupt=fixture();corrupt.frames[1][0]=NaN;assert.throws(()=>validateNeuralMotion(corrupt,track),/incomplete/);
});
test('speaking can raise the brows without adding the smile or altering lip motion',()=>{
 const neural=sampleNeuralMotion(fixture(),.25);
 const plain=nativeExpressionWeights({speaking:true,mouth:{neural}});
 const expressive=nativeExpressionWeights({speaking:true,mouth:{neural,performance:{brow:.28}}});
 assert.equal(expressive.browLift,.28);assert.equal(expressive.interested,0);
 for(const name of neuralSpeechChannels)assert.equal(expressive[name],plain[name]);
});
test('the speech sampler exposes the neural track without altering audio time',()=>{
 const track={audio:'test.mp3',duration:1,energy:Array(101).fill(.5),visemes:[['aa',100,200]],neuralMotion:fixture()};
 assert.equal(sampleSpeech(track,.25).neural.speechMotion00,-.25);
 assert.equal(sampleSpeech(track,1.1).neural,undefined);
});
test('each published learned track matches its actual audio and the complete facial field layout',()=>{
 const root=new URL('../static/voice-inworld/',import.meta.url);
 const manifest=JSON.parse(readFileSync(new URL('review-manifest.json',root)));
 assert.equal(manifest.motion?.rig,neuralSpeechRevision);
 const meta=JSON.parse(readFileSync(new URL('../static/avatar-omg/model.json',import.meta.url)));
 assert.equal(meta.speechRig.motionRevision,neuralSpeechRevision);
 assert.deepEqual(meta.speechRig.motionChannels,neuralSpeechChannels);
 for(const entry of manifest.entries){
  const track=JSON.parse(readFileSync(new URL(entry.id+'.json',root)));
  const motion=validateNeuralMotion(JSON.parse(readFileSync(new URL('motion/'+entry.id+'.json',root))),track);
  const audio=readFileSync(new URL(entry.id+'.mp3',root));
  assert.equal(motion.audioSha256,createHash('sha256').update(audio).digest('hex'));
  assert.ok(motion.frames[0].every(v=>Math.abs(v)<1e-5),'starts at the original likeness');
  assert.ok(motion.frames.at(-1).every(v=>v===0),'stops at rest');
  assert.ok(motion.frames.some(frame=>frame.slice(0,16).some(v=>Math.abs(v)>.01)),'contains learned geometry motion');
 }
});
test('the exported recording distinguishes rounded lips and seals bilabial consonants',()=>{
 const root=new URL('../static/avatar-omg/',import.meta.url);
 const meta=JSON.parse(readFileSync(new URL('model.json',root))),fields=readFileSync(new URL('expressions.bin',root)),ply=readFileSync(new URL('portrait.ply',root));
 const end=ply.indexOf(Buffer.from('end_header\n'))+11,stride=[...ply.subarray(0,end).toString().matchAll(/property float (\w+)/g)].length*4;
 const motion=JSON.parse(readFileSync(new URL('../static/voice-inworld/motion/15457a0ec5438f5bff9b.json',import.meta.url)));
 const point=(seconds,key)=>{
  const i=meta.speechRig.mouthAnchors[key],weights=sampleNeuralMotion(motion,seconds);
  return [0,1,2].map(k=>{
   let value=ply.readFloatLE(end+i*stride+k*4);
   for(const name of neuralSpeechChannels){const c=meta.channels.indexOf(name);value+=weights[name]*fields.readInt16LE((c*meta.headCount+i-meta.headStart)*12+k*2)/32767*meta.scales[k];}
   return value;
  });
 };
 const width=t=>point(t,'right')[0]-point(t,'left')[0];
 assert.ok(width(28/30)<width(10/30)*.76,'O must narrow the actual exported mouth');
 assert.ok(motion.frames[19].every(v=>Math.abs(v)<1e-5),'M/B/P must fully seal the source lips without a ghost dental layer');
 const brow=meta.channels.indexOf('browLift');assert.ok(brow>=0);
 for(const i of Object.values(meta.speechRig.mouthAnchors))for(let k=0;k<6;k++)assert.equal(fields.readInt16LE((brow*meta.headCount+i-meta.headStart)*12+k*2),0,'brow accents cannot move or recolor the mouth');
});
