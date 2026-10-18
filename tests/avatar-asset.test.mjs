import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {nativeExpressionWeights,turnAttachedCenters} from '../static/portrait-behavior.js';
const root=new URL('../static/avatar-omg/',import.meta.url);
const meta=JSON.parse(readFileSync(new URL('model.json',root),'utf8'));

test('exported 3D model and native field correspondence survives compression',()=>{
 const ply=readFileSync(new URL('portrait.ply',root));
 assert.deepEqual(gunzipSync(readFileSync(new URL('portrait.ply.gz',root))),ply);
 assert.equal(createHash('sha256').update(ply).digest('hex'),meta.sourceSha256);
 const end=ply.indexOf(Buffer.from('end_header\n'))+11,header=ply.subarray(0,end).toString();
 assert.match(header,new RegExp(`element vertex ${meta.count}\\n`));
 const properties=[...header.matchAll(/property float (\w+)/g)].map(m=>m[1]);
 assert.equal(end+meta.count*properties.length*4,ply.length);
 for(const sentinel of meta.sentinels)for(let axis=0;axis<3;axis++){
  const offset=end+(sentinel.index*properties.length+properties.indexOf(['x','y','z'][axis]))*4;
  assert.ok(Math.abs(ply.readFloatLE(offset)-sentinel.xyz[axis])<1e-6);
 }
 const fields=readFileSync(new URL('expressions.bin',root));
 assert.deepEqual(gunzipSync(readFileSync(new URL('expressions.bin.gz',root))),fields);
 assert.equal(fields.length,meta.headCount*meta.channels.length*6*2);
 assert.equal(meta.headStart+meta.headCount,meta.count);
 assert.ok(meta.count<200000,'browser geometry stays below the previous portrait count');
});
test('jaw and eyeball controls contain real 3D displacement and neural appearance changes',()=>{
 const b=readFileSync(new URL('expressions.bin',root));
 for(const name of ['jawOpen','gazeLeft','gazeRight','blink']){
  const channel=meta.channels.indexOf(name);assert.ok(channel>=0);
  let maxMotion=0,maxColor=0;
  for(let j=0;j<meta.headCount;j++){
   const offset=(channel*meta.headCount+j)*12;
   for(let k=0;k<3;k++)maxMotion=Math.max(maxMotion,Math.abs(b.readInt16LE(offset+k*2)/32767*meta.scales[k]));
   for(let k=3;k<6;k++)maxColor=Math.max(maxColor,Math.abs(b.readInt16LE(offset+k*2)/32767*meta.scales[k]));
  }
  assert.ok(maxMotion>.001&&maxMotion<.05,name+' is a bounded 3D motion');
  assert.ok(maxColor>.02,name+' includes decoded appearance, not only geometry');
 }
});
test('dedicated speech poses animate geometry without repainting the upper face',()=>{
 const bytes=readFileSync(new URL('expressions.bin',root)),ply=readFileSync(new URL('portrait.ply',root));
 const end=ply.indexOf(Buffer.from('end_header\n'))+11;
 const stride=[...ply.subarray(0,end).toString().matchAll(/property float (\w+)/g)].length*4;
 assert.equal(meta.speechRig.channels.length,7);
 for(const name of meta.speechRig.channels){
  const c=meta.channels.indexOf(name);assert.ok(c>=0);let motion=0,mouthAppearance=0;
  for(let j=0;j<meta.headCount;j++){
   const i=meta.headStart+j,at=(c*meta.headCount+j)*12;
   const y=ply.readFloatLE(end+i*stride+4),z=ply.readFloatLE(end+i*stride+8);
   const sourceV=.5-(y+.025)*6/(meta.camera.distance-z-.05);
   for(let k=0;k<3;k++)motion=Math.max(motion,Math.abs(bytes.readInt16LE(at+k*2)/32767*meta.scales[k]));
   for(let k=3;k<6;k++){
    const pigment=bytes.readInt16LE(at+k*2);
    if(sourceV<.56)assert.equal(pigment,0,name+' must not recolor eyes or forehead');
    mouthAppearance=Math.max(mouthAppearance,Math.abs(pigment));
   }
  }
  assert.ok(motion>.0001&&motion<.03,name+' stays within the calibrated speech displacement range');
  assert.ok(mouthAppearance>100,name+' has its own decoded mouth appearance');
 }
});
test('speech geometry distinguishes rounded vowels, open vowels and closed lips',()=>{
 const bytes=readFileSync(new URL('expressions.bin',root)),ply=readFileSync(new URL('portrait.ply',root));
 const end=ply.indexOf(Buffer.from('end_header\n'))+11;
 const stride=[...ply.subarray(0,end).toString().matchAll(/property float (\w+)/g)].length*4;
 const point=(name,key)=>{
  const i=meta.speechRig.mouthAnchors[key],c=meta.channels.indexOf(name),at=(c*meta.headCount+i-meta.headStart)*12;
  return [0,1,2].map(k=>ply.readFloatLE(end+i*stride+k*4)+bytes.readInt16LE(at+k*2)/32767*meta.scales[k]);
 };
 const width=name=>point(name,'right')[0]-point(name,'left')[0];
 const gap=name=>point(name,'upper')[1]-point(name,'lower')[1];
 assert.ok(width('speechOO')<.75*width('speechEE'),'O must not be another spread smile');
 assert.ok(width('speechUU')<width('speechOO'),'U has visibly pursed lips');
 assert.ok(gap('speechAA')>.012&&gap('speechAA')>2*gap('speechDD'),'A needs a real open aperture');
 assert.ok(gap('speechPP')<.001,'bilabials must close the lip boundary');
 const cavity=meta.speechRig.cavity;
 assert.ok(cavity.count>=1000&&cavity.count<2500);
 assert.equal(cavity.start+cavity.count,meta.count);
 const attachment=readFileSync(new URL('attachment.bin',root));let minZ=Infinity,maxZ=-Infinity;
 for(let i=cavity.start;i<meta.count;i++){
  assert.equal(attachment.readFloatLE(i*4),1,'oral interior follows the head');
  const z=ply.readFloatLE(end+i*stride+8);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
 }
 assert.ok(maxZ-minZ>.002,'the recessed interior is curved 3D geometry');
});
test('a closed blink suppresses conflicting iris poses',()=>{
 const a=nativeExpressionWeights({blink:1,gazeX:1,gazeY:-1});
 assert.equal(a.blink,1);
 for(const name of ['gazeLeft','gazeRight','gazeUp','gazeDown'])assert.equal(a[name],0);
});

