const tabs=[...document.querySelectorAll('[role="tab"]')];
function selectTab(tab,{focus=false}={}){
 for(const item of tabs){const selected=item===tab;item.setAttribute('aria-selected',String(selected));item.tabIndex=selected?0:-1;document.getElementById(item.getAttribute('aria-controls')).hidden=!selected}
 if(focus)tab.focus();
}
for(const tab of tabs){
 tab.addEventListener('click',()=>selectTab(tab));
 tab.addEventListener('keydown',event=>{
  const index=tabs.indexOf(tab);let next;
  if(event.key==='ArrowRight')next=(index+1)%tabs.length;
  if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;
  if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;
  if(next!==undefined){event.preventDefault();selectTab(tabs[next],{focus:true})}
 });
}
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
if(!reduced.matches&&'IntersectionObserver' in window){
 const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('revealed-content');observer.unobserve(entry.target)}},{threshold:.08});
 for(const node of document.querySelectorAll('.case,.journey,.project-list,.personal')){node.classList.add('reveal');observer.observe(node)}
 document.documentElement.classList.add('motion-enabled');
}
const container=document.querySelector('#expert-avatar'),status=document.querySelector('#portrait-caption'),pauseButton=document.querySelector('#expert-pause'),resetButton=document.querySelector('#expert-reset');
let avatar,paused=reduced.matches,controller=new AbortController();
function motion(){avatar?.setPaused(paused);pauseButton.setAttribute('aria-pressed',String(paused));pauseButton.setAttribute('aria-label',paused?'Resume portrait animation':'Pause portrait animation');pauseButton.title=paused?'Resume animation':'Pause animation';pauseButton.textContent=paused?'▷':'Ⅱ';status.textContent=paused?'A digital introduction.':'Move your cursor. I’ll follow your lead.'}
pauseButton.addEventListener('click',()=>{paused=!paused;motion()});resetButton.addEventListener('click',()=>avatar?.reset());reduced.addEventListener('change',event=>{paused=event.matches;motion()});
async function startPortrait(){
 try{const {mountAvatar}=await import('./avatar-scene.js?v=depth-sort-20261018-1');avatar=await mountAvatar(container,{signal:controller.signal});motion()}
 catch(error){if(controller.signal.aborted)return;console.warn('Digital portrait unavailable:',error);status.textContent='A digital introduction.';pauseButton.disabled=resetButton.disabled=true}
}
startPortrait();
window.addEventListener('pagehide',()=>{controller.abort();avatar?.destroy();avatar=null});
window.addEventListener('pageshow',event=>{if(event.persisted){controller=new AbortController();startPortrait()}});
