import {mountAvatar} from './avatar-scene.js?v=speech-20261018-7b-capture';
import {sampleSpeech,silentMouth} from './portrait-speech.js?v=speech-20261018-7b';
import {validateNeuralMotion,neuralSpeechRevision} from './portrait-neural-speech.js?v=speech-20261018-7b';
const $=id=>document.getElementById(id),audio=$('audio');
let track=null,legacyTrack=null,revision=0,audioURL=null;
const selectedTrack=()=>$('motion-mode').value==='legacy'?legacyTrack:track;
try{
 const [face,manifest]=await Promise.all([mountAvatar($('face'),{followPointer:false,allowManualTurn:true}),fetch('./static/voice-inworld/review-manifest.json',{cache:'no-cache'}).then(r=>r.json())]);
 if(!manifest.motion){$('motion-mode').value='legacy';$('motion-mode').disabled=true;}
 for(const entry of manifest.entries){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.text.slice(0,75);$('clip').append(option)}
 face.setState('speaking');
 face.setSpeechSampler((renderLead=0)=>{
  const selected=$('pose').value;
  const mouth=selected==='audio'&&track?sampleSpeech(selectedTrack(),audio.currentTime+(audio.paused?0:renderLead*audio.playbackRate)):silentMouth();
  if(selected.startsWith('speech'))mouth.articulation[selected]=1;
  if(!$('performance').checked)mouth.performance={nod:0,turn:0,blink:0,brow:0,gazeX:0,gazeY:0};return mouth;
 });
 async function load(){
  const current=++revision;audio.pause();$('play').disabled=true;
  $('time').disabled=true;$('record-preview').disabled=true;$('status').textContent='Opening the recording…';
  const id=$('clip').value;
  const [loaded,recording]=await Promise.all([
   fetch(`./static/voice-inworld/${id}.json`).then(r=>r.json()),
   fetch(`./static/voice-inworld/${id}.mp3`).then(r=>{if(!r.ok)throw Error('Recording unavailable');return r.blob()})
  ]);
  if(manifest.motion?.rig===neuralSpeechRevision){
   const response=await fetch(`./static/voice-inworld/motion/${id}.json?v=${neuralSpeechRevision}`);
   if(!response.ok)throw Error('Recorded motion unavailable');
   loaded.neuralMotion=validateNeuralMotion(await response.json(),loaded);
  }
  if(current!==revision)return;
  track=loaded;legacyTrack={...loaded,neuralMotion:null};
  if(audioURL)URL.revokeObjectURL(audioURL);
  // A complete local Blob supports frame seeking even when the development
  // HTTP server does not implement byte-range requests.
  audioURL=URL.createObjectURL(recording);
  const ready=new Promise((resolve,reject)=>{
   const cleanup=()=>{audio.removeEventListener('loadedmetadata',done);audio.removeEventListener('error',failed)};
   const done=()=>{cleanup();resolve()},failed=()=>{cleanup();reject(Error('Recording could not be opened'))};
   audio.addEventListener('loadedmetadata',done);audio.addEventListener('error',failed);
  });
  audio.src=audioURL;audio.playbackRate=Number($('rate').value);await ready;
  if(current!==revision)return;
  $('transcript').textContent=manifest.entries.find(e=>e.id===id).text;$('play').disabled=false;$('time').disabled=false;$('record-preview').disabled=false;$('status').textContent='Ready · same 3D model and recordings as the portfolio';
 }
 function seek(t){audio.pause();audio.currentTime=Math.max(0,Math.min(track?.duration||0,t));$('pose').value='audio'}
 $('clip').onchange=()=>load().catch(error=>{$('status').textContent=error.message});$('clip').disabled=false;
 $('rate').onchange=()=>audio.playbackRate=Number($('rate').value);
 $('play').onclick=()=>{ $('pose').value='audio';audio.play() };
 $('pause').onclick=()=>audio.pause();$('restart').onclick=()=>seek(0);
 $('time').oninput=$('time').onchange=e=>seek(Number(e.target.value));
 $('previous').onclick=()=>seek(audio.currentTime-1/30);$('next').onclick=()=>seek(audio.currentTime+1/30);
 $('pose').onchange=()=>audio.pause();
 document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{face.reset();face.rotate(Number(button.dataset.view))});
 $('next-cue').onclick=()=>{const cue=track?.visemes.find(([,s,d])=>(s+d*.5)/1000>audio.currentTime+.002);if(cue)seek((cue[1]+cue[2]*.5)/1000)};
 $('previous-cue').onclick=()=>{const cue=track?.visemes.findLast(([,s,d])=>(s+d*.5)/1000<audio.currentTime-.002);if(cue)seek((cue[1]+cue[2]*.5)/1000)};
 $('record-preview').onclick=async()=>{
  const button=$('record-preview');button.disabled=true;
  let recorder,video,stream,timer,sourceCanvas,drawCapture;
  try{
   const canvas=$('face').querySelector('canvas');
   if(!canvas?.captureStream||!audio.captureStream||typeof MediaRecorder==='undefined')throw Error('Preview recording is not supported in this browser.');
   seek(0);$('rate').value='1';audio.playbackRate=1;await audio.play();
   // The WebGL canvas is transparent over a white CSS stage. Composite that
   // same background for video formats that do not preserve alpha.
   const recordingCanvas=document.createElement('canvas');recordingCanvas.width=canvas.width;recordingCanvas.height=canvas.height;
   const context=recordingCanvas.getContext('2d');
   sourceCanvas=canvas;
   const timing=[];
   drawCapture=event=>{context.fillStyle='#fff';context.fillRect(0,0,recordingCanvas.width,recordingCanvas.height);context.drawImage(canvas,0,0);if(event.detail?.energy>.08&&Number.isFinite(event.detail?.sampleTime))timing.push((audio.currentTime-event.detail.sampleTime)*1000)};
   canvas.addEventListener('portrait-rendered',drawCapture);canvas.dataset.capture='true';
   video=recordingCanvas.captureStream(30);
   stream=new MediaStream([...video.getVideoTracks(),...audio.captureStream().getAudioTracks()]);
   const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));
   recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3500000});
   const chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
   $('status').textContent='Recording the preview…';
   await new Promise((resolve,reject)=>{
    recorder.onstop=resolve;recorder.onerror=()=>reject(Error('Preview recording failed.'));
    recorder.start();timer=setTimeout(()=>recorder.state!=='inactive'&&recorder.stop(),Math.min(20,track.duration)*1000);
   });
   audio.pause();
   const url=URL.createObjectURL(new Blob(chunks,{type:mime})),link=document.createElement('a');
   link.href=url;link.download=`gokul-${$('motion-mode').value}-speech.webm`;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
   $('status').textContent='Preview saved · original Inworld voice and browser render';
   if(timing.length){timing.sort((a,b)=>a-b);$('status').dataset.timing=JSON.stringify({frames:timing.length,medianDelayMs:timing[Math.floor(timing.length*.5)],p95DelayMs:timing[Math.floor(timing.length*.95)]})}
  }catch(error){$('status').textContent=error.message;}
  finally{clearTimeout(timer);if(sourceCanvas){delete sourceCanvas.dataset.capture;sourceCanvas.removeEventListener('portrait-rendered',drawCapture)}if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(track=>track.stop());button.disabled=false;}
 };
 setInterval(()=>{
  if(!track)return;const t=audio.currentTime,mouth=sampleSpeech(selectedTrack(),t);
  if(document.activeElement!==$('time'))$('time').value=t.toFixed(3);
  const word=track.words.find(([,s,d])=>t*1000>=s&&t*1000<s+d)?.[0]||'—';
  $('frame').textContent=$('pose').value==='audio'?`${t.toFixed(3)} s · ${audio.paused?'Paused':audio.playbackRate+'×'} · ${word} · ${mouth.viseme}\n${mouth.neural?'StreamingTalker · continuous 3D motion':Object.entries(mouth.articulation).filter(([,w])=>w>.01).map(([n,w])=>`${n}: ${w.toFixed(2)}`).join(' · ')}`:`Isolated pose · ${$('pose').selectedOptions[0].textContent}`;
 },60);
 await load();
 window.addEventListener('pagehide',()=>{audio.pause();if(audioURL)URL.revokeObjectURL(audioURL)},{once:true});
}catch(error){$('status').textContent=error.message;console.error(error)}
