const loader=document.querySelector('#portfolio-loading');
const status=loader.querySelector('[role="status"]');
const progress=loader.querySelector('progress');
const skip=loader.querySelector('button');
const complete=new Set();
let dismissed=false;
const steps=['stories','illustrations','portrait'];
const labels={stories:'Gathering a few stories…',illustrations:'Adding a little personality…',portrait:'Getting my 3D self ready…'};
function dismiss(){
 if(dismissed)return;dismissed=true;
 loader.close();loader.hidden=true;document.body.classList.remove('portfolio-loading');
 clearTimeout(escapeTimer);observer.disconnect();
 if(loader.contains(document.activeElement))document.querySelector('.wordmark').focus({preventScroll:true});
}
function done(step){
 complete.add(step);progress.value=complete.size;
 loader.querySelector(`[data-load-step="${step}"]`).dataset.loaded='true';
 const next=steps.find(item=>!complete.has(item));
 if(next)status.textContent=labels[next];
 else {status.textContent='Welcome to my world.';requestAnimationFrame(()=>requestAnimationFrame(dismiss));}
}
skip.addEventListener('click',dismiss);
loader.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
const escapeTimer=setTimeout(()=>{skip.hidden=false;status.textContent='Taking a little longer. You can explore while I get ready.';},8000);
const portrait=document.querySelector('#avatar-canvas');
const check=()=>{
 if(document.body.dataset.contentReady==='true')done('stories');
 if(portrait.dataset.ready==='true'||portrait.dataset.failed==='true')done('portrait');
};
const observer=new MutationObserver(check);
observer.observe(portrait,{attributes:true,attributeFilter:['data-ready','data-failed']});
observer.observe(document.body,{attributes:true,attributeFilter:['data-content-ready']});
const imageReady=image=>image.complete?Promise.resolve():new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});});
// Wait for the visible page assets, including external SVG symbols and fonts.
// Reply recordings and the on-demand chat encoder are intentionally lazy.
const pageReady=document.readyState==='complete'?Promise.resolve():new Promise(resolve=>window.addEventListener('load',resolve,{once:true}));
Promise.allSettled([pageReady,document.fonts.ready,...[...document.images].filter(image=>image.loading!=='lazy').map(imageReady)]).then(()=>done('illustrations'));
check();
