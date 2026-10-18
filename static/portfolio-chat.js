import {chapters,projects,profile} from './profile-data.js';
import {buildKnowledge,chooseAnswer} from './profile-knowledge.js?v=conversation-20261018-5';
import {ProfileSemantic} from './profile-semantic.js';
import {ProfileVoice} from './profile-voice.js?v=audio-only-20261018-1';
import {lazyVisible} from './lazy-visible.js';

const $=selector=>document.querySelector(selector);
const cards=buildKnowledge({chapters,projects,profile});
const chat=new ProfileSemantic(cards),voice=new ProfileVoice();
const transcript=$('#avatar-transcript'),input=$('#avatar-question'),sound=$('#avatar-sound'),stop=$('#avatar-stop'),stage=$('.avatar-stage');
const intro=transcript.firstElementChild.cloneNode(true),reduced=matchMedia('(prefers-reduced-motion: reduce)');
let scene,scenePromise,sceneController,cancelSceneLoad,busy=false,speaking=false,preparingVoice=false,voiceOn=false,operation=0,request,pending,previousId='';
function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS(svg.namespaceURI,'use');svg.setAttribute('viewBox','0 0 24 24');svg.classList.add('ui-icon');svg.setAttribute('aria-hidden','true');use.setAttribute('href',`static/world-icons.svg#${name}`);svg.append(use);return svg;}
function feedback(message=''){$('#avatar-feedback').textContent=message;$('#avatar-feedback').hidden=!message;}
function state(){
 const value=busy?'thinking':preparingVoice?'preparing':speaking?'speaking':'idle';
 stage.dataset.state=value;scene?.setState(busy?'thinking':'idle');
 $('#avatar-state').textContent=busy?'Thinking…':preparingVoice?'One moment…':speaking?'Playing audio…':'';
 $('#avatar-send').disabled=busy;
 document.querySelectorAll('[data-question]').forEach(button=>button.disabled=busy);
 stop.hidden=!(busy||speaking||preparingVoice);
 sound.setAttribute('aria-pressed',String(voiceOn));sound.setAttribute('aria-label',voiceOn?'Mute spoken replies':'Enable spoken replies');
 sound.querySelector('use').setAttribute('href',`static/world-icons.svg#${voiceOn?'sound':'sound-off'}`);
 sound.querySelector('span').textContent=voiceOn?'Voice on':'Voice off';
 transcript.querySelectorAll('.reply-speak').forEach(button=>{button.disabled=!voiceOn;button.title=voiceOn?'Read reply aloud':'Turn on voice to listen';});
 transcript.setAttribute('aria-busy',String(busy));
 $('#chat-diagnostics').textContent=JSON.stringify({model:'MiniLM-L3-v2 · profile retrieval',ready:chat.ready,voice:voice.name,voiceMode:'prerecorded neural audio',state:value,muted:!voiceOn,avatarSpeechAnimation:false});
}
function prepare(){chat.prepare().then(state).catch(error=>{console.warn('Semantic matching unavailable; using profile keywords.',error);});if(voiceOn)voice.prepare().catch(()=>{});}
async function speak(text){
 if(!voiceOn||document.hidden)return;
 const id=operation;
 try{
  await voice.say(text,value=>{if(id!==operation)return;speaking=value==='speaking';preparingVoice=value==='preparing';state();});
 }catch(error){if(id===operation)feedback(error.message);}
 finally{if(id===operation){speaking=false;preparingVoice=false;state();}}
}
function stopEverything(){
 ++operation;request?.abort();request=null;voice.stop();busy=false;speaking=false;preparingVoice=false;
 pending?.remove();pending=null;feedback();state();
}
function addMessage(role,text,result){
 const article=document.createElement('article');article.className=`avatar-message ${role}`;
 const author=document.createElement('span');author.className='message-author';author.textContent=role==='user'?'YOU':'Gokul’s AI';
 const p=document.createElement('p');p.textContent=text;article.append(author,p);
 if(result){
  const actions=document.createElement('div');actions.className='reply-actions';
  const replay=document.createElement('button');replay.className='reply-speak';replay.setAttribute('aria-label','Read reply aloud');replay.title=voiceOn?'Read reply aloud':'Turn on voice to listen';replay.disabled=!voiceOn;replay.append(icon('sound'));
  replay.addEventListener('click',()=>{if(!voiceOn)return;stopEverything();speak(text);});actions.append(replay);
  if(result.link){const link=document.createElement('a');link.href=result.link.href;link.textContent=result.link.label;link.append(icon('arrow-up-right'));if(result.link.href==='#contact-card')link.addEventListener('click',event=>{event.preventDefault();document.dispatchEvent(new CustomEvent('portfolio:contact'));});actions.append(link);}
  article.append(actions);
 }
 transcript.append(article);transcript.scrollTop=transcript.scrollHeight;return article;
}
async function send(text){
 text=text.trim();if(!text||busy)return;
 if(text.length>1200){feedback('Try a slightly shorter question.');return;}
 stopEverything();if(voiceOn)voice.prime().catch(()=>{});const id=++operation;busy=true;request=new AbortController();
 addMessage('user',text);pending=addMessage('assistant','…');pending.classList.add('pending');input.value='';state();

 try{
  let ranking=[];
  try{ranking=await chat.rank(text,request.signal);}catch(error){if(error.name==='AbortError')throw error;}
  if(id!==operation)return;
  const result=chooseAnswer(cards,text,ranking,previousId),answer=result.answer;previousId=result.id;
  pending.remove();pending=null;addMessage('assistant',answer,result);busy=false;state();if(result.openContact)document.dispatchEvent(new CustomEvent('portfolio:contact',{detail:{unresolved:result.id==='unknown'}}));else speak(answer);
 }catch(error){if(id!==operation)return;console.warn('Profile reply failed.',error);pending?.remove();pending=null;input.value=text;feedback('The browser couldn’t finish that reply. Please try again.');}
 finally{if(id===operation){request=null;busy=false;state();}}
}
$('#avatar-form').addEventListener('submit',event=>{event.preventDefault();send(input.value);});
input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();send(input.value);}});
document.querySelectorAll('[data-question]').forEach(button=>button.addEventListener('click',()=>send(button.dataset.question)));
stop.addEventListener('click',stopEverything);
$('#avatar-clear').addEventListener('click',()=>{stopEverything();previousId='';transcript.replaceChildren(intro.cloneNode(true));input.value='';input.focus();});
sound.addEventListener('click',()=>{voiceOn=!voiceOn;if(!voiceOn){voice.stop();speaking=false;preparingVoice=false;}feedback();state();});
document.addEventListener('portfolio:chat-open',prepare);
document.addEventListener('portfolio:chat-close',stopEverything);
async function loadScene(){
 if(scenePromise)return scenePromise;
 sceneController=new AbortController();const controller=sceneController;
 scenePromise=(async()=>{
  try{const {mountAvatar}=await import('./avatar-scene.js?v=speech-20261018-7b');if(controller.signal.aborted)return;scene=await mountAvatar($('#avatar-canvas'),{signal:controller.signal,allowManualTurn:false});scene.setPaused(reduced.matches);state();}
  catch(error){if(controller.signal.aborted)return;$('#avatar-canvas').dataset.failed='true';console.warn('Portrait unavailable.',error);}
 })();return scenePromise;
}
reduced.addEventListener('change',event=>scene?.setPaused(event.matches));
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopEverything();});
function scheduleScene(){cancelSceneLoad?.();cancelSceneLoad=lazyVisible($('#avatar-canvas'),loadScene);}
window.addEventListener('pagehide',()=>{cancelSceneLoad?.();stopEverything();chat.destroy();voice.destroy();sceneController?.abort();scene?.destroy();scene=null;scenePromise=null;const portrait=$('#avatar-canvas');portrait.classList.remove('avatar-rendered');delete portrait.dataset.ready;delete portrait.dataset.failed;});
window.addEventListener('pageshow',event=>{if(event.persisted){scheduleScene();if(!$('#avatar-chat-panel').hidden)prepare();}});
state();scheduleScene();if(!$('#avatar-chat-panel').hidden)prepare();
