// The approved 202k-Gaussian portrait. All interaction runs locally in WebGL.
import * as THREE from './avatar3d/three.module.js';
import {Viewer,SceneFormat,SceneRevealMode} from './avatar3d/renderer.js';
import {clamp, cameraPose, gazeTarget, clickableTarget, boundHeadPose} from './portrait-behavior.js';
const assets=new URL('./avatar3d/',import.meta.url);
let shared;
function resources(){return shared??=Promise.all([
 fetch(new URL('interaction.json',assets)).then(r=>{if(!r.ok)throw Error('Missing facial rig');return r.json()}),
 fetch(new URL('interaction.bin',assets)).then(r=>{if(!r.ok)throw Error('Missing facial fields');return r.arrayBuffer()}),
 new THREE.TextureLoader().loadAsync(new URL('portrait-texture.png',assets).href)
]).catch(error=>{shared=null;throw error})}

export async function mountAvatar(container,{signal}={}){
 const [metadata,buffer,photo]=await resources();
 if(signal?.aborted)throw new DOMException('Stopped','AbortError');
 const viewer=new Viewer({rootElement:container,cameraUp:[0,1,0],initialCameraPosition:[0,-.025,1.10],initialCameraLookAt:[0,-.025,-.05],useBuiltInControls:false,selfDrivenMode:false,sharedMemoryForWorkers:false,gpuAcceleratedSort:false,integerBasedSort:false,splatSortDistanceMapPrecision:20,halfPrecisionCovariancesOnGPU:false,inMemoryCompressionLevel:0,optimizeSplatData:false,backgroundColor:'#ffffff',sphericalHarmonicsDegree:0,sceneRevealMode:SceneRevealMode.Instant,devicePixelRatio:Math.min(devicePixelRatio,1.75)});
 await viewer.addSplatScene(new URL('portrait.ply',assets).href,{format:SceneFormat.Ply,showLoadingUI:false,progressiveLoad:false,splatAlphaRemovalThreshold:0});
 if(signal?.aborted){await viewer.dispose();throw new DOMException('Stopped','AbortError')}
 const count=viewer.splatMesh.getSplatCount(),splat=viewer.splatMesh.getScene(0),point=new THREE.Vector3();
 if(count!==metadata.count)throw Error('Portrait and facial rig count mismatch');
 for(const s of metadata.sentinels){splat.splatBuffer.getSplatCenter(s.index,point);if(point.distanceTo(new THREE.Vector3(...s.xyz))>1e-5)throw Error('Facial point correspondence changed')}
 const face=installFaceRig(viewer,metadata,buffer,photo);
 viewer.camera.fov=27;viewer.camera.near=.02;viewer.camera.far=10;viewer.camera.updateProjectionMatrix();
 const canvas=viewer.renderer.domElement;canvas.setAttribute('aria-hidden','true');canvas.style.touchAction='pan-y';
 container.classList.add('avatar-rendered');container.dataset.ready='true';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let paused=reduced.matches,state='idle',viseme='sil',yaw=0,targetYaw=0,gx=0,gy=0,tx=0,ty=0,reaction=0,headYaw=0,headPitch=0,hover=null,focus=null,visible=true,destroyed=false,drag=null;
 let sim=0,last=performance.now(),lastRaf=last,raf=0,fallback=false,fastRaf=0,blinkStart=-10,nextBlink=3.1,softBlink=-10,clickAt=-10,lastUpdate=-1,frames=0,fps=0,fpsAt=last;
 const diagnostics=document.createElement('output');diagnostics.className='portrait-diagnostics';diagnostics.hidden=true;container.append(diagnostics);
 const listeners=[];
 function on(target,type,fn,options){target.addEventListener(type,fn,options);listeners.push(()=>target.removeEventListener(type,fn,options))}
 function reactionTarget(){return !!(hover||focus)}
 function setHover(value){if(value!==hover){if(value&&!hover)softBlink=sim;hover=value}}
 on(document,'pointermove',e=>{if(e.pointerType==='touch')return;const rect=container.getBoundingClientRect();({x:tx,y:ty}=gazeTarget(e.clientX,e.clientY,rect,innerWidth,innerHeight));});
 on(document,'pointerover',e=>{if(e.pointerType!=='touch')setHover(clickableTarget(e.target))});
 on(document,'pointerout',e=>setHover(clickableTarget(e.relatedTarget)));
 on(document,'focusin',e=>{focus=e.target.matches?.(':focus-visible')?clickableTarget(e.target):null;if(focus){const r=focus.getBoundingClientRect(),box=container.getBoundingClientRect();({x:tx,y:ty}=gazeTarget(r.x+r.width/2,r.y+r.height/2,box,innerWidth,innerHeight));softBlink=sim}});
 on(document,'focusout',e=>{focus=clickableTarget(e.relatedTarget);if(!focus&&!hover){tx=ty=0}});
 on(document,'click',e=>{if(clickableTarget(e.target))clickAt=sim});
 function neutral(){tx=ty=0;hover=null;focus=null;drag=null}
 on(document.documentElement,'pointerleave',neutral);on(window,'blur',neutral);
 on(canvas,'pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:targetYaw,touch:e.pointerType==='touch'};if(!drag.touch)canvas.setPointerCapture(e.pointerId)});
 on(canvas,'pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(drag.touch&&Math.abs(dy)>Math.abs(dx))return;targetYaw=clamp(drag.yaw-dx*.11,-15,15)});
 const release=()=>drag=null;on(canvas,'pointerup',release);on(canvas,'pointercancel',release);on(canvas,'lostpointercapture',release);
 on(container,'keydown',e=>{if(e.target!==container)return;if(['ArrowLeft','ArrowRight','Home'].includes(e.key)){e.preventDefault();targetYaw=e.key==='Home'?0:clamp(targetYaw+(e.key==='ArrowLeft'?-5:5),-15,15)}});
 const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){last=performance.now();viewer.forceRenderNextFrame()}});intersection.observe(container);
 function tick(now){
  if(destroyed||document.hidden||!visible||now-last<28)return;
  const dt=Math.min(.06,(now-last)/1000);last=now;if(!paused)sim+=dt;
  const lerp=1-Math.exp(-dt*9);yaw+=(targetYaw-yaw)*lerp;
  gx+=((paused?0:tx)-gx)*lerp;gy+=((paused?0:ty)-gy)*lerp;reaction+=((!paused&&reactionTarget()?1:0)-reaction)*(1-Math.exp(-dt*6));
  if(sim>=nextBlink){blinkStart=sim;nextBlink=sim+3.8+Math.sin(sim*1.7)*.8}
  const pulse=(start,duration)=>{const t=(sim-start)/duration;return t>=0&&t<1?Math.sin(Math.PI*t)**2:0};
  const blink=paused?0:Math.max(pulse(blinkStart,.21),.32*pulse(softBlink,.26));
  const mouth=paused?0:state==='speaking'&&viseme!=='sil'?(viseme==='aa'?.50:.24):0;
  const nod=paused?0:1.2*pulse(clickAt,.6);
  const pose=cameraPose(yaw,nod);viewer.camera.position.set(...pose.position);viewer.camera.lookAt(...pose.target);
  headYaw+=((paused?0:gx*10)-headYaw)*lerp;headPitch+=((paused?0:gy*4)-headPitch)*lerp;
  const head=boundHeadPose(headYaw,headPitch,pose.yaw,pose.pitch);headYaw=head.yaw;headPitch=head.pitch;
  if(now-lastUpdate>30){face.update([mouth,blink,blink],gx*.55,gy*.55,reaction,headYaw*Math.PI/180,headPitch*Math.PI/180);lastUpdate=now}
  viewer.forceRenderNextFrame();viewer.update();viewer.render();
  frames++;if(now-fpsAt>1000){fps=Math.round(frames*1000/(now-fpsAt));frames=0;fpsAt=now;const text=JSON.stringify({ready:true,fps,visible,paused,yawDegrees:pose.yaw,pitchDegrees:pose.pitch,rotationLimit:15,headYawDegrees:+headYaw.toFixed(3),headPitchDegrees:+headPitch.toFixed(3),combinedYawDegrees:+(headYaw-pose.yaw).toFixed(3),combinedPitchDegrees:+(headPitch+pose.pitch).toFixed(3),gaze:[+gx.toFixed(3),+gy.toFixed(3)],reaction:+reaction.toFixed(3),blink:+blink.toFixed(3),hover:!!hover,focus:!!focus,pointCount:count,activeFacialPoints:metadata.activeCount,scheduler:fallback?'timer fallback':'requestAnimationFrame'});diagnostics.textContent=text;container.dataset.expression=paused?'paused':reaction>.2?'interested':'attentive'}
 }
 function frame(now){const gap=now-lastRaf;lastRaf=now;if(gap>150){fallback=true;fastRaf=0}else if(gap<80&&++fastRaf>6)fallback=false;tick(now);raf=requestAnimationFrame(frame)}
 raf=requestAnimationFrame(frame);const timer=setInterval(()=>{if(fallback||performance.now()-lastRaf>200)tick(performance.now())},1000/30);
 return {setState(v){state=v},setViseme(v){viseme=v},rotate(direction){targetYaw=clamp(targetYaw+direction*5,-15,15)},reset(){targetYaw=0;tx=ty=0},setPaused(v){paused=v;if(v){gx=gy=reaction=headYaw=headPitch=0;face.update([0,0,0],0,0,0)}},async destroy(){destroyed=true;clearInterval(timer);cancelAnimationFrame(raf);intersection.disconnect();listeners.forEach(remove=>remove());face.dispose();diagnostics.remove();await viewer.dispose();container.classList.remove('avatar-rendered');delete container.dataset.ready}};
}

