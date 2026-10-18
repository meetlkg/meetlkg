import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraPose,gazeTarget,boundHeadPose,portraitHeadTarget,turnAttachedCenters} from '../static/portrait-behavior.js';

test('arbitrarily large rotation input cannot expose the back or underside',()=>{
 for(const yaw of [-1e6,-180,-90,-20,-15,0,15,20,90,180,1e6])for(const pitch of [-90,-20,0,20,90]){
  const p=cameraPose(yaw,pitch);
  assert.ok(Math.abs(p.yaw)<=15);assert.ok(Math.abs(p.pitch)<=4);
  const relative=p.position.map((v,i)=>v-p.target[i]);
  const actualYaw=Math.atan2(relative[0],relative[2])*180/Math.PI;
  const actualPitch=Math.atan2(relative[1],Math.hypot(relative[0],relative[2]))*180/Math.PI;
  assert.ok(Math.abs(actualYaw)<=15+1e-9);assert.ok(Math.abs(actualPitch)<=4+1e-9);
  assert.ok(relative[2]>0,'camera must remain in front');
 }
});
test('eyes look toward the pointer relative to the face and remain bounded',()=>{
 const box={left:800,top:150,width:500,height:450};
 const neutral=gazeTarget(1050,325.5,box,1600,900);
 assert.deepEqual(neutral,{x:0,y:0});
 assert.ok(gazeTarget(200,325.5,box,1600,900).x<0);
 assert.ok(gazeTarget(1500,325.5,box,1600,900).x>0);
 assert.ok(gazeTarget(1050,0,box,1600,900).y<0);
 assert.ok(gazeTarget(1050,900,box,1600,900).y>0);
 for(const x of [-1e6,1e6])for(const y of [-1e6,1e6]){
  const g=gazeTarget(x,y,box,1600,900);assert.equal(Math.abs(g.x),1);assert.equal(Math.abs(g.y),1);
 }
});

test('head tracking and manual camera movement share a single exposure limit',()=>{
 for(const cameraYaw of [-15,-10,0,10,15])for(const cameraPitch of [-4,0,1.2,4])for(const desiredYaw of [-100,-10,0,10,100])for(const desiredPitch of [-20,-4,0,4,20]){
  const p=boundHeadPose(desiredYaw,desiredPitch,cameraYaw,cameraPitch);
  assert.ok(Math.abs(p.yaw-cameraYaw)<=15);
  assert.ok(Math.abs(p.pitch+cameraPitch)<=4);
  assert.ok(Math.abs(p.yaw)<=10);assert.ok(Math.abs(p.pitch)<=4);
 }
 assert.ok(boundHeadPose(-8,0,0).yaw<0);
 assert.ok(boundHeadPose(8,0,0).yaw>0);
});

test('native mouth shapes distinguish vowels and closed lips without opposing eye poses',async()=>{
 const {nativeExpressionWeights:weights}=await import('../static/portrait-behavior.js');
 const aa=weights({speaking:true,viseme:'aa'}),ee=weights({speaking:true,viseme:'E'}),o=weights({speaking:true,viseme:'O'}),m=weights({speaking:true,viseme:'PP'});
 assert.ok(aa.jawOpen>.5&&aa.mouthWide===0);
 assert.ok(ee.mouthWide>.5&&ee.mouthRound===0);
 assert.ok(o.mouthRound>.5&&o.mouthWide===0);
 assert.ok(m.lipPress>.5&&m.jawOpen===0);
 for(const v of ['aa','E','I','O','U','PP','FF','TH','DD','SS','sil']){
  const a=weights({speaking:true,viseme:v,gazeX:5,gazeY:-5});
  assert.ok(a.jawOpen+a.mouthWide+a.mouthRound+a.lipPress<=1);
  assert.equal(a.gazeLeft,0);assert.equal(a.gazeRight,1);assert.equal(a.gazeUp,1);assert.equal(a.gazeDown,0);
 }
 assert.ok(Object.values(weights({paused:true,blink:1,interest:1,gazeX:1,viseme:'aa',speaking:true})).every(v=>v===0));
});


test('manual turns and cursor tracking stay within one head-angle limit',()=>{
 for(const manual of [-1e6,-15,0,15,1e6])for(const x of [-100,-1,0,1,100])for(const y of [-100,-1,0,1,100]){
  const head=portraitHeadTarget(manual,x,y,1.2);
  assert.ok(Math.abs(head.yaw)<=15);assert.ok(Math.abs(head.pitch)<=4);
 }
 assert.equal(portraitHeadTarget(15,1).yaw,15);
 assert.equal(portraitHeadTarget(-15,-1).yaw,-15);
});
test('neck attachments rotate locally without stretching or moving the torso',()=>{
 const pivot=[0,-.151,-.1],input=new Float32Array([.15,-.14,-.08,1,.025,-.15,-.08,1,.03,-.12,-.02,1]),weights=[0,.5,1];
 for(const yaw of [-15,0,15])for(const pitch of [-4,0,4]){
  const out=input.slice();turnAttachedCenters(out,weights,pivot,yaw*Math.PI/180,pitch*Math.PI/180,[0,1,2]);
  assert.deepEqual(out.subarray(0,4),input.subarray(0,4));
  for(let i=1;i<3;i++){
   const before=Math.hypot(...Array.from(input.subarray(i*4,i*4+3),(x,k)=>x-pivot[k]));
   const after=Math.hypot(...Array.from(out.subarray(i*4,i*4+3),(x,k)=>x-pivot[k]));
   assert.ok(Math.abs(after-before)<1e-7,'local skinning preserves distance to the neck pivot');
  }
 }
});
