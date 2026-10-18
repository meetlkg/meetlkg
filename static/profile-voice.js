const base=new URL('./voice-inworld/',import.meta.url);
const voiceId='dapper-honey-5958__gokul';
export class ProfileVoice {
 constructor(){this.sequence=0;this.cache=new Map();this.active=null;this.name='Gokul · Inworld';}
 prime(){
  const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!Context)throw new Error('Audio isn’t available in this browser.');
  if(!this.context||this.context.state==='closed')this.context=new Context();
  return this.context.resume();
 }
 prepare(){
  return this.manifest??=fetch(new URL('manifest.json',base),{cache:'no-cache'}).then(response=>{if(!response.ok)throw new Error('Voice assets unavailable');return response.json()}).then(manifest=>{
   if(manifest.provider!=='Inworld'||manifest.voice!==voiceId||manifest.version!==3||!Array.isArray(manifest.entries))throw new Error('Voice pack does not match Gokul’s voice.');
   return manifest;
  }).catch(error=>{this.manifest=null;throw error});
 }
 async load(text,signal){
  const manifest=await this.prepare();if(signal.aborted)throw new DOMException('Stopped','AbortError');
  const item=manifest.entries.find(entry=>entry.text===text);
  if(!item||!/^[a-f0-9]{20}$/.test(item.id))throw new Error('That reply’s voice isn’t available right now.');
  if(this.cache.has(item.id)){const result=this.cache.get(item.id);this.cache.delete(item.id);this.cache.set(item.id,result);return result;}
  const [track,audio]=await Promise.all([
   fetch(new URL(item.id+'.json?v='+manifest.version,base),{signal}).then(r=>{if(!r.ok)throw new Error('Voice timing unavailable');return r.json()}),
   fetch(new URL(item.id+'.mp3?v='+manifest.version,base),{signal}).then(r=>{if(!r.ok)throw new Error('Voice audio unavailable');return r.arrayBuffer()})
  ]);
  if(track.text!==text||track.audio!==item.id+'.mp3'||track.voice!==manifest.voice||track.timingVersion!==manifest.version)throw new Error('Voice and reply do not match.');
  const buffer=await this.context.decodeAudioData(audio);
  if(signal.aborted)throw new DOMException('Stopped','AbortError');
  if(Math.abs(buffer.duration-track.duration)>.06)throw new Error('Voice timing does not match the audio.');
  const result={track,buffer};this.cache.set(item.id,result);
  while(this.cache.size>6)this.cache.delete(this.cache.keys().next().value);
  return result;
 }
 stop(){
  ++this.sequence;const active=this.active;this.active=null;
  active?.controller.abort();active?.finish?.();
 }
 async say(text,onState=()=>{}){
  this.stop();const sequence=this.sequence,controller=new AbortController();
  const active={controller};this.active=active;let settled=false;
  const reset=()=>{if(settled)return;settled=true;onState('idle');if(this.active===active)this.active=null;};
  const current=()=>sequence===this.sequence&&!controller.signal.aborted;
  let abort;const cancelled=new Promise((_,reject)=>{abort=()=>reject(new DOMException('Stopped','AbortError'));controller.signal.addEventListener('abort',abort,{once:true});});
  try{
   onState('preparing');await Promise.race([this.prime(),cancelled]);if(!current())return;
   // Stop can settle promptly even while decodeAudioData or the manifest finishes.
   const {buffer}=await Promise.race([this.load(text,controller.signal),cancelled]);
   if(!current())return;
   const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;source.connect(gain);gain.connect(this.context.destination);
   const starts=this.context.currentTime+.05;
   await new Promise((resolve,reject)=>{
    let done=false;
    const finish=(error)=>{
     if(done)return;done=true;source.onended=null;
     try{source.stop()}catch{}
     source.disconnect();gain.disconnect();reset();if(error instanceof Error)reject(error);else resolve();
    };
    active.finish=finish;
    source.onended=()=>finish();
    try{
     source.start(starts);
     onState('speaking');
    }catch(error){finish(error);}
   });
  }catch(error){if(current()&&error.name!=='AbortError')throw error;}
  finally{controller.signal.removeEventListener('abort',abort);reset();}
 }
 destroy(){this.stop();this.cache.clear();this.context?.close().catch(()=>{});}
}