function installFaceRig(viewer,metadata,buffer,photo){
 const {count,activeCount:n,scales}=metadata;
 if(buffer.byteLength!==n*58)throw Error('Facial field size mismatch');
 const ids=new Uint32Array(buffer,0,n),uv=new Float32Array(buffer,n*4,n*3),source=new Int16Array(buffer,n*16,n*21);
 const width=512,height=Math.ceil(count/width),texels=width*height*4,positions=[],colors=[],raw=[],lookup=new Float32Array(texels);
 const base=new Float32Array(n*4),center=new THREE.Vector3();const scene=viewer.splatMesh.getScene(0);
 for(let j=0;j<n;j++){scene.splatBuffer.getSplatCenter(ids[j],center);base.set([center.x,center.y,center.z,1],j*4);lookup.set([uv[j*3],uv[j*3+1],uv[j*3+2],1],ids[j]*4)}
 function texture(data){const t=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);t.needsUpdate=true;t.minFilter=t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;return t}
 for(let ch=0;ch<3;ch++){const p=new Float32Array(texels),c=new Float32Array(texels),d=new Float32Array(n*3);for(let j=0;j<n;j++){const at=(ch*n+j)*7,i=ids[j];for(let k=0;k<3;k++){const val=source[at+k]/32767*scales[k];p[i*4+k]=val;d[j*3+k]=val;c[i*4+k]=source[at+3+k]/32767*2}p[i*4+3]=source[at+6]/32767}positions.push(texture(p));colors.push(texture(c));raw.push(d)}
 const facialUV=texture(lookup),material=viewer.splatMesh.material;
 Object.assign(material.uniforms,{faceAmounts:{value:new THREE.Vector3()},faceSize:{value:new THREE.Vector2(width,height)},facialUV:{value:facialUV},facePhoto:{value:photo},gaze:{value:new THREE.Vector2()},interest:{value:0},headPose:{value:new THREE.Vector2()}});
 for(let i=0;i<3;i++){material.uniforms['facePosition'+i]={value:positions[i]};material.uniforms['faceColor'+i]={value:colors[i]}}
 const declarations='uniform vec3 faceAmounts;uniform vec2 faceSize;uniform sampler2D facialUV;uniform sampler2D facePhoto;uniform vec2 gaze;uniform float interest;uniform vec2 headPose;'+[0,1,2].map(i=>'uniform sampler2D facePosition'+i+';uniform sampler2D faceColor'+i+';').join('');
 const shape=`
float sq(float x){return x*x;}
float fourth(float x){float y=x*x;return y*y;}
vec3 expressionAccent(vec4 info){
 float side=info.x<.5?-1.0:1.0;
 float corner=exp(-sq((info.x-(.5+side*.078))/.038)-sq((info.y-.604)/.037))*info.z;
 float brow=exp(-fourth((info.x-(.5+side*.09))/.065)-fourth((info.y-.369)/.027))*info.z;
 return vec3(side*.0013*corner,.0027*corner+.0015*brow,.0004*corner)*interest;
}
float eyeOpening(vec2 uv,float cx){float x=(uv.x-cx)/.046;float opening=max(0.0,1.0-x*x);float top=.420-.011*opening;float bottom=.420+.010*opening;return smoothstep(top,top+.0025,uv.y)*(1.0-smoothstep(bottom-.0025,bottom,uv.y))*(1.0-smoothstep(.90,1.0,abs(x)));}
`;
 material.vertexShader=declarations+'\n'+material.vertexShader;
 const main='void main () {';if(!material.vertexShader.includes(main))throw Error('Facial shader main changed');material.vertexShader=material.vertexShader.replace(main,shape+'\n'+main);
 const anchor='vec3 splatCenter = uintBitsToFloat(uvec3(sampledCenterColor.gba));';if(!material.vertexShader.includes(anchor))throw Error('Facial shader center hook changed');
 material.vertexShader=material.vertexShader.replace(anchor,anchor+`uint fw=uint(faceSize.x);vec2 faceUV=(vec2(float(splatIndex%fw),float(splatIndex/fw))+.5)/faceSize;vec4 info=texture(facialUV,faceUV);vec4 fp0=texture(facePosition0,faceUV),fp1=texture(facePosition1,faceUV),fp2=texture(facePosition2,faceUV);splatCenter+=faceAmounts.x*fp0.xyz+faceAmounts.y*fp1.xyz+faceAmounts.z*fp2.xyz+expressionAccent(info);
 float neckT=clamp((splatCenter.y+.090)/.055,0.0,1.0);float headWeight=neckT*neckT*(3.0-2.0*neckT);float headGradient=6.0*neckT*(1.0-neckT)/.055;
 float hy=sin(headPose.x),cy=cos(headPose.x),hp=sin(headPose.y),cp=cos(headPose.y);
 mat3 headR=mat3(cy,0.0,-hy,0.0,1.0,0.0,hy,0.0,cy)*mat3(1.0,0.0,0.0,0.0,cp,hp,0.0,-hp,cp);
 mat3 headD=headR-mat3(1.0);vec3 neckDelta=headD*(splatCenter-vec3(0.0,-.075,-.020));
 mat3 headDeformation=mat3(1.0)+headWeight*headD+outerProduct(neckDelta,vec3(0.0,headGradient,0.0));
 splatCenter+=headWeight*neckDelta;`);
 const ca='vColor = uintToRGBAVec(sampledCenterColor.r);';if(!material.vertexShader.includes(ca))throw Error('Facial shader color hook changed');
 material.vertexShader=material.vertexShader.replace(ca,ca+`
 vColor.rgb+=faceAmounts.x*texture(faceColor0,faceUV).rgb+faceAmounts.y*texture(faceColor1,faceUV).rgb+faceAmounts.z*texture(faceColor2,faceUV).rgb;
 float eyes=max(eyeOpening(info.xy,.406),eyeOpening(info.xy,.591))*info.z*(1.0-max(faceAmounts.y,faceAmounts.z));
 vec2 shifted=info.xy-gaze*vec2(.009,.0035);
 vColor.rgb+=(texture(facePhoto,vec2(shifted.x,1.0-shifted.y)).rgb-texture(facePhoto,vec2(info.x,1.0-info.y)).rgb)*eyes;
 vColor.rgb=clamp(vColor.rgb,0.0,1.0);vColor.a=clamp(vColor.a+faceAmounts.x*fp0.w+faceAmounts.y*fp1.w+faceAmounts.z*fp2.w,0.0,1.0);`);
 const covarianceAnchor='mat3 cov2Dm = transpose(T) * Vrk * T;';
 if(!material.vertexShader.includes(covarianceAnchor))throw Error('Head covariance hook changed');
 material.vertexShader=material.vertexShader.replace(covarianceAnchor,'Vrk=headDeformation*Vrk*transpose(headDeformation);'+covarianceAnchor);material.needsUpdate=true;
 const old=[-1,-1,-1,-1,100,100],centers=new Float32Array(n*4);
 function accent(u,v,front,amount){const side=u<.5?-1:1,c=Math.exp(-(((u-(.5+side*.078))/.038)**2)-((v-.604)/.037)**2)*front,b=Math.exp(-(((u-(.5+side*.09))/.065)**4)-((v-.369)/.027)**4)*front;return [side*.0013*c*amount,(.0027*c+.0015*b)*amount,.0004*c*amount]}
 const baseCenters=new Float32Array(count*4),all=new Float32Array(count*4),sceneIndexes=new Uint32Array(count);
 const headIds=[];for(let i=0;i<count;i++){scene.splatBuffer.getSplatCenter(i,center);baseCenters.set([center.x,center.y,center.z,1],i*4);if(center.y>-.090)headIds.push(i)}
 return {update(weights,gx,gy,interest,headYaw=0,headPitch=0){material.uniforms.faceAmounts.value.fromArray(weights);material.uniforms.gaze.value.set(gx,gy);material.uniforms.interest.value=interest;material.uniforms.headPose.value.set(headYaw,headPitch);
  // Small facial displacement is bounded; update sorter centers when it changes.
  if(weights.some((w,i)=>Math.abs(w-old[i])>.015)||Math.abs(interest-old[3])>.02||Math.abs(headYaw-old[4])>.0005||Math.abs(headPitch-old[5])>.0005){
   for(let j=0;j<n;j++){const a=accent(uv[j*3],uv[j*3+1],uv[j*3+2],interest);for(let k=0;k<3;k++)centers[j*4+k]=base[j*4+k]+weights[0]*raw[0][j*3+k]+weights[1]*raw[1][j*3+k]+weights[2]*raw[2][j*3+k]+a[k];centers[j*4+3]=1}
   // The same head transform drives the GPU ellipsoids and CPU depth sorter.
   all.set(baseCenters);for(let j=0;j<n;j++)all.set(centers.subarray(j*4,j*4+4),ids[j]*4);
   const sy=Math.sin(headYaw),cy=Math.cos(headYaw),sp=Math.sin(headPitch),cp=Math.cos(headPitch);
   for(const i of headIds){const at=i*4,x=all[at],y=all[at+1]+.075,z=all[at+2]+.020;
    const t=clamp((all[at+1]+.090)/.055,0,1),w=t*t*(3-2*t),ry=cp*y-sp*z,rz=sp*y+cp*z;
    all[at]+=w*(cy*x+sy*rz-x);all[at+1]+=w*(ry-y);all[at+2]+=w*(-sy*x+cy*rz-z);
   }
   viewer.sortWorker.postMessage({centers:all.buffer,sceneIndexes:sceneIndexes.buffer,range:{from:0,count}});weights.forEach((w,i)=>old[i]=w);old[3]=interest;old[4]=headYaw;old[5]=headPitch
  }
 },dispose(){[facialUV,...positions,...colors].forEach(t=>t.dispose())}};
}
