// A photo-textured 3D relief of the owner's public portrait. Hand-shaped shallow
// depth preserves the photograph; this is a 2.5D likeness, not a head scan.
import * as THREE from './vendor/three.module.js';

const PHOTO_WIDTH=1616,PHOTO_HEIGHT=1500,SCALE=.008;
// [source-image y, silhouette left x, silhouette right x]. No segmentation
// model, generated face texture or additional photo is needed in the browser.
const HEAD=[
  [409,908,932],[414,876,956],[425,854,975],[444,838,990],
  [466,828,996],[491,826,998],[516,832,997],[539,836,993],
  [550,830,995],[568,834,991],[584,846,986],[603,852,981],
  [624,865,975],[643,881,968],[658,899,958],[670,921,940],
  [675,930,937]
];
const TORSO=[
  [651,877,976],[674,864,993],[694,819,1026],[716,776,1078],
  [740,732,1118],[765,708,1147],[795,685,1168],
  [830,695,1140],[866,720,1120],[900,732,1102],
  [933,741,1087],[951,747,1080]
];
const shapes={sil:[0,1],PP:[0,.97],FF:[.12,1],TH:[.2,1],DD:[.25,1],kk:[.3,1],CH:[.3,.94],SS:[.12,1.04],nn:[.18,1],RR:[.3,.95],aa:[1,1.04],E:[.5,1.08],I:[.25,1.08],O:[.7,.92],U:[.4,.9]};
const smooth=(a,b,value)=>THREE.MathUtils.smoothstep(value,a,b);

