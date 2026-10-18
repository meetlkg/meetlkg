import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleSpeech,audibleTime,silentMouth,speechChannels,samplePerformance} from '../static/portrait-speech.js';
import {nativeExpressionWeights} from '../static/portrait-behavior.js';
import {acousticFrameDurations} from '../static/vendor/headtts/modules/utils.mjs';

const track={duration:1,energy:Array(101).fill(.8),energyStepMs:10,visemes:[['aa',100,150],['PP',250,90],['U',340,150]]};
test('model-timed closed consonants dominate adjacent vowels',()=>{
 const mouth=sampleSpeech(track,.245);
 assert.equal(mouth.jawOpen,0);assert.equal(mouth.mouthRound,0);assert.equal(mouth.lipPress,.88);
 assert.ok(sampleSpeech(track,.15).jawOpen>.4);assert.ok(sampleSpeech(track,.39).mouthRound>.4);
 assert.deepEqual(sampleSpeech(track,-.01),silentMouth());assert.deepEqual(sampleSpeech(track,1.01),silentMouth());
 assert.equal(sampleSpeech(track,.8).jawOpen,0);
});
test('coarticulation stays continuous at phoneme boundaries',()=>{
 let last=sampleSpeech(track,0);
 for(let ms=1;ms<1000;ms++){
  const next=sampleSpeech(track,ms/1000);
  for(const key of ['jawOpen','mouthWide','mouthRound','lipPress']){
   assert.ok(next[key]>=0&&next[key]<=1);
   assert.ok(Math.abs(next[key]-last[key])<.07,`${key} jumped at ${ms}ms`);
  }
  last=next;
 }
 const weights=nativeExpressionWeights({speaking:true,mouth:sampleSpeech(track,.245),interest:1});
 assert.equal(weights.jawOpen,0);assert.ok(weights.interested<.02);
 assert.ok(Object.values(nativeExpressionWeights({paused:true,speaking:true,mouth:sampleSpeech(track,.15)})).every(n=>n===0));
});
test('animation uses device output time instead of delayed wall-clock word events',()=>{
 assert.equal(audibleTime({getOutputTimestamp:()=>({contextTime:5,performanceTime:1000}),currentTime:6},4,1100),1.0999999999999996);
 assert.equal(audibleTime({currentTime:6},4),2);
});
test('phoneme timestamps use the decoder’s actual rounded frame counts',()=>{
 assert.deepEqual(acousticFrameDurations([2.5,3.5,.1,4.6,2.1]),[2,4,1,5,2]);
 assert.throws(()=>acousticFrameDurations([NaN]),/Invalid acoustic/);
});
test('authored speech poses stay convex and never add the old wide/open mouth fields',()=>{
 let previous=sampleSpeech(track,0);
 for(let ms=1;ms<1000;ms++){
  const mouth=sampleSpeech(track,ms/1000),w=nativeExpressionWeights({speaking:true,mouth,interest:1});
  assert.ok(speechChannels.reduce((sum,name)=>sum+w[name],0)<=1.00001);
  for(const name of speechChannels){assert.ok(w[name]>=0&&w[name]<=1);assert.ok(Math.abs(mouth.articulation[name]-previous.articulation[name])<.07);}
  for(const name of ['jawOpen','mouthWide','mouthRound','lipPress','interested'])assert.equal(w[name],0);
  previous=mouth;
 }
 const closed=sampleSpeech(track,.245).articulation;
 assert.equal(closed.speechPP,1);for(const name of speechChannels)if(name!=='speechPP')assert.equal(closed[name],0);
});
test('phrase gestures use audio time, remain subtle, and reset outside playback',()=>{
 const clip={duration:5,words:[['Hello',100,300],['there.',420,280],['Another',1700,400],['thought.',2150,400],['Thanks.',4100,300]]};
 assert.ok(samplePerformance(clip,.5).nod>0);
 let last=samplePerformance(clip,0),brow=0,turn=0;
 for(let t=.01;t<5;t+=.01){
  const p=samplePerformance(clip,t);assert.ok(Math.abs(p.nod)<=1.8&&Math.abs(p.turn)<=2&&p.blink<=.92);
  for(const key of ['nod','turn','brow','gazeX','gazeY'])assert.ok(Math.abs(p[key]-last[key])<.1,`${key} must not snap`);
  brow=Math.max(brow,p.brow);turn=Math.max(turn,Math.abs(p.turn));last=p;
 }
 assert.ok(brow>.2&&turn>1,'speech includes visible upper-face expression and head accents');
 const rest={nod:0,turn:0,blink:0,brow:0,gazeX:0,gazeY:0};
 assert.deepEqual(samplePerformance(clip,5.1),rest);
 assert.deepEqual(samplePerformance(clip,-1),rest);
 assert.deepEqual(samplePerformance(clip,5),rest);
});

test('short labels cannot produce full-strength vowel snaps',()=>{
 const clip={duration:1,energy:Array(101).fill(1),energyStepMs:10,visemes:[['DD',100,200],['aa',300,10],['DD',310,200]]};
 let peak=0,previous=0;
 for(let ms=100;ms<500;ms++){
  const w=sampleSpeech(clip,ms/1000).articulation.speechAA;
  peak=Math.max(peak,w);assert.ok(Math.abs(w-previous)<.02,'no abrupt vowel twitch');previous=w;
 }
 assert.ok(peak<.2,'ten milliseconds is too short to reach an open-vowel extreme');
});
test('recorded breath gaps sustain facial expression when word punctuation is absent',()=>{
 const clip={duration:8,words:[['Hello',100,300]],energyStepMs:10,energy:Array.from({length:801},(_,i)=>i>=250&&i<300?0:.8)};
 assert.ok(samplePerformance(clip,2.63).blink>.5,'blink occurs during the measured breath');
 assert.ok(Math.abs(samplePerformance(clip,3.7).turn)>1,'the next phrase gets a fresh gesture');
 assert.equal(samplePerformance({...clip,energy:Array(801).fill(.8)},3.7).turn,0,'no invented breath when audio is continuous');
});
test('a held vowel relaxes when the actual recording becomes silent',()=>{
 const clip={duration:1,energy:Array.from({length:101},(_,i)=>i<30?.8:0),energyStepMs:10,visemes:[['E',100,700]]};
 const strength=t=>Object.values(sampleSpeech(clip,t).articulation).reduce((s,x)=>s+x,0);
 assert.ok(strength(.2)>.8);assert.equal(strength(.5),0);
});
