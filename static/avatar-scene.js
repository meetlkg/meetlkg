// A real, locally rendered 3D bust. Its geometry is a stylized interpretation
// of the owner's existing outdoor photo, not a facial scan or photoreal model.
import * as THREE from './vendor/three.module.js';

export function mountAvatar(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 40);
  camera.position.set(0, 1.45, 6.8);
  camera.lookAt(0, 1.25, 0);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.classList.add('avatar-rendered');
  scene.add(new THREE.HemisphereLight(0xfff9e9, 0x718472, 2.5));
  const key = new THREE.DirectionalLight(0xffefda, 4.5);
  key.position.set(-3, 5, 5); scene.add(key);
  const fill = new THREE.DirectionalLight(0xd6e6ff, 2);
  fill.position.set(4, 2, 2); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 3);
  rim.position.set(1, 4, -3); scene.add(rim);

  const skin = new THREE.MeshStandardMaterial({ color: '#a86f4b', roughness: .6 });
  const innerSkin = new THREE.MeshStandardMaterial({ color: '#875034', roughness: .8 });
  const hair = new THREE.MeshStandardMaterial({ color: '#171b1b', roughness: .88 });
  const beard = new THREE.MeshStandardMaterial({ color: '#26231f', roughness: .95 });
  const shirt = new THREE.MeshStandardMaterial({ color: '#515b59', roughness: .88 });
  const collar = new THREE.MeshStandardMaterial({ color: '#343d3b', roughness: .9 });
  const black = new THREE.MeshStandardMaterial({ color: '#151e22', roughness: .3 });
  const lens = new THREE.MeshPhysicalMaterial({ color: '#152a32', metalness: .3, roughness: .13, clearcoat: 1 });
  const mouthMaterial = new THREE.MeshStandardMaterial({ color: '#3a201a', roughness: .9 });
  const lip = new THREE.MeshStandardMaterial({ color: '#845039', roughness: .8 });
  const figure = new THREE.Group(); scene.add(figure);
  function ellipsoid(parent, material, position, scale, segments = 40) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, 28), material);
    mesh.position.set(...position); mesh.scale.set(...scale); parent.add(mesh); return mesh;
  }
  function tube(parent, material, points, radius) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, radius, 8, false), material);
    parent.add(mesh); return mesh;
  }
  // Rounded shoulders, a soft cotton T-shirt and an inset crew-neck seam.
  const torso = new THREE.Group(); figure.add(torso);
  ellipsoid(torso, shirt, [0, -.02, -.02], [1.18, .84, .55]);
  for (const sign of [-1, 1]) {
    const sleeve = ellipsoid(torso, shirt, [sign * .99, -.1, -.02], [.37, .56, .44]);
    sleeve.rotation.z = sign * .28;
    const arm = ellipsoid(torso, skin, [sign * 1.14, -.54, -.02], [.23, .4, .31]);
    arm.rotation.z = sign * .12;
  }
  ellipsoid(torso, collar, [0, .61, .08], [.43, .15, .34]);
  ellipsoid(torso, skin, [0, .81, .015], [.3, .48, .29]);
  tube(torso, collar, [[-.36,.57,.3],[0,.47,.5],[.36,.57,.3]], .022);
  tube(torso, collar, [[-.85,.34,.37],[-.7,.25,.44],[-.64,.09,.47]], .009);
  tube(torso, collar, [[.85,.34,.37],[.7,.25,.44],[.64,.09,.47]], .009);
  const head = new THREE.Group(); head.position.set(0, 1.64, 0); figure.add(head);
  const face = ellipsoid(head, skin, [0, 0, 0], [.66, .88, .59], 64);
  // Narrow the lower face slightly to avoid a spherical silhouette.
  const positions = face.geometry.attributes.position;
  for (let i=0;i<positions.count;i++) {
    const y = positions.getY(i);
    if (y < -.1) positions.setX(i, positions.getX(i) * (1 + (y + .1) * .14));
  }
  face.geometry.computeVertexNormals();
  for (const sign of [-1, 1]) {
    ellipsoid(head, skin, [sign * .65, -.025, -.025], [.14, .23, .13]);
    ellipsoid(head, innerSkin, [sign * .709, -.025, .055], [.055, .13, .04]);
    ellipsoid(head, skin, [sign * .71, -.09, .075], [.04, .07, .03]);
  }
  // Short dark hair with a swept top, and individually modelled soft clumps.
  const scalp = new THREE.Mesh(new THREE.SphereGeometry(1, 56, 24, 0, Math.PI*2, 0, 1.32), hair);
  scalp.scale.set(.68,.91,.61); scalp.rotation.z = -.07; head.add(scalp);
  let seed = 19;
  const random = () => { seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };
  for(let i=0;i<68;i++) {
    const theta = random()*Math.PI*2, phi = .18+random()*.92;
    const x = Math.sin(phi)*Math.cos(theta)*.66;
    const z = Math.sin(phi)*Math.sin(theta)*.59;
    const y = Math.cos(phi)*.9;
    const tuft = ellipsoid(head, hair, [x-.025,y+.015,z], [.12+random()*.07,.09+random()*.06,.12], 16);
    tuft.rotation.z = -.35;
  }
  // The photo's sunglasses are retained as a recognizable feature.
  function roundedShape(w,h,r) {
    const s=new THREE.Shape();
    s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);
    s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);
    s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);
    s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);return s;
  }
  const glasses = new THREE.Group(); glasses.position.set(0,.19,.52); head.add(glasses);
  for(const sign of [-1,1]) {
    const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedShape(.52,.32,.1),{depth:.045,bevelEnabled:true,bevelSize:.014,bevelThickness:.014,bevelSegments:3,steps:1}),black);
    frame.position.set(sign*.305,0,-.015);frame.rotation.y=sign*.18;glasses.add(frame);
    const glass = new THREE.Mesh(new THREE.ShapeGeometry(roundedShape(.455,.255,.085)),lens);
    glass.position.set(sign*.305,.005,.053);glass.rotation.y=sign*.18;glasses.add(glass);
    const sheen = new THREE.MeshStandardMaterial({color:'#809b9b',transparent:true,opacity:.28,roughness:.2});
    tube(glasses,sheen,[[sign*.43,.08,.058],[sign*.3,.1,.072],[sign*.22,.09,.078]],.009);
    tube(glasses,black,[[sign*.56,.02,-.06],[sign*.67,.025,-.27],[sign*.65,-.02,-.48]],.033);
  }
  tube(glasses,black,[[-.05,.04,.04],[0,.07,.06],[.05,.04,.04]],.032);
  ellipsoid(head, skin, [0,-.02,.59], [.105,.2,.14]);
  ellipsoid(head, skin, [0,-.15,.69], [.13,.095,.1]);
  for(const sign of [-1,1]) ellipsoid(head,innerSkin,[sign*.075,-.183,.71],[.026,.018,.015]);
  // Beard and a separate lower jaw supply a subtle speech pose.
  ellipsoid(head,beard,[0,-.43,.055],[.575,.4,.515]);
  for(const sign of [-1,1]) {
    const sideburn = ellipsoid(head,beard,[sign*.545,-.24,.2],[.08,.26,.12]);
    sideburn.rotation.z=sign*-.16;
    tube(head,beard,[[sign*.04,-.245,.65],[sign*.15,-.265,.637],[sign*.25,-.31,.596]],.058);
  }
  const jaw = new THREE.Group(); jaw.position.set(0,-.45,.49); head.add(jaw);
  ellipsoid(jaw,beard,[0,-.14,-.1],[.35,.18,.18]);
  const mouth = ellipsoid(head,mouthMaterial,[0,-.395,.576],[.18,.016,.028]);
  tube(head,lip,[[-.15,-.382,.595],[0,-.37,.611],[.15,-.382,.595]],.016);
  const lowerLip = tube(jaw,lip,[[-.13,.037,.101],[0,.021,.128],[.13,.037,.101]],.018);

  // A low gallery plinth anchors the bust; no external textures are fetched.
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.34,1.4,.16,80),new THREE.MeshStandardMaterial({color:'#c8d0c2',roughness:.6,metalness:.12}));
  base.position.y=-.84;scene.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35,.009,8,100),new THREE.MeshStandardMaterial({color:'#95aa91',roughness:.5}));
  ring.rotation.x=Math.PI/2;ring.position.y=-.75;scene.add(ring);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=256;shadowCanvas.height=256;
  const ctx=shadowCanvas.getContext('2d'), gradient=ctx.createRadialGradient(128,128,5,128,128,128);
  gradient.addColorStop(0,'rgba(44,64,41,.24)');gradient.addColorStop(.55,'rgba(44,64,41,.11)');gradient.addColorStop(1,'rgba(44,64,41,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
  const shadowTexture=new THREE.CanvasTexture(shadowCanvas);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(5.5,5.5),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=-.93;scene.add(shadow);

  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let state='idle',viseme='sil',paused=reduced.matches,visible=true,frame=0,yaw=-.13,targetYaw=-.13,pointerX=0,pointerY=0,destroyed=false;
  let epoch=performance.now(),lastTime=epoch;
  function render(now) {
    frame=0;if(destroyed||!visible||document.hidden)return;
    const elapsed=(now-epoch)/1000,delta=Math.min((now-lastTime)/1000,.05);lastTime=now;
    yaw+=(targetYaw-yaw)*Math.min(delta*7,1);figure.rotation.y=yaw;
    if(!paused){
      const talking=state==='speaking';
      const shapes={sil:[0,1],PP:[0,.9],FF:[.15,1],TH:[.25,1],DD:[.3,1],kk:[.35,.95],CH:[.35,.8],SS:[.15,1.1],nn:[.2,1],RR:[.35,.85],aa:[1,1.1],E:[.55,1.2],I:[.3,1.25],O:[.75,.7],U:[.4,.6]};
      const [opening,width]=talking?(shapes[viseme]||shapes.sil):shapes.sil;
      head.rotation.y=pointerX*.13+Math.sin(elapsed*.6)*.025;
      head.rotation.x=pointerY*.045+(state==='listening'?-.045:0)+Math.sin(elapsed*(talking?2.5:.8))*.013;
      head.rotation.z=Math.sin(elapsed*.65)*.017+(state==='thinking'?.035:0);
      torso.scale.y=1+Math.sin(elapsed*1.6)*.006;
      mouth.scale.y=.016+opening*.045;
      mouth.scale.x=.18*width;
      mouth.position.y=-.395-opening*.02;
      jaw.position.y=-.45-opening*.055;
      lowerLip.position.y=-opening*.018;
    }else{
      mouth.scale.y=.016;mouth.scale.x=.18;jaw.position.y=-.45;lowerLip.position.y=0;head.rotation.set(0,0,0);torso.scale.y=1;
    }
    ring.material.color.set(state==='listening'?'#649b75':state==='speaking'?'#588c6b':'#95aa91');
    renderer.render(scene,camera);
    if(!paused || Math.abs(targetYaw-yaw)>.001)frame=requestAnimationFrame(render);
  }
  function wake(){if(!frame&&!destroyed) {lastTime=performance.now();frame=requestAnimationFrame(render);}}
  function resize(){const {width,height}=container.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();wake();}
  const observer=new ResizeObserver(resize);observer.observe(container);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)wake();else{cancelAnimationFrame(frame);frame=0;}},{threshold:0});intersection.observe(container);
  function pointer(event){const rect=container.getBoundingClientRect();pointerX=(event.clientX-rect.left)/rect.width-.5;pointerY=(event.clientY-rect.top)/rect.height-.5;wake();}
  function leave(){pointerX=0;pointerY=0;}
  function visibility(){if(document.hidden){cancelAnimationFrame(frame);frame=0;}else wake();}
  container.addEventListener('pointermove',pointer);container.addEventListener('pointerleave',leave);document.addEventListener('visibilitychange',visibility);
  resize();
  return {
    setState(value){state=value;wake();},
    setViseme(value){viseme=value;wake();},
    rotate(direction){targetYaw=THREE.MathUtils.clamp(targetYaw+direction*.35,-.85,.85);wake();},
    setPaused(value){paused=value;wake();},
    destroy(){destroyed=true;cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();container.removeEventListener('pointermove',pointer);container.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',visibility);scene.traverse(object=>{object.geometry?.dispose();if(object.material){const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.dispose());}});shadowTexture.dispose();renderer.dispose();renderer.domElement.remove();}
  };
}
