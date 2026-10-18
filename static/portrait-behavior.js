import {speechChannels} from './portrait-speech.js?v=speech-20261018-7b';
import {neuralSpeechChannels} from './portrait-neural-speech.js?v=speech-20261018-7b';
export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function portraitHeadTarget(manualYaw,gazeX=0,gazeY=0,nod=0){
 return {yaw:clamp(manualYaw+gazeX*10,-15,15),pitch:clamp(gazeY*4+nod,-4,4)};
}
// Locally rigid skinning: rotate each Gaussian without stretching its covariance.
// A zero attachment keeps torso centers exactly unchanged at every head angle.
export function turnAttachedCenters(positions,weights,pivot,yaw,pitch,ids){
 const sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch);
 for(const i of ids){
  const w=weights[i];if(w===0)continue;
  const a=i*4,x=positions[a]-pivot[0],y=positions[a+1]-pivot[1],z=positions[a+2]-pivot[2];
  const sY=w===1?sy:Math.sin(yaw*w),cY=w===1?cy:Math.cos(yaw*w),sP=w===1?sp:Math.sin(pitch*w),cP=w===1?cp:Math.cos(pitch*w);
  const ry=cP*y-sP*z,rz=sP*y+cP*z;
  positions[a]=pivot[0]+cY*x+sY*rz;positions[a+1]=pivot[1]+ry;positions[a+2]=pivot[2]-sY*x+cY*rz;
 }
}
export function cameraPose(yaw=0,pitch=0,distance=.95){
 yaw=clamp(yaw,-15,15);pitch=clamp(pitch,-4,4);
 const a=yaw*Math.PI/180,p=pitch*Math.PI/180,r=distance;
 return {yaw,pitch,target:[0,-.025,-.05],position:[r*Math.sin(a)*Math.cos(p),-.025+r*Math.sin(p),-.05+r*Math.cos(a)*Math.cos(p)]};
}
export function gazeTarget(x,y,rect,viewportWidth,viewportHeight){
 const eyeX=rect.left+rect.width*.5,eyeY=rect.top+rect.height*.39;
 return {x:clamp((x-eyeX)/Math.max(240,viewportWidth*.46),-1,1),y:clamp((y-eyeY)/Math.max(200,viewportHeight*.48),-1,1)};
}
export function clickableTarget(target){return target?.closest?.('a[href],button:not(:disabled),summary,input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[role="button"]')??null}
// Bound the *combined* head/camera view, including frames during manual turns.
export function boundHeadPose(yaw,pitch,cameraYaw,cameraPitch=0){
 return {yaw:clamp(clamp(yaw,-10,10),cameraYaw-15,cameraYaw+15),pitch:clamp(clamp(pitch,-4,4),-4-cameraPitch,4-cameraPitch)};
}

// Mouth shapes use the existing HeadTTS viseme names; eye states are exclusive
// on each axis and do not move a photograph over the eye surface.
export function nativeExpressionWeights({blink=0,interest=0,gazeX=0,gazeY=0,viseme='sil',mouth=null,speaking=false,paused=false}={}){
 const weights={blink:0,interested:0,browLift:0,jawOpen:0,mouthWide:0,mouthRound:0,lipPress:0,gazeLeft:0,gazeRight:0,gazeUp:0,gazeDown:0};
 for(const channel of speechChannels)weights[channel]=0;
 for(const channel of neuralSpeechChannels)weights[channel]=0;
 if(paused)return weights;
 weights.blink=clamp(blink,0,1);weights.interested=clamp(interest,0,1)*.75;
 const open=1-weights.blink;weights.gazeLeft=clamp(-gazeX,0,1)*open;weights.gazeRight=clamp(gazeX,0,1)*open;weights.gazeUp=clamp(-gazeY,0,1)*open;weights.gazeDown=clamp(gazeY,0,1)*open;
 if(speaking&&mouth){
  if(mouth.neural){
   weights.interested=0;
   weights.browLift=clamp((mouth.performance?.brow||0)+interest*.16,0,.5);
   // These are signed motion components, not mutually exclusive visemes.
   for(const channel of neuralSpeechChannels){const value=mouth.neural[channel];weights[channel]=Number.isFinite(value)?clamp(value,-1.5,1.5):0;}
   return weights;
  }
  weights.interested*=.12*(1-clamp(mouth.lipPress||0,0,1));
  if(mouth.articulation){
   weights.interested=0; // Do not overlay a hover-smile onto authored speech lips.
   let total=0;
   for(const channel of speechChannels){weights[channel]=clamp(mouth.articulation[channel]||0,0,1);total+=weights[channel];}
   if(total>1)for(const channel of speechChannels)weights[channel]/=total;
   return weights;
  }
  for(const key of ['jawOpen','mouthWide','mouthRound','lipPress'])weights[key]=clamp(mouth[key]||0,0,1);
  return weights;
 }
 if(speaking&&viseme!=='sil'){
  weights.interested*=.3;
  if(viseme==='PP')weights.lipPress=.8;
  else if(['O','U','RR'].includes(viseme))weights.mouthRound=viseme==='U'?.65:.85;
  else if(['E','I','SS','CH'].includes(viseme)){weights.mouthWide=.65;weights.jawOpen=.12;}
  else if(viseme==='aa')weights.jawOpen=.85;
  else if(['FF','TH'].includes(viseme)){weights.lipPress=.20;weights.mouthWide=.20;weights.jawOpen=.12;}
  else weights.jawOpen=.28;
 }
 return weights;
}
