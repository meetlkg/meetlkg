import { chapters } from './profile-data.js';
const $ = selector => document.querySelector(selector);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const key = 'gok03-premium-chapters-v1';
let discovered = new Set();
try {
  const stored = JSON.parse(localStorage.getItem(key) || '[]');
  if (Array.isArray(stored)) discovered = new Set(stored.filter(id => chapters.some(c => c.id === id)));
} catch { /* The portfolio also works without browser storage. */ }
let sculpture;
let paused = reduced.matches;
let toastTimer;
let pendingCompletion = false;
let motionOverride = false;
function showCompletion() {
  $('#toast').textContent = 'Five chapters connected. Thanks for exploring the story.';
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {$('#toast').hidden = true;},4500);
}
function renderProgress() {
  $('#discovery-count').textContent = `${discovered.size} of 5 chapters explored`;
  document.querySelectorAll('.discovery-dots i').forEach((dot,i) => dot.classList.toggle('discovered',discovered.has(chapters[i].id)));
  document.querySelectorAll('.chapter-points button').forEach((button,i) => button.classList.toggle('discovered',discovered.has(chapters[i].id)));
}
function discover(index) {
  const fresh = !discovered.has(chapters[index].id);
  discovered.add(chapters[index].id);
  try { localStorage.setItem(key,JSON.stringify([...discovered])); } catch { /* Keep session progress. */ }
  renderProgress();
  if (fresh && discovered.size === 5) {
    if ($('#story').open) pendingCompletion = true;
    else showCompletion();
  }
}
function openStory(index) {
  const chapter=chapters[index];
  if(!chapter)return;
  sculpture?.focus(index);
  $('#story-year').textContent = `${String(index+1).padStart(2,'0')} / ${chapter.company.toUpperCase()} / ${chapter.year}`;
  $('#story-title').textContent=chapter.title;
  $('#story-role').textContent=chapter.role;
  $('#story-summary').textContent=chapter.summary;
  $('#story-details').replaceChildren(...chapter.details.map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));
  $('#story-skills').replaceChildren(...chapter.skills.map(text=>{const span=document.createElement('span');span.textContent=text;return span;}));
  $('#story-outcome').textContent=chapter.outcome;
  $('#story-links').replaceChildren(...chapter.links.map(link=>{const a=document.createElement('a');a.textContent=link.label+' ↗';a.href=link.href;return a;}));
  if(!$('#story').open)$('#story').showModal();
  sculpture?.setPaused(true);
  $('#story').scrollTop=0;
  discover(index);
}
document.querySelectorAll('[data-open]').forEach(button=>button.addEventListener('click',()=>openStory(Number(button.dataset.open))));
document.querySelectorAll('[data-chapter]').forEach(detail=>detail.addEventListener('toggle',()=>{if(detail.open)discover(Number(detail.dataset.chapter));}));
$('.close-story').addEventListener('click',()=>$('#story').close());
$('.story-done').addEventListener('click',()=>$('#story').close());
$('#story').addEventListener('click',event=>{
  const rect=$('#story').getBoundingClientRect();
  if(event.target===$('#story')&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))$('#story').close();
});
$('#reset-progress').addEventListener('click',()=>{discovered.clear();pendingCompletion=false;clearTimeout(toastTimer);$('#toast').hidden=true;try{localStorage.removeItem(key);}catch{}renderProgress();});
$('#story').addEventListener('close',()=>{sculpture?.setPaused(paused);if(pendingCompletion){pendingCompletion=false;showCompletion();}});
function setMotion(){
  $('#motion').setAttribute('aria-pressed',String(paused));
  $('#motion').textContent=paused?'Resume motion ▷':'Pause motion Ⅱ';
  sculpture?.setPaused(paused);
}
$('#motion').addEventListener('click',()=>{paused=!paused;motionOverride=true;sculpture?.setReducedMotion(false);setMotion();});
reduced.addEventListener('change',event=>{paused=event.matches;motionOverride=false;sculpture?.setReducedMotion(event.matches);setMotion();});
$('#year').textContent=new Date().getFullYear();
renderProgress();setMotion();
if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}}),{threshold:.08});
  document.querySelectorAll('.section-heading,.case,.project-list,.talk').forEach(el=>{el.classList.add('reveal');observer.observe(el);});
  document.body.classList.add('enhanced');
}
import('./sculpture.js').then(async({mountSculpture})=>{
  sculpture=await mountSculpture($('#sculpture'),{reducedMotion:reduced.matches,onSelect:openStory});
  sculpture.setReducedMotion(reduced.matches && !motionOverride);
  sculpture.setPaused(paused || $('#story').open);
  document.body.classList.add('sculpture-ready');
}).catch(error=>{
  console.warn('Sculpture unavailable; all career chapters remain available.',error);
  $('#motion').hidden=true;
});
