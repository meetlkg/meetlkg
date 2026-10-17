// Both speech models execute locally. No browser SpeechRecognition service or
// speechSynthesis voice is used, since those can use remote vendor services.
export class BrowserSpeech {
  constructor(){this.context=new AudioContext();this.context.resume();this.calls=new Map();this.sequence=0;this.playToken=0;this.recordToken=0;this.nodes=new Set();this.timers=new Set();}
  async init(onProgress){
    const {HeadTTS}=await import('./vendor/headtts/modules/headtts.mjs');
    const adapter=navigator.gpu?await navigator.gpu.requestAdapter().catch(()=>null):null;
    this.tts=new HeadTTS({
      endpoints:adapter?['webgpu','wasm']:['wasm'],audioCtx:this.context,dtypeWebgpu:'q8',dtypeWasm:'q8',
      dictionaryURL:new URL('./vendor/headtts/dictionaries/',import.meta.url).href,
      voices:['am_fenrir'],defaultVoice:'am_fenrir',defaultLanguage:'en-us',
      transformersModule:'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0/dist/transformers.min.js'
    });
    this.asr=new Worker(new URL('./browser-asr-worker.js',import.meta.url),{type:'module'});
    this.asr.onmessage=({data})=>{
      const call=this.calls.get(data.id);if(!call)return;
      if(data.type==='progress'){onProgress?.('Speech recognition',data.progress);return;}
      this.calls.delete(data.id);
      if(data.type==='error')call.reject(new Error(data.error));else call.resolve(data.text);
    };
    this.asr.onerror=event=>{console.warn('Speech worker failed:',event.message);for(const call of this.calls.values())call.reject(new Error('Local speech recognition stopped.'));this.calls.clear();};
    await Promise.all([
      this.tts.connect(null,progress=>onProgress?.('Voice',progress)),
      this.asrCall('init')
    ]);
    if(!this.tts.isConnected)throw new Error('The local voice model could not start.');
  }
  asrCall(type,extra={},transfer=[]){
    const id=++this.sequence;
    return new Promise((resolve,reject)=>{this.calls.set(id,{resolve,reject});this.asr.postMessage({id,type,...extra},transfer);});
  }
  stopSpeech(){
    ++this.playToken;this.tts?.clear();
    for(const timer of this.timers)clearInterval(timer);this.timers.clear();
    for(const node of this.nodes){try{node.stop();}catch{}}this.nodes.clear();
  }
  async say(text,onState,onViseme){
    this.stopSpeech();const token=this.playToken;
    await this.context.resume();onState('preparing');
    const messages=await this.tts.synthesize({input:text});
    if(token!==this.playToken)return;
    if(!messages?.some(message=>message.type==='audio'&&message.data?.audio?.duration>0))throw new Error('No speech audio was generated.');
    for(const message of messages){
      if(message.type==='error')throw new Error('The local voice could not generate this reply.');
      if(message.type!=='audio')continue;
      if(token!==this.playToken)return;
      const data=message.data;
      const source=this.context.createBufferSource();source.buffer=data.audio;source.connect(this.context.destination);this.nodes.add(source);
      const starts=this.context.currentTime+.03;let last=-1;
      const timer=setInterval(()=>{
        const time=(this.context.currentTime-starts)*1000;
        let index=-1;
        for(let i=0;i<(data.vtimes?.length||0);i++){
          if(time>=data.vtimes[i]&&time<data.vtimes[i]+data.vdurations[i])index=i;
          if(data.vtimes[i]>time)break;
        }
        if(index!==last){last=index;onViseme(index<0?'sil':data.visemes[index]);}
      },25);
      this.timers.add(timer);onState('speaking');
      await new Promise(resolve=>{source.onended=()=>{clearInterval(timer);this.timers.delete(timer);this.nodes.delete(source);source.disconnect();resolve();};source.start(starts);});
      onViseme('sil');
    }
    if(token===this.playToken)onState('idle');
  }
  async record(){
    const token=++this.recordToken;
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
    if(token!==this.recordToken){stream.getTracks().forEach(track=>track.stop());return null;}
    this.stream=stream;this.recorder=new MediaRecorder(stream);const chunks=[];
    return new Promise((resolve,reject)=>{
      this.recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      this.recorder.onerror=()=>{this.releaseMic();reject(new Error('Microphone recording failed.'));};
      this.recorder.onstop=()=>{
        const mime=this.recorder?.mimeType||'';this.releaseMic();
        resolve(token===this.recordToken?new Blob(chunks,{type:mime}):null);
      };
      this.recorder.start();this.recordTimer=setTimeout(()=>this.finishRecording(),15000);
    });
  }
  releaseMic(){clearTimeout(this.recordTimer);this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;this.recorder=null;}
  finishRecording(){if(this.recorder?.state==='recording')this.recorder.stop();}
  cancelRecording(){++this.recordToken;this.finishRecording();if(!this.recorder)this.releaseMic();}
  async transcribe(blob){
    const decoded=await this.context.decodeAudioData(await blob.arrayBuffer());
    const offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000);
    const source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
    const mono=await offline.startRendering();const audio=mono.getChannelData(0).slice();
    return this.asrCall('transcribe',{audio},[audio.buffer]);
  }
  stop(){this.stopSpeech();this.cancelRecording();}
  destroy(){
    this.stop();this.asr?.terminate();this.tts?.ww?.terminate();
    for(const call of this.calls.values())call.reject(new DOMException('Stopped','AbortError'));this.calls.clear();this.context.close();
  }
}
