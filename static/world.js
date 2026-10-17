import { chapters } from './profile-data.js';

const $ = (selector) => document.querySelector(selector);
const sceneRoot = $('#scene');
const chapterDialog = $('#chapter-dialog');
const completeDialog = $('#complete-dialog');
const mediaMotion = matchMedia('(prefers-reduced-motion: reduce)');
const storageKey = 'gok03-world-discoveries-v1';
let collected = new Set();
try {
  const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(stored)) collected = new Set(stored.filter(id => chapters.some(c => c.id === id)));
} catch { /* Exploration still works when browser storage is unavailable. */ }
let selected = null;
let worldAPI = null;
let paused = mediaMotion.matches;
let toastTimer;
const labels = [];
const slots = [];

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.hidden = true; }, 3500);
}

function updateCollection() {
  chapters.forEach((chapter, i) => {
    const found = collected.has(chapter.id);
    labels[i].classList.toggle('collected', found);
    slots[i].classList.toggle('collected', found);
    labels[i].querySelector('.label-number').textContent = found ? '✓' : String(i + 1).padStart(2, '0');
    slots[i].querySelector('b').textContent = found ? '✦' : '◇';
    slots[i].setAttribute('aria-label', `${chapter.skill}: ${found ? 'collected, revisit' : 'undiscovered, travel to'} ${chapter.company}`);
    labels[i].setAttribute('aria-label', `${found ? 'Revisit' : 'Explore'} ${chapter.title}, ${chapter.company}, ${chapter.year}`);
  });
  $('#progress-count').textContent = `${collected.size} / 5`;
  $('#progress-fill').style.width = `${collected.size * 20}%`;
  $('#quest-title').textContent = collected.size === 5 ? 'Every chapter connected. The story continues.' : 'Collect five chapters of intelligence.';
  $('#start').firstChild.textContent = collected.size === 5 ? 'Revisit the world ' : collected.size ? 'Continue exploring ' : 'Start exploring ';
}

function openChapter(index) {
  selected = index;
  const chapter = chapters[index];
  $('#chapter-number').textContent = String(index + 1).padStart(2, '0');
  $('#chapter-date').textContent = chapter.year;
  $('#chapter-heading').textContent = chapter.title;
  $('#chapter-role').textContent = `${chapter.company} / ${chapter.role}`;
  $('#chapter-summary').textContent = chapter.summary;
  $('#chapter-details').replaceChildren(...chapter.details.map(text => {
    const p = document.createElement('p'); p.textContent = text; return p;
  }));
  $('#chapter-skills').replaceChildren(...chapter.skills.map(text => {
    const span = document.createElement('span'); span.textContent = text; return span;
  }));
  $('#chapter-outcome').textContent = chapter.outcome;
  $('#chapter-links').replaceChildren(...chapter.links.map(link => {
    const a = document.createElement('a'); a.textContent = `${link.label} ↗`; a.href = link.href; return a;
  }));
  const found = collected.has(chapter.id);
  $('#collect').disabled = found;
  $('#collect').textContent = found ? `✓ ${chapter.skill} collected` : `Collect ${chapter.skill} ✧`;
  if (!chapterDialog.open) chapterDialog.showModal();
  worldAPI?.stopKeys();
}

function travel(index) {
  if (chapterDialog.open) chapterDialog.close();
  if (completeDialog.open) completeDialog.close();
  if (worldAPI) worldAPI.travel(index);
  else openChapter(index);
}

chapters.forEach((chapter, index) => {
  const label = document.createElement('button');
  label.className = 'island-label';
  label.style.setProperty('--color', chapter.color);
  const number = document.createElement('span'); number.className = 'label-number';
  const text = document.createElement('span'); text.className = 'label-text';
  const title = document.createElement('span'); title.textContent = chapter.skill;
  const company = document.createElement('small'); company.textContent = chapter.company.toUpperCase();
  text.append(title, company); label.append(number, text);
  label.addEventListener('click', () => travel(index));
  $('#landmark-labels').append(label); labels.push(label);
  const slot = document.createElement('button'); slot.className = 'slot';
  const symbol = document.createElement('b'); symbol.setAttribute('aria-hidden', 'true');
  const name = document.createElement('small'); name.textContent = ['EDGE ML','DEEP LEARNING','ML SYSTEMS','MULTI-AGENT','ARCHITECTURE'][index];
  slot.append(symbol, name); slot.addEventListener('click', () => travel(index));
  $('#inventory-slots').append(slot); slots.push(slot);
});
updateCollection();

