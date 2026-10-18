import test from 'node:test';
import assert from 'node:assert/strict';
import {ProfileSemantic} from '../static/profile-semantic.js';
function setup(t){
 const instances=[];
 class Worker{
  constructor(){this.messages=[];instances.push(this)}
  postMessage(data){this.messages.push(data)}
  terminate(){this.terminated=true}
  reply(data,index=this.messages.length-1){this.onmessage({data:{id:this.messages[index].id,...data}})}
 }
 const old=globalThis.Worker;globalThis.Worker=Worker;t.after(()=>{globalThis.Worker=old});
 return {instances,semantic:new ProfileSemantic([{id:'intro',questions:'Who are you?'}])};
}
test('chat works before warmup, retries failed initialization, then ranks locally',async t=>{
 const {semantic,instances}=setup(t);t.after(()=>semantic.destroy());
 assert.deepEqual(await semantic.rank('hello'),[]);
 const failed=semantic.prepare();instances[0].reply({type:'error',error:'Download interrupted'});
 await assert.rejects(failed,/interrupted/);assert.equal(instances[0].terminated,true);
 const ready=semantic.prepare();instances[1].reply({type:'ready'});await ready;assert.equal(semantic.ready,true);
 const ranked=semantic.rank('background');instances[1].reply({type:'ranking',ranking:[{id:'intro',score:.8}]});
 assert.deepEqual(await ranked,[{id:'intro',score:.8}]);
});
test('stop rejects the caller and a late inference result cannot revive it',async t=>{
 const {semantic,instances}=setup(t);t.after(()=>semantic.destroy());
 const ready=semantic.prepare();instances[0].reply({type:'ready'});await ready;
 const controller=new AbortController(),request=semantic.rank('agents',controller.signal);
 controller.abort();await assert.rejects(request,{name:'AbortError'});
 instances[0].reply({type:'ranking',ranking:[{id:'intro',score:1}]});
 assert.equal(semantic.pending.size,0);
});
test('a page exit during warmup cannot mark a replacement worker ready',async t=>{
 const {semantic,instances}=setup(t);t.after(()=>semantic.destroy());
 const first=semantic.prepare();semantic.destroy();const next=semantic.prepare();
 await assert.rejects(first,{name:'AbortError'});assert.equal(semantic.ready,false);
 instances[1].reply({type:'ready'});await next;assert.equal(semantic.ready,true);
});