function outlineAt(outline,y){
  const next=outline.findIndex(point=>point[0]>=y);
  if(next<=0)return outline[Math.max(next,0)].slice(1);
  const a=outline[next-1],b=outline[next],t=(y-a[0])/(b[0]-a[0]);
  return [THREE.MathUtils.lerp(a[1],b[1],t),THREE.MathUtils.lerp(a[2],b[2],t)];
}
function portraitSurface(outline,columns,rows,isHead){
  const positions=[],uvs=[],colors=[],indices=[],source=[];
  const first=outline[0][0],last=outline.at(-1)[0];
  for(let row=0;row<=rows;row++){
    const t=row/rows,y=THREE.MathUtils.lerp(first,last,t),[left,right]=outlineAt(outline,y);
    for(let col=0;col<=columns;col++){
      const u=col/columns,x=THREE.MathUtils.lerp(left,right,u),across=u*2-1;
      const dome=Math.sqrt(Math.max(0,1-across*across));
      const nose=isHead?.12*Math.exp(-(((x-922)/20)**2)-((y-557)/32)**2):0;
      const z=isHead?.16+.42*dome*Math.sin(Math.PI*t)**.3+nose:.04+.19*dome;
      positions.push((x-920)*SCALE,(950-y)*SCALE,z);
      uvs.push(x/PHOTO_WIDTH,1-y/PHOTO_HEIGHT);
      // Translucent boundary softens the polygonal silhouette.
      const edge=smooth(0,.045,1-Math.abs(across));
      const fade=isHead?smooth(0,.025,t)*(1-smooth(.99,1,t)):1-smooth(825,935,y);
      colors.push(1,1,1,edge*fade);source.push(x,y);
      if(row<rows&&col<columns){const i=row*(columns+1)+col;indices.push(i,i+columns+1,i+1,i+1,i+columns+1,i+columns+2);}
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return {geometry,rest:Float32Array.from(positions),source};
}
export async function mountAvatar(container,{signal}={}){
  // Reuse the homepage's photo. No new image payload, model weights, remote
  // image API or runtime landmark detector is introduced.
  const texture=await new THREE.TextureLoader().loadAsync(new URL('./gokul_try3.jpg',import.meta.url).href);
  if(signal?.aborted){texture.dispose();throw new DOMException('Stopped','AbortError');}
  texture.colorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-3,3,3,-3,.1,30);
  camera.position.set(0,2.12,10);camera.lookAt(0,2.12,0);
  let renderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});}
  catch(error){texture.dispose();throw error;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  // The source already has lighting and skin colour; preserve its appearance.
  const material=new THREE.MeshBasicMaterial({map:texture,vertexColors:true,transparent:true,side:THREE.DoubleSide,depthWrite:false});
  const figure=new THREE.Group();scene.add(figure);
  const torso=portraitSurface(TORSO,32,46,false);
  const bodyMesh=new THREE.Mesh(torso.geometry,material);bodyMesh.renderOrder=1;figure.add(bodyMesh);
  const headSurface=portraitSurface(HEAD,40,64,true);
  const head=new THREE.Group();head.position.set(0,2.2,.01);figure.add(head);
  const headMesh=new THREE.Mesh(headSurface.geometry,material);headMesh.position.y=-2.2;headMesh.renderOrder=2;head.add(headMesh);
  const attributes=headSurface.geometry.attributes.position;
  // Small jaw/lip deformation keeps the original texture attached. It does
  // not invent teeth, eyes or facial information hidden by the photograph.
  const jawWeights=[],lipWeights=[];
  for(let i=0;i<attributes.count;i++){
    const x=headSurface.source[i*2],y=headSurface.source[i*2+1];
    const horizontal=Math.exp(-(((x-923)/52)**4));
    jawWeights.push(horizontal*smooth(589,610,y)*(1-smooth(640,674,y)));
    lipWeights.push(Math.exp(-(((x-923)/48)**4)-((y-597)/21)**2));
  }
  container.append(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');container.classList.add('avatar-rendered');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let state='idle',viseme='sil',paused=reduced.matches,visible=true,frame=0,yaw=0,targetYaw=0,pointerX=0,pointerY=0,destroyed=false;
  let lastTime=performance.now(),lastRendered=0;const epoch=lastTime;
  let opening=0,mouthWidth=1,lastOpening=-1,lastWidth=-1;
  function render(now){
    frame=0;if(destroyed||!visible||document.hidden)return;
    // Gentle portrait motion needs only 30 fps. The texture is uploaded once;
    // vertex buffers change only while the mouth pose is actually changing.
    if(now-lastRendered<1000/30){frame=requestAnimationFrame(render);return;}lastRendered=now;
    const elapsed=(now-epoch)/1000,delta=Math.min((now-lastTime)/1000,.05);lastTime=now;
    yaw+=(targetYaw-yaw)*Math.min(delta*8,1);figure.rotation.y=yaw;
    const talking=state==='speaking';
    const target=!paused&&talking?(shapes[viseme]||shapes.sil):shapes.sil;
    opening+=(target[0]-opening)*Math.min(delta*18,1);mouthWidth+=(target[1]-mouthWidth)*Math.min(delta*18,1);
    if(Math.abs(lastOpening-opening)>.0001||Math.abs(lastWidth-mouthWidth)>.0001){
      for(let i=0;i<attributes.count;i++){
        const offset=i*3;
        attributes.setXYZ(i,headSurface.rest[offset]+(headSurface.rest[offset]-.024)*(mouthWidth-1)*lipWeights[i],headSurface.rest[offset+1]-opening*.065*jawWeights[i],headSurface.rest[offset+2]+opening*.012*lipWeights[i]);
      }
      attributes.needsUpdate=true;lastOpening=opening;lastWidth=mouthWidth;
    }
    head.rotation.y=paused?0:pointerX*.055+Math.sin(elapsed*.55)*.007;
    head.rotation.x=paused?0:pointerY*.025+(state==='listening'?-.018:0);
    head.rotation.z=paused?0:Math.sin(elapsed*.65)*.006+(state==='thinking'?.012:0);
    bodyMesh.scale.y=paused?1:1+Math.sin(elapsed*1.3)*.0015;
    renderer.render(scene,camera);
    if(!paused||Math.abs(targetYaw-yaw)>.001||Math.abs(opening-target[0])>.001||Math.abs(mouthWidth-target[1])>.001)frame=requestAnimationFrame(render);
  }
  function wake(){if(!frame&&!destroyed){lastTime=performance.now();frame=requestAnimationFrame(render);}}
  function resize(){
    const {width,height}=container.getBoundingClientRect();if(!width||!height)return;
    renderer.setSize(width,height,false);const aspect=width/height,halfHeight=Math.max(2.45,2.6/aspect);
    camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();wake();
  }
  const observer=new ResizeObserver(resize);observer.observe(container);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)wake();else{cancelAnimationFrame(frame);frame=0;}});intersection.observe(container);
  function pointer(event){const rect=container.getBoundingClientRect();pointerX=(event.clientX-rect.left)/rect.width-.5;pointerY=(event.clientY-rect.top)/rect.height-.5;wake();}
  function leave(){pointerX=0;pointerY=0;wake();}
  function visibility(){if(document.hidden){cancelAnimationFrame(frame);frame=0;}else wake();}
  container.addEventListener('pointermove',pointer);container.addEventListener('pointerleave',leave);document.addEventListener('visibilitychange',visibility);resize();
  return {
    setState(value){state=value;wake();},setViseme(value){viseme=value;wake();},
    rotate(direction){targetYaw=THREE.MathUtils.clamp(targetYaw+direction*.11,-.22,.22);wake();},
    setPaused(value){paused=value;wake();},
    destroy(){destroyed=true;cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();container.removeEventListener('pointermove',pointer);container.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',visibility);headSurface.geometry.dispose();torso.geometry.dispose();material.dispose();texture.dispose();renderer.dispose();renderer.domElement.remove();container.classList.remove('avatar-rendered');}
  };
}
