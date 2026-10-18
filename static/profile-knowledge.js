// Answers are assembled from the same public facts used on the page.
// The small encoder ranks these answers; it does not invent new prose.
import {profileIntents,normalizeQuestion} from './profile-intents.js';
const stories={
 flytta:[
  'Flytta was where I started bringing machine learning into real products. I co-founded the company and built everything from relocation apps to models running on phones and Raspberry Pi. One example was using YOLOv2 to estimate moving costs without a manual quotation visit.',
  'One problem at Flytta was how much effort went into quoting a move. I used YOLOv2 with transfer learning to recognize objects on a phone, so we could estimate costs on the device instead of sending someone for a manual visit.',
  'We also worked on protecting cargo in transit. I built an LSTM model that watched sensor streams on a Raspberry Pi and detected unusual patterns in real time. That was another example of running the intelligence right on the device.',
  'Being a co-founder meant going beyond the models. I built the corporate portals, vendor tools and mobile apps, and shared responsibility for finance and operations. The company grew to 22 people.'
 ],
 pramati:[
  'At Pramati, I moved deeper into language, vision and speech. My work ranged from extracting compliance information to evaluating LEGAL-BERT and building knowledge graphs. I also worked on speech synthesis and video generation using 3D face models.',
  'The compliance work involved information scattered across PDFs, websites, spreadsheets, images and XML. I built extraction pipelines covering all US states, using tools including SciPy, Selenium and Airflow to bring those sources together.',
  'On the language side, I evaluated LEGAL-BERT for contract review. I also built a Neo4j knowledge graph for private-equity competitive intelligence, with automated entity linking to connect information about the same organizations.',
  'I also developed an audio-visual deep learning framework for real-time speech synthesis and video generation. It combined 3D face models with one-shot learning. So working with talking faces is actually part of my earlier deep learning experience too.'
 ],
 accenture:[
  'At Accenture Labs, I worked across a pretty wide range of machine learning systems. That included language and document intelligence, large data pipelines, and even satellite orbit prediction. My role was to own the technical direction and architecture behind that work.',
  'The satellite work was about predicting orbits in low Earth orbit. I owned the technical direction, using physics-informed machine learning and pipelines that generated synthetic data. It was a very different application from documents or language.',
  'I led research and development on entity resolution and sentiment analysis. That included RAG pipelines, deep learning for matching entities, and HuggingFace transformers for understanding sentiment about specific aspects of a topic.',
  'Another part of the work was helping systems understand documents, from OCR and entity extraction to dewarping and summarization. I also built Tamr connectors that handled terabytes of data across different sources, along with a product testing framework.'
 ],
 plena:[
  'At Plena Data, I led 13 engineers as Head of Engineering. We built AI products from the ground up, including a desktop sales platform where five specialized agents worked together. I also worked on making those workflows accessible through a self-serve interface.',
  'The sales platform split the work across five specialized agents. They handled things like researching leads, enriching information and reaching out through different channels, using existing user sessions. My role was to architect how that work fitted together.',
  'We made the workflows self-serve, so people could put them together through drag and drop. I worked on context engineering to keep a task moving from one agent to the next. That work improved sales by 25% for non-standard lead generation.',
  'The self-serve agent platform directly contributed to the company’s acquisition. After that, I led the integration work and the migration of the cloud platform. So I was involved both in building the product and in carrying it into the next stage.'
 ],
 launchai:[
  'At LaunchAI, I own product direction for desktop automation. The work centers on agents that use vision to interact with enterprise software, especially accounts payable and ERP-connected finance. I also define how we evaluate the smaller language and vision-language models behind them.',
  'A lot of my work is about making agent behavior predictable. I’ve architected workflows with dynamic context switching, guardrails and reusable prompt templates, and set standards for MCP servers and tool calling. Those pieces help organize how agents carry out a task.',
  'We made the agent architecture modular, with model components that could be swapped out. That helped bring time to market from three months to two weeks and saved fifteen thousand dollars a month per customer.',
  'I also work on how we judge whether a model is right for the job. That includes fine-tuning and benchmarking small language and vision-language models, then using agent traces and observability to understand their behavior inside a workflow.'
 ]
};
export function buildKnowledge({chapters,projects,profile}) {
  const cards=[];
  const add=(id,questions,answer,link=null)=>cards.push({id,questions,answer,link});
  add('intro','Who are you? Introduce yourself. What do you do? Tell me about Gokul and his skills. What is your background?',`Hey, I’m Gokul’s AI self. I can tell you about his work and the things he’s built. My background spans more than ten years in product and engineering, from machine learning on small devices to teams of AI agents. These days, I own product direction at LaunchAI.`);
  add('career','Walk me through your career journey timeline. Where have you worked? How did you get from machine learning to agents?',`I started by co-founding Flytta, where I built products and machine learning that ran on small devices. At Pramati and then Accenture Labs, I moved deeper into language, vision and larger ML systems. Later, I led engineering at Plena Data, building multi-agent products. Now I’m at LaunchAI, working on vision-first agents for enterprise automation.`);
  add('agents','What have you built with agents? What is your agent experience? How do your agents work together? Multi-agent orchestration context tools MCP.',`One example is a sales platform I architected at Plena Data. Five specialized agents shared the work of researching leads, enriching information and handling outreach. At LaunchAI, I now work on vision-first desktop agents, including their context, tools, guardrails and evaluation. Want to hear more about how the sales agents worked?`);
  add('ml','What is your machine learning experience? Computer vision neural networks deep learning LLM language models edge models.',`I started with computer vision and time-series models running on phones and Raspberry Pi at Flytta. From there, my work expanded into language models, knowledge graphs, speech and document intelligence. That background now feeds into my work on agents and smaller language and vision-language models. There’s a fairly continuous thread from the early on-device work to what I do today.`);
  add('leadership','What teams have you led? Engineering management leadership CTO founder people products.',`I’ve worked on both the technical and people sides of building products. I co-founded Flytta, which grew to 22 people, and later led 13 engineers at Plena Data as we built AI products from the ground up. Today, I own product direction at LaunchAI.`);
  for(const c of chapters){
    add(c.id,`Tell me about ${c.company}. What did you do at ${c.company}? ${c.role}. ${c.skill}. ${c.skills.join(', ')}.`,stories[c.id][0],c.links[0]||null);
    c.details.forEach((detail,index)=>add(`${c.id}-${index}`,`${c.company}: ${detail}`,stories[c.id][index+1],c.links[0]||null));
  }
  add('projects','What are your independent projects? Side projects open source things you made.',`A few projects capture the things I’m exploring. Refuse.dev helps protect agent workflows from unsafe package installs. With slm.expert, I’m organizing small open-weight models so people can find one for their use case. And Agentend.ai explores a different approach to backend architecture. Which one sounds interesting to you?`);
  const projectStories={
   'Refuse.dev':'Refuse.dev is about the packages that agents want to install. It adds an MCP security layer that blocks malicious or vulnerable installs requested by AI agents. You can explore the project through the link here.',
   'slm.expert':'With slm.expert, I’m working on model discovery. It’s a directory of small open-weight language models, with use-case filters and benchmarks to help people compare them. It connects closely with my work on evaluating smaller models.',
   'Agentend.ai':'Agentend.ai is an open-source project exploring how to replace existing backend architecture. It’s one of my independent projects, and you can take a closer look through the link here.'
  };
  for(const p of projects)add(`project-${p.name}`,`Tell me about ${p.name}. ${p.category}. ${p.skills.join(', ')}. ${p.description}`,projectStories[p.name],{label:`Explore ${p.name}`,href:p.href});
  add('hockey','Do you play a sport? Hockey sports interests hobbies life outside code. State national competition.',`Yes, field hockey has been a big part of my life. I’ve played at state and national competitions. There’s a team-sport side to me alongside all the technology work.`);
  add('community','What community work have you done? Meetups events Python communities organizing volunteering.',`I’ve helped organize ${profile.community.slice(0,-1).join(', ')} and ${profile.community.at(-1)}. I enjoy connecting with other people who like to build and learn.`);
  add('personal','Tell me about hockey and community. What do you do outside work? What are your interests?',`Away from work, field hockey is a big part of my story. I’ve played at state and national competitions. I’ve also spent time helping organize Python and AI communities, including ${profile.community.slice(0,-1).join(', ')} and ${profile.community.at(-1)}.`);
  add('education','Where did you study? Education university college degree computer science.',`I studied Computer Science at Hindustan University. My career since then has taken me through building a company, applied machine learning and, more recently, agent systems.`);
  add('location','Where are you based? Where do you live? What city?',`I’m based in ${profile.location}.`);
  add('contact','How can I contact you? Email LinkedIn GitHub phone call social profiles get in touch connect.',`You can email me at ${profile.email} or call me at ${profile.phone}. You’ll also find me on LinkedIn and GitHub as gok03. I’ve put those details in my contact card.`,{label:'Connect with Gokul',href:'#contact-card'});
  for(const talk of profile.talks||[])add('talk',`What talks have you given? Speaking presentations conference ${talk.title} ${talk.event}.`,`I gave a talk called ${talk.title} at ${talk.event} in ${talk.year}. It explores the possibilities of small language models, a topic that connects closely with my work. I’ve put the slides and resources here if you’d like to explore them.`,{label:'Explore the talk',href:talk.href});
  add('expertise','What are your core skills?', 'My strongest thread is taking AI from an idea into a working product. I started with computer vision and time-series models on small devices, moved into language and document systems, and now work on agent architectures. Along the way, I’ve also founded a company, led engineering teams and owned product direction.');
  add('llms','Tell me about your language model experience.', 'My language-model experience developed over several roles. At Pramati, I evaluated LEGAL-BERT for contract review. At Accenture Labs, I worked on RAG, entity resolution and transformer-based sentiment analysis. At LaunchAI, that has grown into fine-tuning and evaluating smaller language and vision-language models for agent workflows.');
  add('evaluation','How do you evaluate models and agents?', 'At LaunchAI, I define the evaluation strategy for small language and vision-language models. That includes fine-tuning and benchmarking, along with agent tracing and observability. I’m interested in how a model behaves inside the actual workflow, as well as how it performs in a benchmark.');
  add('context','How do you approach context engineering?', 'At Plena Data, I worked on context engineering so a task could continue as it moved between specialized agents. At LaunchAI, I’ve worked on dynamic context switching, reusable prompt templates and standards for tool calling. The common goal is to keep each step connected to the work that came before it.');
  add('guardrails','How do you make agents reliable and secure?', 'My work at LaunchAI includes deterministic workflows, guardrails, prompt templates and standards for MCP servers and tool calling. I’m also exploring agent security through Refuse.dev, which blocks unsafe package installs requested by agents. Those are concrete parts of my work on making agent systems more predictable.');
  add('impact','What measurable results have you delivered?', 'At LaunchAI, a modular agent architecture helped reduce time to market from three months to two weeks and save fifteen thousand dollars a month per customer. At Plena Data, our self-serve workflows improved sales by twenty-five percent for non-standard lead generation. Those results came from different products and different stages of my work.');
  add('zero-to-one','Have you built products from scratch?', 'Yes. I co-founded Flytta and built its technology as the company grew to twenty-two people. Later, as Head of Engineering at Plena Data, I led thirteen engineers building AI products from the ground up. I’ve been involved in the architecture, the product decisions and the team needed to get those products into use.');
  add('rag','Tell me about your RAG and retrieval work.', 'At Accenture Labs, I led research and development on entity resolution and sentiment analysis. That work included RAG pipelines, deep learning for entity matching and HuggingFace transformers for aspect-based sentiment. It sits alongside my earlier work on knowledge graphs and entity linking at Pramati.');
  add('model-efficiency','Why do smaller models interest you?', 'Working within resource limits has been part of my career from the start. At Flytta, I ran models on phones and Raspberry Pi. Today, I evaluate small language and vision-language models for agent workflows at LaunchAI. My side project, slm.expert, brings that interest into a directory where people can explore small open-weight models.');
  add('tech-stack','What technologies have you used?', 'The tools have changed with the problem. My earlier work includes YOLOv2, LSTM models, SciPy, Selenium and Airflow. For language and data work, I’ve used LEGAL-BERT, Neo4j and HuggingFace transformers. More recently, my focus has been agent architecture, MCP, tool calling and model evaluation.');
  for(const card of cards){const intent=profileIntents.find(intent=>intent.id===card.id);if(intent)card.questions+=' '+intent.questions.join(' ');}
  return cards;
}
const common=new Set('a an the me my you your i we it its is are was were what how when where why which do did does tell about more and of to in at with for from have has can would could please know work built build'.split(' '));
const terms=text=>(text.toLowerCase().match(/[a-z0-9]+/g)||[]).map(w=>w.length>4?w.replace(/s$/,''):w).filter(w=>w.length>1&&!common.has(w));
export function lexicalRanking(cards,question){
 const query=new Set(terms(question));
 return cards.map(card=>({id:card.id,score:terms(card.questions).reduce((score,word)=>score+(query.has(word)?1:0),0)/Math.sqrt(Math.max(1,terms(card.questions).length))})).sort((a,b)=>b.score-a.score);
}
export function chooseAnswer(cards,question,ranking=[],previousId=''){
 const q=normalizeQuestion(question);
 const byId=id=>cards.find(c=>c.id===id);
 const handoff=()=>({id:'unknown',answer:'I don’t have that detail to share. You can connect with Gokul through the contact card.',link:{label:'Connect with Gokul',href:'#contact-card'},openContact:true});
 if(/^(hi|hey|hello|good (morning|evening|afternoon))( there| gokul)?[!.\s]*$/.test(q))return {id:'greeting',answer:'Hey! What would you like to explore — my agent work, my journey in ML, or a little about me?'};
 if(/^(thanks(?: a lot)?|thank you(?: so much)?|cheers|great|nice|awesome|cool)[!.\s]*$/.test(q))return {id:'thanks',answer:'You’re welcome! There’s always another story to explore.'};
 if(/^(help|what can (?:you|i) (?:answer|ask|talk about)|what can you tell me)[?!.\s]*$/.test(q))return {id:'help',answer:'I can tell you about my agents, machine learning work, projects, or life outside code. Which would you like to explore?'};
 if(/\b(salary|marital|married|birthday|home address|religion|password|api key|available|availability|freelanc\w*|consulting rates?|pricing|hourly rate|remote work|willing to relocate|relocation availability|notice period|looking for a job|open to (?:work|roles|opportunities)|book a call|schedule a call|hire you|recruit\w*|real person|speak to gokul|talk to gokul|not (?:helpful|answered|resolved|what i asked)|didn't answer|did not answer|still (?:unclear|confused)|human please)\b/.test(q))return handoff();
 if(/^(?:(?:tell me |explain )?more(?: about (?:it|that|this))?|yes(?: please)?|sure|go on|keep going|continue|what happened next|anything else|can you elaborate|elaborate|give me an example|an example|how so)[.!?\s]*$/.test(q)&&previousId){
  const next={intro:'career',career:'flytta',expertise:'flytta-0',llms:'pramati-1',evaluation:'model-efficiency',context:'plena-1',guardrails:'project-Refuse.dev',impact:'plena-2','zero-to-one':'flytta-2',rag:'accenture-1','model-efficiency':'project-slm.expert','tech-stack':'pramati',agents:'plena-0',ml:'flytta-0',leadership:'plena',projects:'project-Refuse.dev','project-Refuse.dev':'project-slm.expert','project-slm.expert':'project-Agentend.ai','project-Agentend.ai':'projects',personal:'hockey',hockey:'community',community:'personal',talk:'launchai-2'};
  const detail=previousId.match(/^(flytta|pramati|accenture|plena|launchai)(?:-(\d))?$/);
  const id=detail?`${detail[1]}-${detail[2]===undefined?0:(Number(detail[2])+1)%3}`:next[previousId];
  if(byId(id))return byId(id);
  if(byId(previousId))return byId(previousId);
 }
 if(/career|journey|timeline|chronolog|where have you worked/.test(q))return byId('career');
 if(/hockey|sport/.test(q)&&/communit|organis|organiz/.test(q))return byId('personal');
 if(/hockey|sport|hobb|outside (?:work|code)/.test(q))return byId('personal');
 if(/communit|meetup|volunteer/.test(q))return byId('community');
 if(/education|stud(?:y|ied)|university|college/.test(q))return byId('education');
 if(/where.*(?:based|live|located)|what city/.test(q))return byId('location');
 if(/\b(contact|email|linkedin|github|social|connect|phone|mobile number|call you|reach you|get in touch)\b/.test(q))return {...byId('contact'),openContact:true};
 if(/pyconf|your talks?|talk at|talks have|speaking|presentation|conference|slides/.test(q))return byId('talk');
 const namedProject=cards.find(c=>c.id.startsWith('project-')&&q.includes(c.id.slice(8).toLowerCase()));
 if(namedProject)return namedProject;
 if(/\brefuse(?:\.dev)?\b/.test(q))return byId('project-Refuse.dev');
 if(/\bslm(?:\.expert| expert)|model (?:directory|discovery)/.test(q))return byId('project-slm.expert');
 if(/agentend|agent end|backend architecture/.test(q))return byId('project-Agentend.ai');
 if(/(?:side|independent|open.source) project|your projects|^what have you (?:built|made)[?.!\s]*$/.test(q))return byId('projects');
 const company=['flytta','pramati','accenture','plena','launchai'].find(name=>q.includes(name));
 const lexical=lexicalRanking(cards,question);
 const matches=profileIntents.filter(intent=>(!company||intent.id.startsWith(company+'-'))&&intent.match.test(q));
 const intent=matches.find(intent=>!['llms','agents','ml','leadership'].includes(intent.id))||matches[0];
 if(intent)return byId(intent.id);
 const eligible=ranking.filter(item=>!company||item.id===company||item.id.startsWith(company+'-'));
 if(eligible[0]?.score>=.57 && eligible[0].score-(eligible[1]?.score||0)>.08 && byId(eligible[0].id))return byId(eligible[0].id);
 if(company){
  const best=lexical.find(item=>item.id===company||item.id.startsWith(company+'-'));
  return best?.score>1.1?byId(best.id):byId(company);
 }
 if(/agent|orchestrat|mcp|tool.call|guardrail/.test(q))return byId('agents');
 if(/team|leadership|manag|founder|cto/.test(q))return byId('leadership');
 if(/machine learning|deep learning|computer vision|\bllm\b|\bml\b|neural/.test(q))return byId('ml');
 if(/who are you|introduce|about yourself|what do you do|background/.test(q))return byId('intro');
 if(lexical[0]?.score>1.15 && lexical[0].score-(lexical[1]?.score||0)>.3)return byId(lexical[0].id);
 return handoff();
}
