const $ = selector => document.querySelector(selector);
const transcript = $('#avatar-transcript');
const input = $('#avatar-question');
const stage = $('.avatar-stage');
const feedback = $('#avatar-feedback');
const mic = $('#avatar-mic');
const sound = $('#avatar-sound');
const stop = $('#avatar-stop');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const canSpeak = 'speechSynthesis' in window;
const canListen = Boolean(Recognition && window.isSecureContext);
const intro = transcript.firstElementChild.cloneNode(true);
let scene, sceneStarted=false, paused=reduced.matches, available=false, checked=false;
let history=[], busy=false, listening=false, speaking=false, voiceReplies=false;
let request, recognition, pending, operation=0, utterance, speechTimer, listenTimer;

function state() {
  const value=listening?'listening':busy?'thinking':speaking?'speaking':'idle';
  stage.dataset.state=value;
  $('#avatar-state').textContent={listening:'Listening…',thinking:'Thinking…',speaking:'Speaking',idle:checked?(available?'Ready when you are':'Conversation offline'):'Getting ready'}[value];
  scene?.setState(value);
  $('#avatar-send').disabled=busy||listening||!available;
  document.querySelectorAll('[data-question]').forEach(button=>button.disabled=busy||listening||!available);
  mic.disabled=!canListen||!available||busy;
  mic.setAttribute('aria-pressed',String(listening));
  mic.querySelector('span').textContent=listening?'Finish speaking':'Talk to me';
  stop.hidden=!(busy||listening||speaking);
  transcript.setAttribute('aria-busy',String(busy));
}
function message(role,text,extra='') {
  const article=document.createElement('article');article.className=`avatar-message ${role} ${extra}`;
  const author=document.createElement('span');author.className='message-author';author.textContent=role==='user'?'YOU':'GOKUL’S AI AVATAR';
  const p=document.createElement('p');p.textContent=text;article.append(author,p);transcript.append(article);
  transcript.scrollTop=transcript.scrollHeight;return article;
}
function stopSpeech() {
  clearTimeout(speechTimer);
  if(utterance){utterance.onend=null;utterance.onerror=null;utterance.onstart=null;}
  if(canSpeak) speechSynthesis.cancel();
  utterance=null;speaking=false;
}
function speak(text) {
  if(!voiceReplies||!canSpeak||document.hidden)return;
  stopSpeech();
  utterance=new SpeechSynthesisUtterance(text);utterance.lang='en-IN';utterance.rate=.97;
  const voices=speechSynthesis.getVoices();
  const voice=voices.find(v=>v.lang==='en-IN')||voices.find(v=>v.lang.startsWith('en')&&v.localService)||voices.find(v=>v.lang.startsWith('en'));
  if(voice)utterance.voice=voice;
  const finish=()=>{clearTimeout(speechTimer);speaking=false;utterance=null;state();};
  utterance.onstart=()=>{speaking=true;state();};utterance.onend=finish;
  utterance.onerror=()=>{feedback.textContent='Your browser couldn’t play audio. The written reply is above.';finish();};
  speechSynthesis.speak(utterance);
  speechTimer=setTimeout(()=>{stopSpeech();state();},90000);
}
function voiceHint() {
  if(!available)return 'The avatar is here; conversation is currently offline. You can reach me by email.';
  if(!window.isSecureContext)return 'Type a question here. Microphone input needs HTTPS or localhost.';
  if(!Recognition)return 'Text chat is ready. Voice input is unavailable in this browser; try Chrome or Safari.';
  return 'Type a question, or tap “Talk to me” and allow microphone access.';
}
function updateSound(){sound.textContent=voiceReplies?'Voice replies on':'Voice replies off';sound.setAttribute('aria-pressed',String(voiceReplies));}
async function send(text) {
  text=text.trim();if(!text||busy||!available||listening)return;
  if(text.length>1200){feedback.textContent='Please keep your question under 1,200 characters.';return;}
  stopSpeech();busy=true;const id=++operation;
  message('user',text);pending=message('assistant','Thinking about that…','pending');input.value='';
  feedback.textContent='Finding the details in my profile…';state();
  request=new AbortController();const timeout=setTimeout(()=>request?.abort(),95000);
  try{
    const turns=[...history.slice(-4),{role:'user',content:text}];
    const response=await fetch('/api/avatar/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:turns}),signal:request.signal});
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'My conversation service is unavailable. Please try again later.');}
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',answer='',completed=false;
    while(true){
      const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});
      const lines=buffer.split('\n');buffer=lines.pop();
      for(const line of lines){
        if(!line.trim())continue;const event=JSON.parse(line);
        if(event.error)throw new Error(event.error);
        if(id!==operation){await reader.cancel();return;}
        if(typeof event.delta==='string'){
          answer+=event.delta;pending.classList.remove('pending');pending.querySelector('p').textContent=answer;
          transcript.scrollTop=transcript.scrollHeight;feedback.textContent='Writing my reply…';
        }
        if(typeof event.answer==='string'){answer=event.answer;completed=true;}
      }
      if(done)break;
    }
    if(!completed)throw new Error('That reply was interrupted. Please try again.');
    const data={answer};
    if(typeof data.answer!=='string'||!data.answer.trim())throw new Error('I couldn’t finish that reply. Please try again.');
    if(id!==operation)return;
    pending.classList.remove('pending');pending.querySelector('p').textContent=data.answer;pending=null;
    history.push({role:'user',content:text},{role:'assistant',content:data.answer});history=history.slice(-4);
    transcript.scrollTop=transcript.scrollHeight;feedback.textContent=voiceHint();
    busy=false;state();speak(data.answer);
  }catch(error){
    if(id!==operation)return;
    pending.classList.remove('pending');pending.classList.add('error');pending.querySelector('p').textContent=error.name==='AbortError'?'That took too long. Please try again.':error.message;pending=null;
    input.value=text;feedback.textContent='Your question is ready to retry.';
  }finally{
    clearTimeout(timeout);if(id===operation){request?.abort();request=null;busy=false;state();}
  }
}
function stopEverything() {
  ++operation;request?.abort();request=null;busy=false;
  if(pending){pending.remove();pending=null;}
  clearTimeout(listenTimer);
  if(recognition){recognition.onresult=null;recognition.onend=null;recognition.onerror=null;recognition.abort();recognition=null;}
  listening=false;stopSpeech();feedback.textContent=voiceHint();state();
}
$('#avatar-form').addEventListener('submit',event=>{event.preventDefault();send(input.value);});
input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();send(input.value);}});
document.querySelectorAll('[data-question]').forEach(button=>button.addEventListener('click',()=>send(button.dataset.question)));
stop.addEventListener('click',stopEverything);
$('#avatar-clear').addEventListener('click',()=>{stopEverything();history=[];transcript.replaceChildren(intro.cloneNode(true));input.value='';input.focus();});
sound.disabled=!canSpeak;
sound.addEventListener('click',()=>{voiceReplies=!voiceReplies;if(!voiceReplies){stopSpeech();state();}updateSound();});
mic.addEventListener('click',()=>{
  if(listening){recognition?.stop();return;}
  if(!canListen||busy||!available)return;
  stopSpeech();voiceReplies=canSpeak;updateSound();
  const id=++operation;let finalText='',failed=false;
  recognition=new Recognition();recognition.lang='en-IN';recognition.interimResults=true;recognition.continuous=false;
  listening=true;feedback.textContent='Listening. Speak your question, then pause.';state();
  recognition.onresult=event=>{
    let interim='';
    for(let i=event.resultIndex;i<event.results.length;i++){
      if(event.results[i].isFinal)finalText+=event.results[i][0].transcript+' ';
      else interim+=event.results[i][0].transcript;
    }
    input.value=(finalText+interim).trim().slice(0,1200);
  };
  recognition.onerror=event=>{
    failed=true;
    feedback.textContent=event.error==='not-allowed'?'Microphone access wasn’t allowed. You can type instead.':event.error==='no-speech'?'I didn’t hear a question. Tap “Talk to me” to try again.':'Voice input couldn’t connect. Please type your question instead.';
  };
  recognition.onend=()=>{
    clearTimeout(listenTimer);if(id!==operation)return;
    listening=false;recognition=null;state();
    if(!failed&&finalText.trim())send(finalText.trim());
    else if(!failed)feedback.textContent='No question captured. You can type instead.';
  };
  try{recognition.start();listenTimer=setTimeout(()=>recognition?.stop(),25000);}
  catch{listening=false;recognition=null;feedback.textContent='Voice input couldn’t start. Please type instead.';state();}
});

