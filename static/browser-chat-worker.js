// Inference stays inside this worker. Only public model assets are downloaded.
let engine,generator,TextStreamer,stopping;
let generating=false;
self.onmessage=async ({data})=>{
  const {id,type}=data;
  if(type==='cancel'){engine?.interruptGenerate();stopping?.interrupt();return;}
  try{
    if(type==='init'){
      if(data.backend==='wasm'){
        const runtime=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0/dist/transformers.min.js');
        runtime.env.allowLocalModels=false;runtime.env.backends.onnx.wasm.numThreads=1;
        TextStreamer=runtime.TextStreamer;stopping=new runtime.InterruptableStoppingCriteria();
        generator=await runtime.pipeline('text-generation','HuggingFaceTB/SmolLM2-135M-Instruct',{
          dtype:'q8',device:'wasm',progress_callback:progress=>self.postMessage({id,type:'progress',progress})
        });
      }else{
        const {CreateMLCEngine}=await import('./vendor/webllm/webllm.js');
        engine=await CreateMLCEngine(data.model||'SmolLM2-360M-Instruct-q4f16_1-MLC',{
          initProgressCallback:progress=>self.postMessage({id,type:'progress',progress})
        },{context_window_size:2048});
      }
      self.postMessage({id,type:'ready'});
    }else if(type==='chat'){
      if((!engine&&!generator)||generating)throw new Error('Please wait for the current reply.');
      generating=true;let answer='';
      try{
        if(generator){
          stopping.reset();
          const streamer=new TextStreamer(generator.tokenizer,{skip_prompt:true,skip_special_tokens:true,callback_function:delta=>{answer+=delta;self.postMessage({id,type:'delta',delta});}});
          await generator(data.messages,{max_new_tokens:160,do_sample:false,repetition_penalty:1.08,streamer,stopping_criteria:[stopping]});
        }else{
          const stream=await engine.chat.completions.create({messages:data.messages,stream:true,max_tokens:180,temperature:.15,repetition_penalty:1.05});
          for await(const chunk of stream){
            const delta=chunk.choices[0]?.delta?.content||'';
            answer+=delta;if(delta)self.postMessage({id,type:'delta',delta});
          }
        }
        answer=answer.trim();
        if(!answer)throw new Error('No reply was generated. Please try a shorter question.');
        // Avoid speaking a trailing fragment if the model reaches its token cap.
        if(!/[.!?]$/.test(answer)){
          const end=[...answer.matchAll(/[.!?](?=\s|$)/g)].at(-1);
          if(end)answer=answer.slice(0,end.index+1);
        }
        self.postMessage({id,type:'answer',answer});
      }finally{generating=false;}
    }
  }catch(error){self.postMessage({id,type:'error',error:error.message||'Browser inference failed.'});}
};
