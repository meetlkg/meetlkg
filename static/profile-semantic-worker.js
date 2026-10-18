let ready, extractor, cards, vectors, dimensions;
async function initialize(items){
 const {pipeline,env}=await import('./vendor/transformers/transformers.min.js');
 env.allowRemoteModels=false;
 env.localModelPath=new URL('./models/',import.meta.url).href;
 env.backends.onnx.wasm.wasmPaths=new URL('./vendor/transformers/',import.meta.url).href;
 env.backends.onnx.wasm.numThreads=1;
 env.backends.onnx.wasm.proxy=false;
 extractor=await pipeline('feature-extraction','profile-minilm',{quantized:true});
 cards=items;vectors=[];
 for(let offset=0;offset<cards.length;offset+=8){
  const batch=cards.slice(offset,offset+8);
  const output=await extractor(batch.map(c=>c.questions),{pooling:'mean',normalize:true});
  dimensions=output.dims.at(-1);
  for(let i=0;i<batch.length;i++)vectors.push(Float32Array.from(output.data.slice(i*dimensions,(i+1)*dimensions)));
 }
}
let queue=Promise.resolve();
self.onmessage=({data})=>{
 queue=queue.then(async()=>{
  try{
   if(data.type==='init'){
    ready??=initialize(data.cards).catch(error=>{ready=null;throw error});await ready;
    self.postMessage({id:data.id,type:'ready',dimensions,documents:cards.length});
   }else if(data.type==='rank'){
    if(!ready)throw new Error('Encoder not ready');await ready;
    const output=await extractor(data.question,{pooling:'mean',normalize:true});
    const ranking=vectors.map((vector,index)=>({id:cards[index].id,score:vector.reduce((sum,value,i)=>sum+value*output.data[i],0)})).sort((a,b)=>b.score-a.score);
    self.postMessage({id:data.id,type:'ranking',ranking});
   }
  }catch(error){self.postMessage({id:data.id,type:'error',error:error.message});}
 });
};
