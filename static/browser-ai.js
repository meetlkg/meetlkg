export class BrowserChat {
  constructor(){this.worker=new Worker(new URL('./browser-chat-worker.js',import.meta.url),{type:'module'});this.pending=new Map();this.sequence=0;
    this.worker.onmessage=({data})=>{
      const call=this.pending.get(data.id);if(!call)return;
      if(data.type==='progress'){call.progress?.(data.progress);return;}
      if(data.type==='delta'){call.delta?.(data.delta);return;}
      this.pending.delete(data.id);call.cleanup?.();
      if(data.type==='error')call.reject(new Error(data.error));else call.resolve(data.answer);
    };
    this.worker.onerror=()=>this.fail(new Error('The browser model worker stopped. Reload the model to retry.'));
  }
  call(type,data={},handlers={},signal){
    const id=++this.sequence;
    return new Promise((resolve,reject)=>{
      const cancel=()=>{this.worker.postMessage({type:'cancel'});this.pending.delete(id);reject(new DOMException('Stopped','AbortError'));};
      if(signal?.aborted){reject(new DOMException('Stopped','AbortError'));return;}
      this.pending.set(id,{resolve,reject,...handlers,cleanup:()=>signal?.removeEventListener('abort',cancel)});
      signal?.addEventListener('abort',cancel,{once:true});this.worker.postMessage({id,type,...data});
    });
  }
  init(progress,model,backend){return this.call('init',{model,backend}, {progress});}
  answer(messages,delta,signal){return this.call('chat',{messages},{delta},signal);}
  fail(error){for(const call of this.pending.values()){call.cleanup?.();call.reject(error);}this.pending.clear();}
  destroy(){this.worker.terminate();this.fail(new DOMException('Stopped','AbortError'));}
}

// Retrieval is local and deterministic; the model composes its own response.
// No embedding model or remote vector database is necessary for this small CV.
function profileContext(facts,question){
  const ignored=new Set('what have you your about tell with that from were when where how can did the and are work built which more does this me some please'.split(' '));
  const words=text=>(text.toLowerCase().match(/[a-z0-9]+/g)||[]).map(w=>w.length>4?w.replace(/s$/,''):w);
  const query=new Set(words(question).filter(w=>w.length>2&&!ignored.has(w)));
  const timeline=facts.chapters.map(c=>`${c.year}: ${c.company}, ${c.role}; ${c.skill}.`).join('\n');
  const documents=[
    ...facts.chapters.map(c=>({name:c.company,text:`${c.company}, ${c.role} (${c.year}). ${c.summary} ${c.details.join(' ')} ${c.outcome}`,keys:c.skills.join(' ')})),
    ...facts.projects.map(p=>({name:p.name,text:`${p.name}: ${p.description}`,keys:p.skills.join(' ')}))
  ];
  const scored=documents.map(d=>({...d,score:words(`${d.name} ${d.keys} ${d.text}`).reduce((n,w)=>n+(query.has(w)?1:0),0)+(question.toLowerCase().includes(d.name.toLowerCase())?30:0)})).sort((a,b)=>b.score-a.score);
  const overview=/journey|chronolog|career|background/.test(question.toLowerCase());
  const selected=scored.filter(d=>d.score>0).slice(0,1);
  const detail=selected.map(d=>d.text).join('\n');
  const profile=facts.profile;
  const projectOverview=/projects|side project|independent/.test(question.toLowerCase());
  const context=overview?timeline:projectOverview?facts.projects.map(p=>`${p.name}: ${p.description}`).join('\n'):detail||`${profile.name}: ${profile.summary} ${profile.education||''} ${(profile.community||[]).join(', ')}. ${(profile.interests||[]).join(' ')} Contact: ${profile.email}.`;
  const anchors=overview?facts.chapters.map(c=>c.company):projectOverview?facts.projects.map(p=>p.name):selected.length?selected.map(d=>d.name):[profile.name,'Gokul'];
  const related=overview||projectOverview||selected.length>0||/who|gokul|yourself|education|studied|university|contact|email|hobb|interest|hockey|community|communities/.test(question.toLowerCase());
  return {context,anchors,related};
}
export function profileMessages(facts,question,history=[]){
  const {context}=profileContext(facts,question);
  const system="You are Gokul's AI portfolio guide, not the actual person. Use only the provided profile facts. Never invent work, private details or commitments. If the facts do not answer, say you do not know. Keep answers brief.";
  const prompt=`Profile facts:\n${context}\n\nQuestion: ${question}\n\nAnswer the question in two short sentences using only the facts above. Include the relevant company or project name. Do not add general knowledge.`;
  return [{role:'system',content:system},...history.slice(-2),{role:'user',content:prompt}];
}

// A conservative lexical check, not a factuality guarantee. Unsupported outputs
// become explicitly attributed excerpts instead of being presented as AI prose.
export function groundedReply(facts,question,answer){
  const {context,anchors,related}=profileContext(facts,question);
  if(!related)return {text:"I can answer questions about Gokul's public work, skills and projects. I don't have profile facts that answer that question.",excerpt:true};
  const words=text=>text.toLowerCase().match(/[a-z0-9]+/g)||[];
  const source=new Set(words(context));
  const content=words(answer).filter(w=>w.length>5);
  const novel=content.filter(w=>!source.has(w)&&!source.has(w.replace(/s$/,'')));
  const numbers=answer.match(/\d+(?:[.,]\d+)?%?/g)||[];
  const anchored=anchors.some(name=>answer.toLowerCase().includes(name.toLowerCase()));
  const supported=anchored&&content.length>0&&novel.length/content.length<=.25&&numbers.every(n=>context.includes(n));
  return supported?{text:answer,excerpt:false}:{text:context,excerpt:true};
}
