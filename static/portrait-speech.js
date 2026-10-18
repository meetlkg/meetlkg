import {sampleNeuralMotion} from './portrait-neural-speech.js?v=speech-20261018-7b';
// Continuous coarticulation over model-produced phoneme timestamps (milliseconds).
// Conservative native FLAME combinations avoid exaggerated jaw and lip shapes.
const shapes={
 sil:[0,0,0,0],PP:[0,0,0,.88],FF:[.03,.12,0,.32],TH:[.10,.15,0,.06],
 DD:[.13,.10,0,0],kk:[.22,.08,0,0],CH:[.14,.04,.36,0],SS:[.07,.27,0,.03],
 nn:[.09,.12,0,0],RR:[.12,.04,.25,0],aa:[.56,.05,0,0],E:[.20,.37,0,0],
 I:[.10,.43,0,0],O:[.28,0,.48,0],U:[.11,0,.63,0]
};
// Speech-sized native poses are baked independently, including their mouth
// appearance. A convex mixture avoids adding incompatible full expressions.
export const speechChannels=['speechAA','speechEE','speechOO','speechUU','speechFF','speechDD','speechPP'];
const articulations={
 sil:[],PP:[['speechPP',1]],FF:[['speechFF',1]],TH:[['speechDD',.85],['speechFF',.15]],
 DD:[['speechDD',.8]],kk:[['speechDD',.65],['speechAA',.18]],CH:[['speechUU',.35],['speechDD',.5]],
 SS:[['speechEE',.25],['speechDD',.5]],nn:[['speechDD',.55]],RR:[['speechOO',.25],['speechUU',.7]],
 aa:[['speechAA',1]],E:[['speechEE',.9],['speechAA',.1]],I:[['speechEE',.85]],
 O:[['speechOO',1]],U:[['speechUU',1]]
};
const performanceCache=new WeakMap();
const neutralPerformance=()=>({nod:0,turn:0,blink:0,brow:0,gazeX:0,gazeY:0});
function performanceCues(track){
 if(performanceCache.has(track))return performanceCache.get(track);
 const cues=[];let previousEnd=-1000,lastGesture=-3000,lastAccent=-3000,phrase=0;
 for(const [word,start,duration] of track.words||[]){
  if(start-previousEnd>180&&start-lastGesture>1900){cues.push({at:Math.max(0,start-80),kind:'phrase',side:phrase++%2?1:-1});lastGesture=start;lastAccent=start;}
  else if(word.replace(/[^a-z]/gi,'').length>=6&&duration>=180&&start-lastAccent>1800){cues.push({at:Math.max(0,start-100),kind:'accent'});lastAccent=start;}
  if(/[.!?]$/.test(word)&&duration>0)cues.push({at:start+duration+50,kind:'pause',side:phrase%2?1:-1});
  previousEnd=start+duration;
 }
 // Inworld's word timestamps can omit sentence punctuation. Use real breath
 // gaps as well, so a long answer does not get one gesture and then freeze.
 if(track.energy?.length){
  const step=track.energyStepMs||10;let quiet=-1,lastPause=-3000,lastBlink=-3500;
  for(let i=0;i<=track.energy.length;i++){
   let value=0;for(let k=-2;k<=2;k++)value+=track.energy[Math.max(0,Math.min(track.energy.length-1,i+k))]||0;
   const isQuiet=i<track.energy.length&&value/5<.018;
   if(isQuiet&&quiet<0)quiet=i;
   if(!isQuiet&&quiet>=0){
    const start=quiet*step,end=i*step;
    if(end-start>=140&&start>300&&start-lastPause>1900&&end<track.duration*1000-350){
     if(!cues.some(c=>c.kind==='pause'&&Math.abs(c.at-start)<500)){
      const blink=start-lastBlink>3200;cues.push({at:start+25,kind:'pause',side:phrase%2?1:-1,blink});if(blink)lastBlink=start;
     }
     if(!cues.some(c=>c.kind==='phrase'&&Math.abs(c.at-end)<1800))cues.push({at:end-60,kind:'phrase',side:phrase++%2?1:-1});
     lastPause=start;
    }
    quiet=-1;
   }
  }
 }
 performanceCache.set(track,cues);return cues;
}
export function samplePerformance(track,seconds){
 if(seconds<0||seconds>track.duration||!Number.isFinite(seconds))return neutralPerformance();
 const time=seconds*1000,result=neutralPerformance();
 for(const cue of performanceCues(track)){
  const age=time-cue.at;
  if(cue.kind==='phrase'&&age>=0&&age<1600){
   const phase=age/1600,envelope=Math.sin(Math.PI*phase)**2;
   result.nod+=1.2*Math.sin(2*Math.PI*phase)*Math.sin(Math.PI*phase);
   result.turn+=cue.side*1.65*envelope;result.brow+=.28*envelope;
   result.gazeX+=cue.side*.08*envelope;result.gazeY-=.025*envelope;
  }else if(cue.kind==='accent'&&age>=0&&age<750){
   const envelope=Math.sin(Math.PI*age/750)**2;
   result.nod+=.65*envelope;result.brow+=.20*envelope;
  }else if(cue.kind==='pause'&&age>=0&&age<1000){
   if(age<210&&cue.blink!==false)result.blink=Math.max(result.blink,.92*Math.sin(Math.PI*age/210)**2);
   const envelope=Math.sin(Math.PI*age/1000)**2;
   result.gazeX+=cue.side*.13*envelope;result.gazeY+=.035*envelope;
  }
 }
 const fade=ease(seconds/.1)*ease((track.duration-seconds)/.4);
 if(fade===0)return neutralPerformance();
 for(const key of Object.keys(result))result[key]*=fade;
 result.nod=clamp(result.nod,-1.8,1.8);result.turn=clamp(result.turn,-2,2);result.brow=clamp(result.brow,0,.45);
 result.gazeX=clamp(result.gazeX,-.2,.2);result.gazeY=clamp(result.gazeY,-.06,.06);
 return result;
}
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
// Integrated normal kernel: a 10 ms acoustic label must not trigger the same
// full pose as a sustained vowel. This also makes interpolation seekable.
function normalCDF(x){
 const sign=x<0?-1:1,z=Math.abs(x)/Math.SQRT2,t=1/(1+.3275911*z);
 const erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-z*z);
 return .5*(1+sign*erf);
}
function speechEnergy(track,time){
 const step=track.energyStepMs||10;let value=0,sum=0;
 // Modest anticipation and slower release follow the spoken syllable rather
 // than individual waveform pulses. Silence inside a long label still rests.
 for(let offset=-60;offset<=40;offset+=10){
  const w=Math.exp(-.5*(offset/30)**2),p=(time+offset)/step,i=Math.floor(p),f=p-i;
  value+=w*((track.energy[i]||0)*(1-f)+(track.energy[i+1]||0)*f);sum+=w;
 }
 return clamp(value/sum);
}
export const silentMouth=()=>({jawOpen:0,mouthWide:0,mouthRound:0,lipPress:0,viseme:'sil',energy:0,articulation:Object.fromEntries(speechChannels.map(name=>[name,0])),performance:neutralPerformance()});
export function sampleSpeech(track,seconds){
 const time=seconds*1000;
 if(!Number.isFinite(time)||time<0||seconds>track.duration)return silentMouth();
 const amounts=[0,0,0,0],articulation=Object.fromEntries(speechChannels.map(name=>[name,0]));let total=0,closure=0,strongest=0,viseme='sil';
 // The lips begin preparing a little before the sound. Audio time stays absolute.
 const at=time+25;
 for(const [name,start,duration] of track.visemes){
  if(start>at+100)break;
  const end=start+duration;if(end<at-100)continue;
  const filtered=normalCDF((end-at)/24)-normalCDF((start-at)/24);
  for(const [channel,weight] of articulations[name]||articulations.DD)articulation[channel]+=weight*filtered;
  const attack=clamp(duration*.5,18,45),release=clamp(duration*.4,18,50);
  const strength=at<start?ease((at-start+attack)/attack):at>end?1-ease((at-end)/release):1;
  if(strength<=0)continue;
  const pose=shapes[name]||shapes.DD;total+=strength;
  if(strength>strongest){strongest=strength;viseme=name}
  if(name==='PP')closure=Math.max(closure,strength);
  for(let k=0;k<4;k++)amounts[k]+=pose[k]*strength;
 }
 const position=time/(track.energyStepMs||10),index=Math.floor(position),fraction=position-index;
 const energy=clamp((track.energy[index]||0)*(1-fraction)+(track.energy[index+1]||0)*fraction);
 const scale=.65+.35*energy;
 for(let k=0;k<4;k++)amounts[k]/=Math.max(1,total);
 // M/B/P closure dominates neighbouring vowels instead of leaving the jaw open.
 for(let k=0;k<3;k++)amounts[k]*=(1-closure)*scale;
 amounts[3]=Math.max(amounts[3],.88*closure);
 const envelope=speechEnergy(track,time),audibility=ease((envelope-.004)/.075);
 const articulationScale=audibility*(.72+.28*Math.sqrt(envelope));
 for(const channel of speechChannels)articulation[channel]*=articulationScale;
 // Bilabial closure overrides open vowels, while preserving smooth approach.
 for(const channel of speechChannels)if(channel!=='speechPP')articulation[channel]*=1-closure;
 articulation.speechPP=Math.max(articulation.speechPP,closure);
 const result={sampleTime:seconds,jawOpen:amounts[0],mouthWide:amounts[1],mouthRound:amounts[2],lipPress:amounts[3],viseme,energy,articulation,performance:samplePerformance(track,seconds)};
 if(track.neuralMotion)result.neural=sampleNeuralMotion(track.neuralMotion,seconds);
 return result;
}
export function audibleTime(context,starts,now=performance.now()){
 const stamp=context.getOutputTimestamp?.();
 // Device output time avoids drift from wall-clock timers and output buffering.
 const clock=stamp?.performanceTime>0?stamp.contextTime+(now-stamp.performanceTime)/1000:context.currentTime;
 return clock-starts;
}
