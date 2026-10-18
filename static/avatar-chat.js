import { chapters, projects, profile } from './profile-data.js';
import { BrowserChat, profileMessages, groundedReply } from './browser-ai.js';
import { BrowserSpeech } from './browser-speech.js';
const $=selector=>document.querySelector(selector);
const facts={chapters,projects,profile};
const transcript=$('#avatar-transcript'),input=$('#avatar-question'),stage=$('.avatar-stage');
const feedback=$('#avatar-feedback'),mic=$('#avatar-mic'),sound=$('#avatar-sound'),stop=$('#avatar-stop');
const load=$('#avatar-load'),engineSelect=$('#avatar-engine'),progress=$('#avatar-progress');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const intro=transcript.firstElementChild.cloneNode(true);
const secure=window.isSecureContext;
const canRecord=Boolean(secure&&navigator.mediaDevices?.getUserMedia&&window.MediaRecorder);
const canCompute=Boolean(window.Worker&&window.WebAssembly);
let mode=new URLSearchParams(location.search).get('chat')==='server'?'server':'browser';
let scene,sceneRequest,sceneStarted=false,paused=reduced.matches;
let localChat,speech,history=[],pending,request,operation=0,serviceCheck=0;
let available=false,checked=false,busy=false,listening=false,speaking=false,preparingSpeech=false;
let loading=false,loadingVoice=false,voiceReady=false,voiceReplies=false;
engineSelect.value=mode;
function state(){
  const value=listening?'listening':busy||preparingSpeech?'thinking':speaking?'speaking':'idle';
  stage.dataset.state=value;scene?.setState(value);
  const idle=loading?'Loading private chat':loadingVoice?'Loading local voice':available?'Ready when you are':mode==='browser'?'Private chat · not loaded':checked?'Conversation offline':'Connecting';
  $('#avatar-state').textContent={listening:'Listening…',thinking:preparingSpeech?'Preparing voice…':'Thinking…',speaking:'Speaking',idle}[value];
  $('#avatar-send').disabled=busy||listening||loading||loadingVoice||!available;
  document.querySelectorAll('[data-question]').forEach(button=>button.disabled=busy||listening||loading||loadingVoice||!available);
  mic.disabled=!canRecord||!voiceReady||!available||busy||loadingVoice;
  mic.setAttribute('aria-pressed',String(listening));mic.querySelector('span').textContent=listening?'Finish question':'Talk to me';
  sound.disabled=!available||loading||loadingVoice||busy;
  sound.textContent=loadingVoice?'Loading voice…':voiceReady?(voiceReplies?'Voice replies on':'Voice replies off'):'Enable voice · ~140 MB';
  sound.setAttribute('aria-pressed',String(voiceReplies));
  load.hidden=mode!=='browser'||available;load.disabled=!canCompute||loading;
  load.textContent=loading?'Preparing…':'Load chat · 140–210 MB';
  stop.hidden=!(busy||listening||speaking||preparingSpeech||loading||loadingVoice);
  transcript.setAttribute('aria-busy',String(busy));
  $('#avatar-local-note').textContent=mode==='browser'?'Chat and voice run on your device. Model files download on request; caching depends on your browser.':'Chat runs on the preview server. Enabled voice models still run on your device.';
}
function hint(){
  if(mode==='browser'&&!canCompute)return 'This browser needs WebAssembly and Web Workers for private chat.';
  if(!available)return mode==='browser'?'Load the small chat model to begin. Nothing downloads automatically.':'Conversation is offline. You can reach me by email.';
  if(!secure)return 'Text chat is ready. Microphone input requires HTTPS or localhost.';
  if(!voiceReady)return 'Type a question, or enable local voice to speak and hear replies.';
  return canRecord?'Tap “Talk to me”, speak, then tap “Finish question”. Audio stays on your device.':'Text and local voice replies are ready; recording is unavailable in this browser.';
}
function reportProgress(label,event){
  const fraction=typeof event?.progress==='number'?(event.progress>1?event.progress/100:event.progress):event?.total?event.loaded/event.total:null;
  progress.hidden=false;
  if(fraction!==null&&Number.isFinite(fraction)){progress.value=Math.max(0,Math.min(1,fraction));feedback.textContent=`${label}: ${Math.round(progress.value*100)}%`;}
  else{progress.removeAttribute('value');feedback.textContent=`${label}…`;}
}
function message(role,text,extra=''){
  const article=document.createElement('article');article.className=`avatar-message ${role} ${extra}`;
  const author=document.createElement('span');author.className='message-author';author.textContent=role==='user'?'YOU':'GOKUL’S AI AVATAR';
  const p=document.createElement('p');p.textContent=text;article.append(author,p);transcript.append(article);transcript.scrollTop=transcript.scrollHeight;return article;
}
function stopSpeech(){speech?.stopSpeech();speaking=false;preparingSpeech=false;scene?.setViseme('sil');}
async function speak(text){
  if(!voiceReplies||!voiceReady||document.hidden)return;
  const id=operation;preparingSpeech=true;state();
  try{
    await speech.say(text,value=>{if(id!==operation)return;preparingSpeech=value==='preparing';speaking=value==='speaking';if(value==='idle')feedback.textContent='Spoken reply finished. Ask another question.';state();},viseme=>scene?.setViseme(viseme));
  }catch{if(id===operation)feedback.textContent='Local voice could not play this reply. The written answer is above.';}
  finally{if(id===operation){preparingSpeech=false;speaking=false;scene?.setViseme('sil');state();}}
}
load.addEventListener('click',async()=>{
  if(loading||!canCompute)return;
  stopEverything();const id=++operation;loading=true;checked=true;feedback.textContent='Preparing private chat…';state();
  try{
    const adapter=secure&&navigator.gpu?await navigator.gpu.requestAdapter().catch(()=>null):null;
    if(id!==operation)return;
    localChat=new BrowserChat();await localChat.init(event=>{if(id===operation)reportProgress('Preparing private chat',event);},adapter?.features.has('shader-f16')?'SmolLM2-360M-Instruct-q4f16_1-MLC':'SmolLM2-360M-Instruct-q4f32_1-MLC',adapter?'gpu':'wasm');
    if(id!==operation)return;available=true;feedback.textContent=hint();
  }catch(error){if(id!==operation)return;localChat?.destroy();localChat=null;feedback.textContent=error.message||'The chat model could not load. Please retry.';}
  finally{if(id===operation){loading=false;progress.hidden=true;state();}}
});
sound.addEventListener('click',async()=>{
  if(voiceReady){voiceReplies=!voiceReplies;if(!voiceReplies)stopSpeech();state();return;}
  const id=++operation;stopSpeech();loadingVoice=true;feedback.textContent='Preparing speech on your device…';state();
  try{
    speech=new BrowserSpeech();
    await speech.init((label,event)=>{if(id===operation&&loadingVoice)reportProgress(label,event);});
    if(id!==operation)return;voiceReady=true;voiceReplies=true;feedback.textContent=hint();
  }catch(error){if(id!==operation)return;console.warn('Local voice initialization failed:',error);speech?.destroy();speech=null;feedback.textContent='Local voice could not load. Text chat is still available. Please retry the voice download.';}
  finally{if(id===operation){loadingVoice=false;progress.hidden=true;state();}}
});
async function serverAnswer(turns,onDelta,signal){
  const response=await fetch('/api/avatar/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:turns}),signal});
  if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'The preview conversation service is unavailable.');}
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',answer='',complete=false;
  while(true){
    const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});const lines=buffer.split('\n');buffer=lines.pop();
    for(const line of lines){if(!line.trim())continue;const event=JSON.parse(line);if(event.error)throw new Error(event.error);if(event.delta){answer+=event.delta;onDelta(event.delta);}if(event.answer){answer=event.answer;complete=true;}}
    if(done)break;
  }
  if(!complete)throw new Error('The reply was interrupted. Please retry.');return answer;
}
async function send(text){
  text=text.trim();if(!text||busy||listening||loading||loadingVoice||!available)return;
  if(text.length>1200){feedback.textContent='Please keep your question under 1,200 characters.';return;}
  stopSpeech();busy=true;const id=++operation;message('user',text);pending=message('assistant','Thinking about that…','pending');input.value='';
  feedback.textContent=mode==='browser'?'Thinking on your device…':'Finding the details in my profile…';state();
  request=new AbortController();const timeout=setTimeout(()=>request?.abort(),95000);let partial='';
  const delta=token=>{if(id!==operation)return;partial+=token;pending.classList.remove('pending');pending.querySelector('p').textContent=partial;transcript.scrollTop=transcript.scrollHeight;};
  try{
    const generated=mode==='browser'?await localChat.answer(profileMessages(facts,text,history),()=>{},request.signal):await serverAnswer([...history.slice(-4),{role:'user',content:text}],delta,request.signal);
    if(id!==operation)return;
    const result=mode==='browser'?groundedReply(facts,text,generated):{text:generated,excerpt:false};
    const answer=result.text;
    if(result.excerpt)pending.querySelector('.message-author').textContent='FROM MY PUBLIC PROFILE · EXCERPT';
    pending.classList.remove('pending');pending.querySelector('p').textContent=answer;pending=null;
    history.push({role:'user',content:text},{role:'assistant',content:answer});history=history.slice(-4);
    transcript.scrollTop=transcript.scrollHeight;feedback.textContent=result.excerpt?'The small model could not ground its reply. Showing public profile facts directly.':hint();busy=false;state();speak(answer);
  }catch(error){
    if(id!==operation)return;pending.classList.remove('pending');pending.classList.add('error');pending.querySelector('p').textContent=error.name==='AbortError'?'That took too long. Please try a shorter question.':error.message;pending=null;input.value=text;feedback.textContent='Your question is ready to retry.';
  }finally{clearTimeout(timeout);if(id===operation){request?.abort();request=null;busy=false;state();}}
}
function stopEverything(){
  ++operation;request?.abort();request=null;busy=false;
  if(pending){pending.remove();pending=null;}
  speech?.stop();listening=false;stopSpeech();
  if(loading){localChat?.destroy();localChat=null;loading=false;available=false;}
  if(loadingVoice){speech?.destroy();speech=null;loadingVoice=false;voiceReady=false;voiceReplies=false;}
  progress.hidden=true;feedback.textContent=hint();state();
}
$('#avatar-form').addEventListener('submit',event=>{event.preventDefault();send(input.value);});
input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();send(input.value);}});
document.querySelectorAll('[data-question]').forEach(button=>button.addEventListener('click',()=>send(button.dataset.question)));
stop.addEventListener('click',stopEverything);
$('#avatar-clear').addEventListener('click',()=>{stopEverything();history=[];transcript.replaceChildren(intro.cloneNode(true));input.value='';input.focus();});
engineSelect.addEventListener('change',()=>{
  stopEverything();localChat?.destroy();localChat=null;available=false;mode=engineSelect.value;
  history=[];transcript.replaceChildren(intro.cloneNode(true));input.value='';checkService();
});
mic.addEventListener('click',async()=>{
  if(listening){speech.finishRecording();return;}
  if(!canRecord||!voiceReady||!available||busy)return;
  stopSpeech();const id=++operation;listening=true;voiceReplies=true;feedback.textContent='Listening for up to 15 seconds. Tap “Finish question” when done.';state();
  try{
    const blob=await speech.record();if(id!==operation)return;
    listening=false;if(!blob?.size){feedback.textContent='No audio captured. You can type instead.';state();return;}
    busy=true;feedback.textContent='Transcribing on your device…';state();
    const text=await speech.transcribe(blob);if(id!==operation)return;busy=false;state();
    if(!text){feedback.textContent='No question recognized. You can type instead.';return;}
    input.value=text.slice(0,1200);send(input.value);
  }catch(error){if(id!==operation)return;listening=false;busy=false;speech?.cancelRecording();feedback.textContent=error.name==='NotAllowedError'?'Microphone access was not allowed. You can type instead.':'Local recording could not finish. Please type your question.';state();}
});
async function loadScene(){
  if(sceneStarted)return;sceneStarted=true;
  const controller=new AbortController();sceneRequest=controller;
  try{const {mountAvatar}=await import('./avatar-scene.js?v=depth-sort-20261018-1');scene=await mountAvatar($('#avatar-canvas'),{signal:controller.signal});delete $('#avatar-canvas').dataset.failed;scene.setPaused(paused);state();}
  catch(error){if(controller.signal.aborted)return;$('#avatar-canvas').dataset.failed='true';console.warn('3D avatar unavailable; conversation and photo remain accessible.',error);document.querySelectorAll('.avatar-scene-controls button').forEach(button=>button.disabled=true);}
}
$('#avatar-turn-left').addEventListener('click',()=>scene?.rotate(-1));$('#avatar-turn-right').addEventListener('click',()=>scene?.rotate(1));
function motion(){scene?.setPaused(paused);$('#avatar-motion').setAttribute('aria-pressed',String(paused));$('#avatar-motion').setAttribute('aria-label',paused?'Resume avatar animation':'Pause avatar animation');$('#avatar-motion').textContent=paused?'▷':'Ⅱ';}
$('#avatar-motion').addEventListener('click',()=>{paused=!paused;motion();});reduced.addEventListener('change',event=>{paused=event.matches;motion();});motion();
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){loadScene();observer.disconnect();}},{rootMargin:'200px'});observer.observe(stage);}else loadScene();
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopEverything();});
window.addEventListener('pagehide',()=>{stopEverything();localChat?.destroy();localChat=null;available=false;speech?.destroy();speech=null;voiceReady=false;voiceReplies=false;sceneRequest?.abort();scene?.destroy();scene=null;sceneStarted=false;});
window.addEventListener('pageshow',event=>{if(event.persisted){loadScene();checkService();}});
async function checkService(){
  const id=++serviceCheck;checked=false;available=false;
  if(mode==='server'){
    feedback.textContent='Checking the preview server…';
    try{const response=await fetch('/api/avatar/status',{signal:AbortSignal.timeout(5000)});const online=response.ok&&(await response.json()).available===true;if(id!==serviceCheck||mode!=='server')return;available=online;}catch{}
  }
  if(id!==serviceCheck)return;checked=true;feedback.textContent=hint();state();
}
checkService();