$('#start').addEventListener('click', () => {
  const next = chapters.findIndex(c => !collected.has(c.id));
  travel(next < 0 ? 0 : next);
});
$('#collect').addEventListener('click', () => {
  if (selected === null) return;
  const chapter = chapters[selected];
  if (collected.has(chapter.id)) return;
  collected.add(chapter.id);
  try { localStorage.setItem(storageKey, JSON.stringify([...collected])); } catch { /* Session progress remains usable. */ }
  worldAPI?.setCollected(selected);
  updateCollection();
  chapterDialog.close();
  $('#arrival').hidden = true;
  if (collected.size === 5) {
    completeDialog.showModal();
    worldAPI?.celebrate();
  } else {
    const next = chapters.findIndex(c => !collected.has(c.id));
    $('#travel-hint').textContent = `Next discovery: ${chapters[next].title}. Choose its island.`;
    toast(`✦ ${chapter.skill} discovered · ${collected.size} of 5`);
  }
});
$('#reset-progress').addEventListener('click', () => {
  collected.clear();
  try { localStorage.removeItem(storageKey); } catch { /* No persistent storage to reset. */ }
  updateCollection();
  worldAPI?.reset();
  $('#travel-hint').textContent = 'A fresh journey. Choose an island to send your agent.';
  toast('Your journey has been reset.');
});
for (const dialog of [chapterDialog, completeDialog]) {
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
}
$('#continue-exploring').addEventListener('click', () => completeDialog.close());
function updateMotion() {
  $('#motion').setAttribute('aria-pressed', String(paused));
  $('#motion').innerHTML = `${paused ? '▶' : 'Ⅱ'} Motion ${paused ? 'off' : 'on'}`;
  worldAPI?.setPaused(paused);
}
$('#motion').addEventListener('click', () => { paused = !paused; updateMotion(); });
mediaMotion.addEventListener('change', event => { paused = event.matches; updateMotion(); });
$('#view-reset').addEventListener('click', () => { worldAPI?.recenter(); $('#travel-hint').textContent = 'Back at the hub. Where next?'; });
$('#year').textContent = new Date().getFullYear();
updateMotion();

