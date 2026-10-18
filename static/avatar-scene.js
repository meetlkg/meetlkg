// OMG-Avatar native 3D geometry and baked neural expression fields; local WebGL.
import {createPoseSortQueue} from './portrait-depth-sort.js?v=depth-sort-20261018-1';
import * as THREE from './avatar3d/three.module.js';
import {Viewer,SceneFormat,SceneRevealMode} from './avatar3d/renderer.js';
import {clamp, cameraPose, gazeTarget, clickableTarget, nativeExpressionWeights, portraitHeadTarget, turnAttachedCenters} from './portrait-behavior.js?v=speech-20261018-7b';
const assets=new URL('./avatar-omg/',import.meta.url);
let shared;
async function downloadAsset(name){
 if(typeof DecompressionStream==='function'){
  try{const response=await fetch(new URL(name+'.gz',assets),{cache:'no-cache'});if(response.ok&&response.body)return await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()}catch{}
 }
 const response=await fetch(new URL(name,assets),{cache:'no-cache'});if(!response.ok)throw Error('Missing avatar asset: '+name);return response.arrayBuffer();
}
function resources(){return shared??=Promise.all([
 fetch(new URL('model.json',assets),{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Missing facial model');return r.json()}),
 downloadAsset('expressions.bin'),downloadAsset('portrait.ply'),downloadAsset('attachment.bin')
]).catch(error=>{shared=null;throw error})}

export async function mountAvatar(container,{signal,allowManualTurn=false,followPointer=true}={}){
 const [metadata,buffer,plyBuffer,attachmentBuffer]=await resources();
 if(signal?.aborted)throw new DOMException('Stopped','AbortError');
 const viewer=new Viewer({rootElement:container,cameraUp:[0,1,0],initialCameraPosition:[0,-.025,1.10],initialCameraLookAt:[0,-.025,-.05],useBuiltInControls:false,selfDrivenMode:false,sharedMemoryForWorkers:false,gpuAcceleratedSort:false,integerBasedSort:false,splatSortDistanceMapPrecision:20,halfPrecisionCovariancesOnGPU:false,inMemoryCompressionLevel:0,optimizeSplatData:false,backgroundColor:'#ffffff',sphericalHarmonicsDegree:0,sceneRevealMode:SceneRevealMode.Instant,devicePixelRatio:Math.min(devicePixelRatio,1.75)});
 const modelURL=URL.createObjectURL(new Blob([plyBuffer],{type:'application/octet-stream'}));
 try{await viewer.addSplatScene(modelURL,{format:SceneFormat.Ply,showLoadingUI:false,progressiveLoad:false,splatAlphaRemovalThreshold:0})}finally{URL.revokeObjectURL(modelURL)}
 if(signal?.aborted){await viewer.dispose();throw new DOMException('Stopped','AbortError')}
 const count=viewer.splatMesh.getSplatCount(),splat=viewer.splatMesh.getScene(0),point=new THREE.Vector3();
 if(count!==metadata.count)throw Error('Portrait and facial rig count mismatch');
 for(const s of metadata.sentinels){splat.splatBuffer.getSplatCenter(s.index,point);if(point.distanceTo(new THREE.Vector3(...s.xyz))>1e-5)throw Error('Facial point correspondence changed')}
 viewer.camera.fov=metadata.camera.fov;viewer.camera.near=.02;viewer.camera.far=10;viewer.camera.updateProjectionMatrix();
 const sourcePose=cameraPose(0,0,metadata.camera.distance);viewer.camera.position.set(...sourcePose.position);viewer.camera.lookAt(...sourcePose.target);viewer.camera.updateMatrixWorld(true);
 // Static tree bounds describe the neutral pose; let the GPU clip moved splats.
 const gatherAll=viewer.gatherSceneNodesForSort.bind(viewer);viewer.gatherSceneNodesForSort=()=>gatherAll(true);
 const face=installFaceRig(viewer,metadata,buffer,attachmentBuffer);
 face.update(metadata.channels.map(()=>0),0,0);
 try{await face.ready()}catch(error){await face.dispose();await viewer.dispose();throw error}
 if(signal?.aborted){await face.dispose();await viewer.dispose();throw new DOMException('Stopped','AbortError')}

 const canvas=viewer.renderer.domElement;canvas.setAttribute('aria-hidden','true');canvas.style.touchAction='pan-y';
 container.classList.add('avatar-rendered');container.dataset.ready='true';
 const smoothAmounts=new Float32Array(metadata.channels.length);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let paused=reduced.matches,state='idle',viseme='sil',speechSampler=null,mouth=null,yaw=0,targetYaw=0,gx=0,gy=0,tx=0,ty=0,reaction=0,headYaw=0,headPitch=0,hover=null,focus=null,visible=true,destroyed=false,drag=null;
 let previewName='',previewUntil=0,sim=0,last=performance.now(),lastRaf=last,raf=0,fallback=false,fastRaf=0,blinkStart=-10,nextBlink=3.1,softBlink=-10,clickAt=-10,lastUpdate=-1,frames=0,fps=0,fpsAt=last;
 const diagnostics=document.createElement('output');diagnostics.className='portrait-diagnostics';diagnostics.hidden=true;container.append(diagnostics);
 const listeners=[];
 function on(target,type,fn,options){target.addEventListener(type,fn,options);listeners.push(()=>target.removeEventListener(type,fn,options))}
 function reactionTarget(){return followPointer&&!!(hover||focus)}
 function setHover(value){if(value!==hover){if(value&&!hover)softBlink=sim;hover=value}}
 on(document,'pointermove',e=>{if(!followPointer||e.pointerType==='touch')return;const rect=container.getBoundingClientRect();({x:tx,y:ty}=gazeTarget(e.clientX,e.clientY,rect,innerWidth,innerHeight));});
 on(document,'pointerover',e=>{if(e.pointerType!=='touch')setHover(clickableTarget(e.target))});
 on(document,'pointerout',e=>setHover(clickableTarget(e.relatedTarget)));
 on(document,'focusin',e=>{if(!followPointer)return;focus=e.target.matches?.(':focus-visible')?clickableTarget(e.target):null;if(focus){const r=focus.getBoundingClientRect(),box=container.getBoundingClientRect();({x:tx,y:ty}=gazeTarget(r.x+r.width/2,r.y+r.height/2,box,innerWidth,innerHeight));softBlink=sim}});
 on(document,'focusout',e=>{focus=clickableTarget(e.relatedTarget);if(!focus&&!hover){tx=ty=0}});
 on(document,'click',e=>{if(clickableTarget(e.target))clickAt=sim});
 function neutral(){tx=ty=0;hover=null;focus=null;drag=null}
 on(document.documentElement,'pointerleave',neutral);on(window,'blur',neutral);
 if(allowManualTurn){
 on(canvas,'pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:targetYaw,touch:e.pointerType==='touch'};if(!drag.touch)canvas.setPointerCapture(e.pointerId)});
 on(canvas,'pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(drag.touch&&Math.abs(dy)>Math.abs(dx))return;targetYaw=clamp(drag.yaw+dx*.11,-15,15)});
 const release=()=>drag=null;on(canvas,'pointerup',release);on(canvas,'pointercancel',release);on(canvas,'lostpointercapture',release);
 on(container,'keydown',e=>{if(e.target!==container)return;if(['ArrowLeft','ArrowRight','Home'].includes(e.key)){e.preventDefault();targetYaw=e.key==='Home'?0:clamp(targetYaw+(e.key==='ArrowLeft'?-5:5),-15,15)}});
 }
 const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){last=performance.now();viewer.forceRenderNextFrame()}});intersection.observe(container);
 function tick(now){
  if(destroyed||document.hidden||!visible||now-last<28)return;
  const dt=Math.min(.06,(now-last)/1000);last=now;if(!paused)sim+=dt;
  const lerp=1-Math.exp(-dt*9);yaw+=(targetYaw-yaw)*lerp;
  gx+=((paused?0:tx)-gx)*lerp;gy+=((paused?0:ty)-gy)*lerp;reaction+=((!paused&&reactionTarget()?1:0)-reaction)*(1-Math.exp(-dt*6));
  if(sim>=nextBlink){blinkStart=sim;nextBlink=sim+3.8+Math.sin(sim*1.7)*.8}
  const pulse=(start,duration)=>{const t=(sim-start)/duration;return t>=0&&t<1?Math.sin(Math.PI*t)**2:0};
  // Sorting presents a pose on the following render. Sample for that display
  // time so short consonants do not lag behind the audible recording.
  const renderLead=clamp(face.status().latencyMs+16.7,25,80)/1000;
  mouth=state==='speaking'&&speechSampler?speechSampler(renderLead):null;
  const performance=paused?null:mouth?.performance;
  if(performance?.blink>.15)nextBlink=sim+5;
  const blink=paused?0:Math.max(pulse(blinkStart,.21),.32*pulse(softBlink,.26),performance?.blink||0);

  const nod=paused?0:(state==='speaking'?(performance?.nod||0):1.2*pulse(clickAt,.6));
  const pose=cameraPose(0,0,metadata.camera.distance);viewer.camera.position.set(...pose.position);viewer.camera.lookAt(...pose.target);
  const attention=state==='speaking'?.55:1;
  const head=portraitHeadTarget(yaw,paused?0:gx*attention,paused?0:gy*attention,nod);
  if(performance)head.yaw=clamp(head.yaw+(performance.turn||0),-15,15);
  headYaw+=(head.yaw-headYaw)*lerp;headPitch+=(head.pitch-headPitch)*lerp;
  if(now-lastUpdate>30){
   const amounts=nativeExpressionWeights({mouth,blink,interest:reaction,gazeX:gx*.55*attention+(performance?.gazeX||0),gazeY:gy*.55*attention+(performance?.gazeY||0),viseme,speaking:state==='speaking',paused});
   if(!paused&&sim<previewUntil){for(const key of metadata.channels)amounts[key]=0;if(previewName in amounts)amounts[previewName]=1;}
   for(let c=0;c<metadata.channels.length;c++){const name=metadata.channels[c],rate=name==='blink'?38:18;if(mouth&&(name.startsWith('speech')||['jawOpen','mouthWide','mouthRound','lipPress'].includes(name)))smoothAmounts[c]=amounts[name]||0;else smoothAmounts[c]+=((amounts[name]||0)-smoothAmounts[c])*(1-Math.exp(-dt*rate));}
   face.update(Array.from(smoothAmounts),headYaw*Math.PI/180,headPitch*Math.PI/180,mouth?.sampleTime);lastUpdate=now
  }
  viewer.forceRenderNextFrame();viewer.update();viewer.render();
  // Review-only recording must copy pixels before WebGL discards its buffer.
  if(canvas.dataset.capture==='true')canvas.dispatchEvent(new CustomEvent('portrait-rendered',{detail:{sampleTime:face.status().sampleTime,energy:mouth?.energy||0}}));
  frames++;if(now-fpsAt>1000){fps=Math.round(frames*1000/(now-fpsAt));frames=0;fpsAt=now;const text=JSON.stringify({ready:true,rendererRevision:'speech-20261018-7',fps,visible,paused,speech:mouth?{viseme:mouth.viseme,jaw:+mouth.jawOpen.toFixed(3),round:+mouth.mouthRound.toFixed(3),wide:+mouth.mouthWide.toFixed(3),closure:+mouth.lipPress.toFixed(3),energy:+mouth.energy.toFixed(3),poses:mouth.neural||mouth.articulation,model:mouth.neural?'StreamingTalker':'visemes'}:null,yawDegrees:pose.yaw,pitchDegrees:pose.pitch,manualYawDegrees:+yaw.toFixed(3),rotationLimit:15,headYawDegrees:+headYaw.toFixed(3),headPitchDegrees:+headPitch.toFixed(3),combinedYawDegrees:+(headYaw-pose.yaw).toFixed(3),combinedPitchDegrees:+(headPitch+pose.pitch).toFixed(3),gaze:[+gx.toFixed(3),+gy.toFixed(3)],reaction:+reaction.toFixed(3),blink:+blink.toFixed(3),hover:!!hover,focus:!!focus,model:metadata.model,pointCount:count,activeFacialPoints:metadata.headCount,preview:sim<previewUntil?previewName:null,depthSort:face.status(),scheduler:fallback?'timer fallback':'requestAnimationFrame'});diagnostics.textContent=text;container.dataset.expression=paused?'paused':reaction>.2?'interested':'attentive'}
 }
 function frame(now){const gap=now-lastRaf;lastRaf=now;if(gap>150){fallback=true;fastRaf=0}else if(gap<80&&++fastRaf>6)fallback=false;tick(now);raf=requestAnimationFrame(frame)}
 raf=requestAnimationFrame(frame);const timer=setInterval(()=>{if(fallback||performance.now()-lastRaf>200)tick(performance.now())},1000/30);
 return {preview(name){if(!metadata.channels.includes(name))throw Error('Unknown expression');previewName=name;previewUntil=sim+5;},setState(v){state=v},setViseme(v){viseme=v},setSpeechSampler(v){speechSampler=v;mouth=null},rotate(direction){if(allowManualTurn)targetYaw=clamp(targetYaw+direction*5,-15,15)},reset(){targetYaw=0;tx=ty=0;previewUntil=0;previewName=''},setPaused(v){paused=v;if(v){gx=gy=reaction=headYaw=headPitch=0;smoothAmounts.fill(0);face.update(metadata.channels.map(()=>0),0,0)}},async destroy(){destroyed=true;clearInterval(timer);cancelAnimationFrame(raf);intersection.disconnect();listeners.forEach(remove=>remove());await face.dispose();diagnostics.remove();await viewer.dispose();container.classList.remove('avatar-rendered');delete container.dataset.ready}};
}

function installFaceRig(viewer,metadata,buffer,attachmentBuffer){
 const {count,headCount:n,headStart:start,channels,scales,neckAttachment:neck}=metadata,nc=channels.length;
 if(buffer.byteLength!==n*nc*6*2||start+n!==count)throw Error('Native expression field layout mismatch');
 const source=new Int16Array(buffer),width=512,height=Math.ceil(n/width),layerSize=width*height*4;
 // Half-float storage halves GPU memory; CPU sorting retains full precision.
 const atlasData=new Uint16Array(layerSize*nc*2),raw=[],active=[];
 for(let c=0;c<nc;c++){
  const xyz=new Float32Array(n*3);raw.push(xyz);
  for(let j=0;j<n;j++)for(let k=0;k<3;k++){
   const at=(c*n+j)*6,val=source[at+k]/32767*scales[k];
   atlasData[c*2*layerSize+j*4+k]=THREE.DataUtils.toHalfFloat(val);xyz[j*3+k]=val;
   atlasData[(c*2+1)*layerSize+j*4+k]=THREE.DataUtils.toHalfFloat(source[at+3+k]/32767*scales[3+k]);
  }
  const ids=[];for(let j=0;j<n;j++)if(xyz[j*3]||xyz[j*3+1]||xyz[j*3+2])ids.push(j);active.push(new Uint32Array(ids));
 }
 const attachmentWeights=new Float32Array(attachmentBuffer);
 if(attachmentWeights.length!==count||attachmentWeights.some(w=>!Number.isFinite(w)||w<0||w>1))throw Error('Invalid anatomical attachment weights');
 const attachmentHeight=Math.ceil(count/width),attachmentData=new Float32Array(width*attachmentHeight);attachmentData.set(attachmentWeights);
 const attachmentTexture=new THREE.DataTexture(attachmentData,width,attachmentHeight,THREE.RedFormat,THREE.FloatType);attachmentTexture.minFilter=attachmentTexture.magFilter=THREE.NearestFilter;attachmentTexture.generateMipmaps=false;attachmentTexture.needsUpdate=true;
 const atlas=new THREE.DataArrayTexture(atlasData,width,height,nc*2);atlas.format=THREE.RGBAFormat;atlas.type=THREE.HalfFloatType;atlas.minFilter=atlas.magFilter=THREE.NearestFilter;atlas.generateMipmaps=false;atlas.needsUpdate=true;
 const material=viewer.splatMesh.material,amounts=new Float32Array(nc);
 Object.assign(material.uniforms,{nativeFields:{value:atlas},nativeWeights:{value:amounts},nativeSize:{value:new THREE.Vector2(width,height)},headPose:{value:new THREE.Vector2()},headAttachment:{value:attachmentTexture},attachmentSize:{value:new THREE.Vector2(width,attachmentHeight)},headPivot:{value:new THREE.Vector3(...neck.pivot)}});
 material.vertexShader=`uniform highp sampler2DArray nativeFields;uniform float nativeWeights[${nc}];uniform vec2 nativeSize;uniform vec2 headPose;uniform sampler2D headAttachment;uniform vec2 attachmentSize;uniform vec3 headPivot;\n`+material.vertexShader;
 const anchor='vec3 splatCenter = uintBitsToFloat(uvec3(sampledCenterColor.gba));';
 if(!material.vertexShader.includes(anchor))throw Error('Native facial shader center hook changed');
 material.vertexShader=material.vertexShader.replace(anchor,anchor+`
 uint aw=uint(attachmentSize.x);vec2 attachmentUV=(vec2(float(splatIndex%aw),float(splatIndex/aw))+.5)/attachmentSize;
 float headWeight=texture(headAttachment,attachmentUV).r;
 vec3 nativeColor=vec3(0.0);
 if(splatIndex>=uint(${start})&&splatIndex<uint(${count})){
  uint ni=splatIndex-uint(${start}),nw=uint(nativeSize.x);vec2 nuv=(vec2(float(ni%nw),float(ni/nw))+.5)/nativeSize;
  for(int c=0;c<${nc};c++){float weight=nativeWeights[c]*headWeight;if(abs(weight)>.0001){splatCenter+=weight*texture(nativeFields,vec3(nuv,float(c*2))).xyz;nativeColor+=weight*texture(nativeFields,vec3(nuv,float(c*2+1))).rgb;}}
 }
 // Semantic head/skin-neck weights; torso remains fixed. Rotate each local
 // Gaussian frame rigidly so the transition cannot turn into stretched streaks.
 vec2 localPose=headPose*headWeight;
 float hy=sin(localPose.x),cy=cos(localPose.x),hp=sin(localPose.y),cp=cos(localPose.y);
 mat3 headDeformation=mat3(cy,0.0,-hy,0.0,1.0,0.0,hy,0.0,cy)*mat3(1.0,0.0,0.0,0.0,cp,hp,0.0,-hp,cp);
 if(headWeight>0.0)splatCenter=headPivot+headDeformation*(splatCenter-headPivot);`);
 const colorAnchor='vColor = uintToRGBAVec(sampledCenterColor.r);',covarianceAnchor='mat3 cov2Dm = transpose(T) * Vrk * T;';
 if(!material.vertexShader.includes(colorAnchor)||!material.vertexShader.includes(covarianceAnchor))throw Error('Native facial shader hook changed');
 material.vertexShader=material.vertexShader.replace(colorAnchor,colorAnchor+'vColor.rgb=clamp(vColor.rgb+nativeColor,0.0,1.0);').replace(covarianceAnchor,'Vrk=headDeformation*Vrk*transpose(headDeformation);'+covarianceAnchor);material.needsUpdate=true;
 const rest=new Float32Array(count*4),positions=new Float32Array(count*4),indexes=new Uint32Array(count),point=new THREE.Vector3(),scene=viewer.splatMesh.getScene(0),headIds=[];
 for(let i=0;i<count;i++){scene.splatBuffer.getSplatCenter(i,point);rest.set([point.x,point.y,point.z,1],i*4);if(attachmentWeights[i]>0)headIds.push(i)}
 let old=Array(nc).fill(-1),oldYaw=100,oldPitch=100,presentedLatency=0,presentedSampleTime=null;
 const queue=createPoseSortQueue({
  async sort(pose){
   // A camera-triggered sort may still be finishing during initial setup.
   if(viewer.sortRunning&&viewer.sortPromise)await viewer.sortPromise;
   positions.set(rest);
   for(let c=0;c<nc;c++){
    const w=pose.weights[c];if(Math.abs(w)<.0001)continue;const field=raw[c],ids=active[c];
    for(let k=0;k<ids.length;k++){const j=ids[k],at=(start+j)*4,influence=w*attachmentWeights[start+j];positions[at]+=influence*field[j*3];positions[at+1]+=influence*field[j*3+1];positions[at+2]+=influence*field[j*3+2]}
   }
   turnAttachedCenters(positions,attachmentWeights,neck.pivot,pose.yaw,pose.pitch,headIds);
   viewer.camera.updateMatrixWorld(true);
   // The vendored viewer skips stationary-camera sorts unless explicitly forced.
   // Queue centers immediately before that full sort, not independently of it.
   viewer.preSortMessages.push({centers:positions.buffer,sceneIndexes:indexes.buffer,range:{from:0,count}});
   const started=await viewer.runSplatSort(true,true);
   if(!started||!viewer.sortPromise)throw Error('Animated portrait depth sort unavailable');
   await viewer.sortPromise;
  },
  present(pose){
   // The worker installed these exact sorted indexes before resolving its promise.
   amounts.set(pose.weights);material.uniforms.headPose.value.set(pose.yaw,pose.pitch);
   presentedLatency=performance.now()-pose.requestedAt;
   presentedSampleTime=pose.sampleTime;
   viewer.forceRenderNextFrame();
  },
  onError(error){console.error('Portrait pose sorting failed:',error)}
 });
 return {
  update(weights,yaw,pitch,sampleTime=null){
   if(!weights.some((w,i)=>Math.abs(w-old[i])>.002)&&Math.abs(yaw-oldYaw)<.0001&&Math.abs(pitch-oldPitch)<.0001)return;
   old=weights.slice();oldYaw=yaw;oldPitch=pitch;
   queue.submit({weights:weights.slice(),yaw,pitch,sampleTime,requestedAt:performance.now()});
  },
  status:()=>({...queue.status(),latencyMs:Math.round(presentedLatency),sampleTime:presentedSampleTime,presentedSpeech:Object.fromEntries(channels.map((name,i)=>[name,+amounts[i].toFixed(3)]).filter(([name])=>name.startsWith('speech')))}),
  async ready(){await queue.idle();const error=queue.status().error;if(error)throw Error(error)},
  async dispose(){await queue.dispose();atlas.dispose();attachmentTexture.dispose()}
 };
}
