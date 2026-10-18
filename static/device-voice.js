// Use only installed voices. Text never goes to a remote speech service.
// Word boundaries synchronize estimated mouth shapes; this is not phoneme-perfect TTS.
export function mouthCues(text){
 const cues=[];let time=0;
 for(const match of text.matchAll(/[a-z0-9]+|[.,!?;:]/gi)){
  const word=match[0].toLowerCase();
  if(/^[.,!?;:]$/.test(word)){time+=/[.!?]/.test(word)?220:110;continue;}
  const shapes=[];
  for(let i=0;i<word.length;i++){
   const pair=word.slice(i,i+2),letter=word[i];
   if(['th','sh','ch','oo','ee','ou'].includes(pair)){shapes.push({th:'TH',sh:'CH',ch:'CH',oo:'U',ee:'E',ou:'O'}[pair]);i++;}
   else shapes.push(/[mbp]/.test(letter)?'PP':/[fv]/.test(letter)?'FF':/[a]/.test(letter)?'aa':/[eiy]/.test(letter)?'E':letter==='o'?'O':letter==='u'?'U':letter==='r'?'RR':/[sz]/.test(letter)?'SS':'DD');
  }
  const duration=Math.max(170,Math.min(640,word.length*47));
  cues.push({charIndex:match.index,start:time,duration,shapes});time+=duration+35;
 }
 return cues;
}
export class DeviceVoice {
 constructor(){this.synth=globalThis.speechSynthesis;this.token=0;this.active=null;}
 get supported(){return Boolean(this.synth&&globalThis.SpeechSynthesisUtterance);}
 selectVoice(){
  const voices=this.synth?.getVoices().filter(voice=>voice.localService&&/^en(?:[-_]|$)/i.test(voice.lang))||[];
  return voices.sort((a,b)=>this.voiceScore(b)-this.voiceScore(a))[0];
 }
 voiceScore(voice){return (/Rishi|Daniel|Alex|Aaron/i.test(voice.name)?20:0)+(/^en[-_]IN/i.test(voice.lang)?5:0)+(voice.default?2:0);}
 async voice(){
  if(!this.supported)throw new Error('Voice isn’t available in this browser.');
  if(this.selectVoice())return this.selectVoice();
  await new Promise(resolve=>{
   let timer;
   const finish=()=>{clearTimeout(timer);this.synth.removeEventListener('voiceschanged',finish);resolve();};
   this.synth.addEventListener('voiceschanged',finish);timer=setTimeout(finish,1200);
  });
  const voice=this.selectVoice();
  if(!voice)throw new Error('This browser has no installed English voice. Written replies still work.');
  return voice;
 }
 stop(){
  ++this.token;const active=this.active;this.active=null;
  active?.finish();this.synth?.cancel();
 }
 async say(text,onState=()=>{},onViseme=()=>{}){
  this.stop();const token=this.token;
  const voice=await this.voice();if(token!==this.token)return;
  const utterance=new SpeechSynthesisUtterance(text.replace(/\n+/g,'. ').replace(/ · /g,', ').replace(/→/g,' to '));
  utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=1.03;utterance.pitch=1;
  const cues=mouthCues(utterance.text);let origin=0,timer,watchdog,settled=false,last='sil';
  return new Promise((resolve,reject)=>{
   const finish=error=>{
    if(settled)return;settled=true;clearInterval(timer);clearTimeout(watchdog);
    if(this.active?.utterance===utterance)this.active=null;
    utterance.onstart=utterance.onboundary=utterance.onend=utterance.onerror=null;
    onViseme('sil');onState('idle');
    if(error)reject(error);else resolve();
   };
   this.active={utterance,finish};
   utterance.onstart=()=>{
    if(settled||token!==this.token){finish();return;}
    origin=performance.now();onState('speaking');
    timer=setInterval(()=>{
     const elapsed=(performance.now()-origin)*utterance.rate;
     const cue=cues.find(c=>elapsed>=c.start&&elapsed<c.start+c.duration);
     const shape=cue?cue.shapes[Math.min(cue.shapes.length-1,Math.floor((elapsed-cue.start)/cue.duration*cue.shapes.length))]:'sil';
     if(shape!==last){last=shape;onViseme(shape);}
    },35);
   };
   utterance.onboundary=event=>{
    if(settled||token!==this.token||event.name!=='word')return;
    const cue=cues.find(c=>c.charIndex>=event.charIndex);
    if(cue)origin=performance.now()-cue.start/utterance.rate;
   };
   utterance.onend=()=>finish();
   utterance.onerror=event=>finish(['canceled','interrupted'].includes(event.error)?undefined:new Error('Tap the speaker beside the reply to hear it.'));
   watchdog=setTimeout(()=>{finish(new Error('Voice paused. Tap the speaker to try again.'));this.synth.cancel();},90000);
   this.synth.speak(utterance);
  });
 }
 destroy(){this.stop();}
}