async function loadScene(){
  if(sceneStarted)return;sceneStarted=true;
  try{const {mountAvatar}=await import('./avatar-scene.js');scene=mountAvatar($('#avatar-canvas'));scene.setPaused(paused);state();}
  catch(error){console.warn('3D avatar unavailable; conversation and photo remain accessible.',error);document.querySelectorAll('.avatar-scene-controls button').forEach(button=>button.disabled=true);}
}
$('#avatar-turn-left').addEventListener('click',()=>scene?.rotate(-1));
$('#avatar-turn-right').addEventListener('click',()=>scene?.rotate(1));
function motion(){scene?.setPaused(paused);$('#avatar-motion').setAttribute('aria-pressed',String(paused));$('#avatar-motion').setAttribute('aria-label',paused?'Resume avatar animation':'Pause avatar animation');$('#avatar-motion').textContent=paused?'▷':'Ⅱ';}
$('#avatar-motion').addEventListener('click',()=>{paused=!paused;motion();});
reduced.addEventListener('change',event=>{paused=event.matches;motion();});motion();
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){loadScene();observer.disconnect();}},{rootMargin:'200px'});observer.observe(stage);}else loadScene();
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopEverything();});
window.addEventListener('pagehide',()=>{stopEverything();scene?.destroy();scene=null;sceneStarted=false;});
window.addEventListener('pageshow',event=>{if(event.persisted){loadScene();checkService();}});
async function checkService(){
  try{const response=await fetch('/api/avatar/status',{signal:AbortSignal.timeout(5000)});available=response.ok&&(await response.json()).available===true;}
  catch{available=false;}
  checked=true;feedback.textContent=voiceHint();state();
}
checkService();