async function initializeWorld() {
  const THREE = await import('./vendor/three.module.js');
  const { createWorld } = await import('./world-models.js');
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.55;
  renderer.shadowMap.enabled = false;
  sceneRoot.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#0d252e', 0.016);
  scene.add(new THREE.HemisphereLight('#d8f2f4', '#3d5266', 2.3));
  const sun = new THREE.DirectionalLight('#fff0d7', 3.2); sun.position.set(-8,18,12); scene.add(sun);
  const rim = new THREE.DirectionalLight('#85e6d2', 2.5); rim.position.set(9,7,-8); scene.add(rim);
  const camera = new THREE.OrthographicCamera(-20,20,12,-12,.1,150);
  const world = createWorld();
  scene.add(world.group);
  world.avatar.scale.setScalar(1.5);
  let active = -1;
  let target = null;
  let autoOpen = false;
  let lastTime = 0;
  let elapsed = 0;
  let ambientPaused = paused;
  let visible = true;
  let celebration = 0;
  let animationFrame;
  const keys = new Set();
  // Local starfield: deterministic, no textures or remote model requests.
  const stars = [];
  for (let i=0;i<100;i++) {
    stars.push(Math.sin(i*127.1)*28, -3+((i*17)%16), Math.cos(i*83.7)*24);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(stars,3));
  const starPoints = new THREE.Points(starGeo,new THREE.PointsMaterial({color:'#a5d7c0',size:.035,transparent:true,opacity:.4}));
  scene.add(starPoints);
  const halo = new THREE.Mesh(new THREE.RingGeometry(2.5,2.53,64),new THREE.MeshBasicMaterial({color:'#b6f78c',transparent:true,opacity:.6,side:THREE.DoubleSide}));
  halo.rotation.x=-Math.PI/2; halo.position.y=.08; halo.visible=false; scene.add(halo);
  const projection = new THREE.Vector3();
  let width=0,height=0;
  function resize() {
    width=sceneRoot.clientWidth; height=sceneRoot.clientHeight;
    renderer.setSize(width,height,false);
    const mobile=innerWidth<=800;
    const span=mobile ? 22 : 35;
    const aspect=width/Math.max(height,1);
    camera.left=-span/2; camera.right=span/2; camera.top=span/aspect/2; camera.bottom=-span/aspect/2;
    const look = mobile ? new THREE.Vector3(0,0,0) : new THREE.Vector3(-4.6,0,3.1);
    camera.position.copy(look).add(mobile ? new THREE.Vector3(17,34,28) : new THREE.Vector3(17,23,28));
    camera.lookAt(look);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    positionLabels();
    render();
  }
  function positionLabels() {
    world.stations.forEach((station,i) => {
      projection.copy(station.position).add(new THREE.Vector3(0,3.2,0)).project(camera);
      labels[i].style.left=`${(projection.x*.5+.5)*width+sceneRoot.offsetLeft}px`;
      labels[i].style.top=`${(-projection.y*.5+.5)*height+sceneRoot.offsetTop}px`;
      labels[i].style.visibility=projection.z>1 ? 'hidden' : 'visible';
    });
  }
  function render() { renderer.render(scene,camera); }
  function setActive(index,show=true) {
    active=index;
    $('#arrival').hidden=index<0 || !show;
    if(index>=0) $('#arrival-title').textContent=`${chapters[index].company} / ${chapters[index].year}`;
  }
  function recenter() {
    keys.clear();target=null;autoOpen=false;world.avatar.position.set(0,.4,0);setActive(-1);render();
  }
  function setCollected(index) { world.setCollected(index);render(); }
  function travelTo(index) {
    keys.clear();
    $('#world').scrollIntoView({behavior:mediaMotion.matches?'instant':'smooth',block:'start'});
    setActive(-1);
    const station=world.stations[index];
    target=station.position.clone().add(new THREE.Vector3(0,.4,1.4));
    autoOpen=true;
    $('#travel-hint').textContent=`Your agent is heading to ${chapters[index].title}…`;
    target.chapter=index;
    if (ambientPaused || mediaMotion.matches) {
      world.avatar.position.copy(target);
      target=null;autoOpen=false;setActive(index);openChapter(index);
      $('#travel-hint').textContent=`Arrived at ${chapters[index].title}.`;
      render();
    }
  }
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerup', event => {
    if (chapterDialog.open || completeDialog.open) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    let closest = null;
    world.stations.forEach((station, index) => {
      const hit = raycaster.intersectObject(station.group, true)[0];
      if (hit && (!closest || hit.distance < closest.distance)) closest = { index, distance: hit.distance };
    });
    if (closest) travelTo(closest.index);
  });
  const keyboardButton = $('#keyboard-play');
  let keyboardEnabled = false;
  function setKeyboard(enabled) {
    keyboardEnabled = enabled;
    keys.clear();
    keyboardButton.setAttribute('aria-pressed', String(enabled));
    keyboardButton.textContent = enabled ? 'Keyboard on · Esc exits' : 'Enable keyboard';
  }
  keyboardButton.addEventListener('click', () => {
    setKeyboard(!keyboardEnabled);
    if (keyboardEnabled) {
      keyboardButton.focus();
      $('#world').scrollIntoView({behavior:'instant',block:'start'});
      $('#travel-hint').textContent = 'WASD / arrows to move. E to discover. Escape or Tab to exit.';
    }
  });
  keyboardButton.addEventListener('blur', () => setKeyboard(false));
  const keyMap = {ArrowUp:'w',ArrowDown:'s',ArrowLeft:'a',ArrowRight:'d'};
  const keydown=event=>{
    if(!worldAPI || !keyboardEnabled || document.activeElement !== keyboardButton || chapterDialog.open || completeDialog.open || event.ctrlKey || event.metaKey || event.altKey) return;
    if(event.key === 'Escape') { setKeyboard(false); return; }
    const key=keyMap[event.key]||event.key.toLowerCase();
    if(['w','a','s','d','e'].includes(key)){
      event.preventDefault();
      if(key==='e'&&active>=0){openChapter(active);return;}
      if(key!=='e'){target=null;autoOpen=false;keys.add(key);}
    }
  };
  addEventListener('keydown',keydown);
  addEventListener('keyup',e=>keys.delete(keyMap[e.key]||e.key.toLowerCase()));
  addEventListener('blur',()=>keys.clear());
  $('#discover').addEventListener('click',()=>{if(active>=0)openChapter(active);});
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',()=>keys.clear()));
  const right=new THREE.Vector3(.855,0,-.519);
  const forward=new THREE.Vector3(-.519,0,-.855);
  const movement=new THREE.Vector3();
  function frame(time) {
    animationFrame=requestAnimationFrame(frame);
    const dt=Math.min((time-lastTime)/1000,.04);lastTime=time;
    if(!visible||document.hidden)return;
    const moving=target||keys.size;
    if(!ambientPaused)elapsed+=dt;
    world.animate(elapsed,ambientPaused);
    let changed=false;
    if(target){
      movement.copy(target).sub(world.avatar.position);movement.y=0;
      if(movement.length()<.1){
        const index=target.chapter;world.avatar.position.copy(target);target=null;setActive(index);
        $('#travel-hint').textContent=`Arrived at ${chapters[index].title}.`;
        if(autoOpen){autoOpen=false;openChapter(index);}
      }else{
        const step=Math.min(dt*7,movement.length());movement.normalize();
        world.avatar.position.addScaledVector(movement,step);
        world.avatar.rotation.y=Math.atan2(movement.x,movement.z);
        world.avatar.position.y=.4+(ambientPaused?0:Math.sin(elapsed*10)*.07);changed=true;
      }
    }else if(keys.size&&!chapterDialog.open&&!completeDialog.open){
      movement.set(0,0,0);
      if(keys.has('w'))movement.add(forward);if(keys.has('s'))movement.sub(forward);
      if(keys.has('d'))movement.add(right);if(keys.has('a'))movement.sub(right);
      if(movement.lengthSq()){
        movement.normalize();world.avatar.position.addScaledVector(movement,dt*5);
        world.avatar.position.x=THREE.MathUtils.clamp(world.avatar.position.x,-11,11);
        world.avatar.position.z=THREE.MathUtils.clamp(world.avatar.position.z,-8,9);
        world.avatar.rotation.y=Math.atan2(movement.x,movement.z);
        let near=-1;
        world.stations.forEach((station,i)=>{if(Math.hypot(station.position.x-world.avatar.position.x,station.position.z-world.avatar.position.z)<2.3)near=i;});
        if(near!==active)setActive(near);
        changed=true;
      }
    }
    if(celebration>0){
      celebration-=dt;halo.visible=true;halo.scale.setScalar(1+(3-celebration)*2);halo.material.opacity=Math.max(0,celebration/3*.7);
    }else halo.visible=false;
    if(!ambientPaused||changed||moving||celebration>0)render();
  }
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;keys.clear();},{threshold:0});
  observer.observe(sceneRoot);
  new ResizeObserver(resize).observe(sceneRoot);
  renderer.domElement.addEventListener('webglcontextlost',event=>{
    event.preventDefault();
    cancelAnimationFrame(animationFrame);setKeyboard(false);keyboardButton.disabled=true;document.body.classList.add('world-load-error');
    $('#travel-hint').textContent='3D rendering paused. Choose a chapter to keep exploring.';
    worldAPI=null;
  });
  collected.forEach(id=>{const i=chapters.findIndex(c=>c.id===id);if(i>=0)setCollected(i);});
  worldAPI={
    travel:travelTo,setCollected,recenter,stopKeys:()=>keys.clear(),
    setPaused(value){ambientPaused=value;world.animate(elapsed,value);render();},
    celebrate(){if(!ambientPaused){celebration=3;halo.position.copy(world.avatar.position);halo.position.y=.08;}},
    reset(){
      // Rebuild only the procedural scene to restore every collectible marker.
      scene.remove(world.group);
      world.group.traverse(object=>{object.geometry?.dispose();});
      sceneRoot.replaceChildren();
      renderer.dispose();cancelAnimationFrame(animationFrame);observer.disconnect();
      location.reload();
    }
  };
  resize();requestAnimationFrame(frame);
  document.body.classList.add('world-ready');
}
initializeWorld().catch(error=>{
  console.warn('3D exploration unavailable; chapter navigation remains active.',error);
  document.body.classList.add('world-load-error');
  $('#travel-hint').textContent='Choose a chapter to explore. Your full profile is below.';
  $('#view-reset').disabled=true;
  $('#keyboard-play').disabled=true;
  labels.forEach(label=>{label.style.visibility='visible';});
});
