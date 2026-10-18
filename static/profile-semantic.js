export class ProfileSemantic {
 constructor(cards){this.cards=cards;this.sequence=0;this.pending=new Map();this.ready=false;}
 prepare(){
  if(this.preparing)return this.preparing;
  this.worker=new Worker(new URL('./profile-semantic-worker.js',import.meta.url),{type:'module'});
  this.worker.onmessage=({data})=>{
   const call=this.pending.get(data.id);if(!call)return;this.pending.delete(data.id);call.cleanup();
   if(data.type==='error')call.reject(new Error(data.error));else call.resolve(data);
  };
  this.worker.onerror=()=>{this.fail(new Error('Encoder unavailable'));this.worker?.terminate();this.worker=null;this.ready=false;this.preparing=null;};
  const worker=this.worker;
  this.preparing=this.call('init',{cards:this.cards.map(({id,questions})=>({id,questions}))}).then(()=>{if(this.worker===worker)this.ready=true;return true}).catch(error=>{
   if(this.worker===worker){this.ready=false;this.preparing=null;worker.terminate();this.worker=null;this.fail(error);}
   throw error;
  });
  return this.preparing;
 }
 call(type,data={},signal){
  return new Promise((resolve,reject)=>{
   const id=++this.sequence;
   const cancel=()=>{this.pending.delete(id);reject(new DOMException('Stopped','AbortError'));};
   if(signal?.aborted){cancel();return;}
   const cleanup=()=>signal?.removeEventListener('abort',cancel);
   this.pending.set(id,{resolve,reject,cleanup});signal?.addEventListener('abort',cancel,{once:true});
   this.worker.postMessage({id,type,...data});
  });
 }
 async rank(question,signal){if(!this.ready)return [];return (await this.call('rank',{question},signal)).ranking;}
 fail(error){for(const call of this.pending.values()){call.cleanup();call.reject(error)}this.pending.clear();}
 destroy(){this.worker?.terminate();this.worker=null;this.ready=false;this.preparing=null;this.fail(new DOMException('Stopped','AbortError'));}
}
