// A pose is visible only after its exact centers have completed a full depth sort.
// Keep one in-flight pose and the latest request; do not build an animation backlog.
export function createPoseSortQueue({sort,present,onError=console.error}){
 let pending=null,running=false,disposed=false,task=Promise.resolve(),requested=0,presented=0,error=null;
 async function drain(){
  running=true;
  try{
   while(pending&&!disposed){
    const item=pending;pending=null;
    await sort(item.pose);
    if(disposed)break;
    present(item.pose);presented=item.revision;error=null;
   }
  }catch(reason){pending=null;error=String(reason?.message||reason);onError(reason)}
  finally{running=false}
 }
 return {
  submit(pose){if(disposed)return;pending={pose,revision:++requested};if(!running)task=drain()},
  idle(){return task},
  status(){return {requested,presented,sorting:running,pending:!!pending,error}},
  async dispose(){disposed=true;pending=null;await task}
 };
}