test('beard edge follows its native jaw anchors and keeps its pigment',()=>{
 const binding=meta.beardBinding,b=readFileSync(new URL('expressions.bin',root));
 assert.ok(binding.count>0,'outer beard must belong to the dynamic face range');
 assert.equal(binding.start,meta.headStart);
 assert.equal(binding.start+binding.count,binding.nativeStart);
 const value=(channel,index,component)=>b.readInt16LE(((channel*meta.headCount+index-meta.headStart)*6+component)*2)/32767*meta.scales[component];
 let jawMotion=0;
 for(const sample of binding.samples){
  assert.ok(sample.index>=binding.start&&sample.index<binding.nativeStart);
  assert.ok(Math.abs(sample.drivers.reduce((sum,p)=>sum+p.weight,0)-1)<1e-6);
  for(let c=0;c<meta.channels.length;c++){
   const active=binding.channels.includes(meta.channels[c]);
   for(let k=0;k<3;k++){
    const expected=active?sample.drivers.reduce((sum,p)=>sum+p.weight*value(c,p.index,k),0):0;
    assert.ok(Math.abs(value(c,sample.index,k)-expected)<3.2e-6,meta.channels[c]+' must move the beard with its facial anchors');
    if(meta.channels[c]==='jawOpen')jawMotion=Math.max(jawMotion,Math.abs(value(c,sample.index,k)));
   }
   for(let k=3;k<6;k++)assert.equal(value(c,sample.index,k),0,'hair pigment stays attached instead of cross-fading in place');
  }
 }
 assert.ok(jawMotion>.004,'the outer beard cannot remain frozen when the jaw opens');
});


test('anatomical attachments keep the beard rigid and lock the torso',()=>{
 const bytes=readFileSync(new URL('attachment.bin',root)),weights=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.length/4);
 assert.deepEqual(gunzipSync(readFileSync(new URL('attachment.bin.gz',root))),bytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.neckAttachment.sha256);
 assert.equal(weights.length,meta.count);
 assert.ok(weights.every(w=>Number.isFinite(w)&&w>=0&&w<=1));
 for(let i=meta.beardBinding.start;i<meta.beardBinding.nativeStart;i++)assert.equal(weights[i],1);
 const ply=readFileSync(new URL('portrait.ply',root)),end=ply.indexOf(Buffer.from('end_header\n'))+11;
 const properties=[...ply.subarray(0,end).toString().matchAll(/property float (\w+)/g)].map(m=>m[1]);
 const get=(i,axis)=>ply.readFloatLE(end+(i*properties.length+properties.indexOf(axis))*4);
 const centers=new Float32Array(meta.count*4),ids=Array.from({length:meta.count},(_,i)=>i);let torsoCount=0;
 for(let i=0;i<meta.count;i++){
  const x=get(i,'x'),y=get(i,'y'),z=get(i,'z');centers.set([x,y,z,1],i*4);
  const beard=i>=meta.beardBinding.start&&i<meta.beardBinding.nativeStart;
  if(!beard&&(y<-.18||(Math.abs(x)>.12&&y<-.10))){assert.equal(weights[i],0,'outer shoulders must not inherit head motion');torsoCount++;}
 }
 assert.ok(torsoCount>5000);
 for(const yaw of [-15,15])for(const pitch of [-4,4]){
  const out=centers.slice();turnAttachedCenters(out,weights,meta.neckAttachment.pivot,yaw*Math.PI/180,pitch*Math.PI/180,ids);
  for(let i=0;i<meta.count;i++)if(weights[i]===0)assert.deepEqual(out.subarray(i*4,i*4+4),centers.subarray(i*4,i*4+4));
 }
});
