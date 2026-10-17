import { chapters } from './profile-data.js';
const $ = selector => document.querySelector(selector);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let sculpture;
let paused = reduced.matches;
let motionOverride = false;
function openProject(index) {
  const entry=chapters[index];
  if(!entry)return;
  $('#story-year').textContent=entry.year;
  $('#story-title').textContent=entry.company;
  $('#story-role').textContent=entry.role;
  $('#story-summary').textContent=entry.summary;
  $('#story-details').replaceChildren(...entry.details.map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));
  $('#story-skills').replaceChildren(...entry.skills.map(text=>{const span=document.createElement('span');span.textContent=text;return span;}));
  $('#story-outcome').textContent=entry.outcome;
  $('#story-links').replaceChildren(...entry.links.map(link=>{const a=document.createElement('a');a.textContent=link.label+' ↗';a.href=link.href;return a;}));
  if(!$('#story').open)$('#story').showModal();
  $('#story').scrollTop=0;
  sculpture?.setPaused(true);
}
document.querySelectorAll('[data-open]').forEach(button=>button.addEventListener('click',()=>openProject(Number(button.dataset.open))));
$('.close-story').addEventListener('click',()=>$('#story').close());
$('.story-done').addEventListener('click',()=>$('#story').close());
$('#story').addEventListener('close',()=>sculpture?.setPaused(paused));
$('#story').addEventListener('click',event=>{
  const rect=$('#story').getBoundingClientRect();
  if(event.target===$('#story')&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))$('#story').close();
});
function setMotion(){
  $('#motion').setAttribute('aria-pressed',String(paused));
  $('#motion').textContent=paused?'Resume motion ▷':'Pause motion Ⅱ';
  sculpture?.setPaused(paused || $('#story').open);
}
$('#motion').addEventListener('click',()=>{paused=!paused;motionOverride=true;sculpture?.setReducedMotion(false);setMotion();});
reduced.addEventListener('change',event=>{paused=event.matches;motionOverride=false;sculpture?.setReducedMotion(event.matches);setMotion();});
$('#year').textContent=new Date().getFullYear();
setMotion();
let sculptureStarted=false;
async function loadSculpture(){
  if(sculptureStarted)return;
  sculptureStarted=true;
  try{
    const {mountSculpture}=await import('./sculpture.js');
    sculpture=await mountSculpture($('#sculpture'),{reducedMotion:reduced.matches,interactive:false});
    sculpture.setReducedMotion(reduced.matches && !motionOverride);
    sculpture.setPaused(paused || $('#story').open);
    document.body.classList.add('sculpture-ready');
  }catch(error){
    console.warn('Decorative 3D unavailable; portfolio content remains accessible.',error);
    $('#motion').hidden=true;
  }
}
if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}}),{threshold:.06});
  document.querySelectorAll('.section-heading,.work-card,.project-list,.talk,.beyond-grid').forEach(el=>{el.classList.add('reveal');observer.observe(el);});
  const sculptureObserver=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){loadSculpture();sculptureObserver.disconnect();}},{rootMargin:'120px'});
  sculptureObserver.observe($('#sculpture'));
  document.body.classList.add('enhanced');
}else{loadSculpture();}
