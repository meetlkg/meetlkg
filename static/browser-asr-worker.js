// Whisper's q8 decoder export needs the stable v3 ONNX runtime; the v4 QDQ
// optimizer currently rejects its transposed embedding scale.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
env.allowLocalModels=false;
// One WASM thread avoids requiring cross-origin isolation for the portfolio.
env.backends.onnx.wasm.numThreads=1;
let transcriber;
self.onmessage=async({data})=>{
  try{
    if(data.type==='init'){
      transcriber=await pipeline('automatic-speech-recognition','onnx-community/whisper-tiny.en',{
        dtype:'q8',device:'wasm',
        progress_callback:progress=>self.postMessage({id:data.id,type:'progress',progress})
      });
      self.postMessage({id:data.id,type:'ready'});
    }else if(data.type==='transcribe'){
      const result=await transcriber(data.audio,{max_new_tokens:96});
      self.postMessage({id:data.id,type:'result',text:result.text.trim()});
    }
  }catch(error){self.postMessage({id:data.id,type:'error',error:error.message||'Local speech recognition failed.'});}
};
