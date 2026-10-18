// Curated question variations share the same verified, conversational answers.
export const profileIntents = [
 {id:'intro', match:/\b(who (?:are you|is gokul)|introduce|about (?:yourself|gokul)|what do you do|background|bio|elevator pitch)\b/, questions:['Give me your elevator pitch.','Who is Gokul?','Tell me a little about yourself.']},
 {id:'career', match:/\b(career|journey|timeline|chronolog\w*|previous (?:roles|jobs)|work history|where have you worked)\b/, questions:['How has your career evolved?','What did you do before LaunchAI?','Walk me through your previous roles.']},
 {id:'expertise', match:/\b(expertise|speciali[sz]\w*|strengths|skill set|skillset|strongest|sets? you apart|differentiate)\b/, questions:['What are your strongest skills?','What makes your background distinctive?','How did your skills evolve from ML to agents?']},
 {id:'llms', match:/\b(llms?|language models?|nlp|natural language|language understanding)\b/, questions:['Have you worked with LLMs?','What is your experience in NLP?','How does your language-model work connect to agents?']},
 {id:'evaluation', match:/\b(eval(?:uation|s)?|evaluat\w*|benchmark\w*|fine[ -]?tun\w*|observability|trac(?:e|es|ing)|monitor\w*|measure.*(?:model|agent))\b/, questions:['How do you evaluate agents?','Have you fine-tuned smaller models?','How do you measure model quality?','What about agent tracing and observability?']},
 {id:'context', match:/\b(context|handoffs?|task continuity|prompt(?:s|ing| management)?|memory)\b/, questions:['How do you manage context between agents?','How do agents hand off tasks?','Have you worked on prompt management?']},
 {id:'guardrails', match:/\b(guardrails?|reliab\w*|predictab\w*|deterministic|safe(?:ty)?|security|secure|unsafe|malicious|vulnerab\w*)\b/, questions:['How do you make agents reliable?','What agent security work have you done?','How do you reduce unsafe tool actions?']},
 {id:'impact', match:/\b(impact|outcomes?|results?|metrics?|roi|return on investment|cost savings?|saved|time to market|business value)\b/, questions:['What measurable impact did your work have?','Did your agent architecture save money?','What business outcomes can you share?']},
 {id:'zero-to-one', match:/\b(zero to one|0 to 1|0.?1|from scratch|from the ground up|early stage|startup|founding)\b/, questions:['Have you built a product from scratch?','What is your zero-to-one experience?','Have you worked in startups?']},
 {id:'rag', match:/\b(rag|retrieval|entity (?:resolution|matching)|sentiment)\b/, questions:['Have you built RAG pipelines?','What was your entity resolution work?','Have you worked on sentiment analysis?']},
 {id:'model-efficiency', match:/\b(small models?|small language|slms?|svlms?|vision language|vlms?|efficient models?|lightweight|resource constrained|model selection)\b/, questions:['Why are you interested in smaller models?','Have you worked with vision-language models?','What is your experience with resource-constrained inference?']},
 {id:'tech-stack', match:/\b(tech(?:nology)? stack|technologies|frameworks?|libraries|tools (?:do|have) you|programming languages?|python)\b/, questions:['What technologies have you used?','Tell me about your technical stack.','What frameworks appear in your work?']},
 {id:'flytta-0', match:/\b(yolo\w*|object detection|transfer learning|moving costs?|quotation|cost estimation|on device|mobile inference)\b/, questions:['What ran on the phone at Flytta?','Tell me about your YOLO object detector.','How did you estimate relocation costs?']},
 {id:'flytta-1', match:/\b(lstm|raspberry|anomal\w*|sensor\w*|cargo|time series|iot)\b/, questions:['What did you build on Raspberry Pi?','Have you worked with sensor data?','Tell me about your anomaly detection experience.']},
 {id:'flytta-2', match:/\b(vendor management|corporate portals?|finance and operations|22 people)\b/, questions:['What did being a co-founder involve?','Did you also build the applications?']},
 {id:'pramati-0', match:/\b(compliance|airflow|selenium|multi format|all us states)\b/, questions:['What did your compliance extraction pipeline handle?','How did you combine different document sources?']},
 {id:'pramati-1', match:/\b(legal bert|legalbert|contracts?|knowledge graphs?|neo4j|entity linking|private equity)\b/, questions:['Have you worked with knowledge graphs?','How did you use LEGAL-BERT?','What was the Neo4j project?']},
 {id:'pramati-2', match:/\b(speech|talking faces?|audio visual|video generation|3d face|one shot|voice synthesis)\b/, questions:['Have you worked on speech synthesis?','What is your experience with 3D faces?','Tell me about your audio-visual deep learning.']},
 {id:'accenture-0', match:/\b(satellite|orbit\w*|physics|synthetic data|\bleo\b)\b/, questions:['Tell me about satellite orbit prediction.','Have you used physics-informed machine learning?','Where did you use synthetic data?']},
 {id:'accenture-2', match:/\b(ocr|ner|document|dewarp\w*|summari[sz]\w*|tamr|terabyte|data (?:pipelines?|platforms?|connectors?))\b/, questions:['What document AI work have you done?','Have you built large data pipelines?','What were the Tamr connectors for?']},
 {id:'plena-0', match:/\b(lead (?:research|enrichment)|sales agents?|outreach|five agents|5 agents|existing user sessions)\b/, questions:['What did the five sales agents do?','How did the agents research and enrich leads?','Tell me about the outreach platform.']},
 {id:'plena-1', match:/\b(drag and drop|self serve|non standard leads?|25\s*%|sales improvement|workflow (?:builder|engine))\b/, questions:['Could users build their own agent workflows?','How did the sales platform improve results?']},
 {id:'plena-2', match:/\b(acquisit\w*|acquired|post acquisition|cloud migration|integration after)\b/, questions:['Was one of your companies acquired?','What did you do after the acquisition?','Have you led cloud migration?']},
 {id:'launchai', match:/\b(current (?:role|job|work)|working on (?:now|today)|these days|desktop automation|vision first|rpa|accounts payable|erp|enterprise automation)\b/, questions:['What are you working on now?','What is your current role?','What enterprise processes do your agents automate?']},
 {id:'launchai-0', match:/\b(mcp|tool calling|function calling|agent harness)\b/, questions:['Have you designed MCP servers?','How do you approach tool and function calling?','What work have you done on agent harnesses?']},
 {id:'launchai-1', match:/\b(modular|hot swapp\w*|15k|15,000|fifteen thousand|two weeks|2 weeks)\b/, questions:['What did a modular agent architecture change?','What helped you ship in two weeks?']},
 {id:'agents', match:/\b(agents?|agentic|multi agent|orchestrat\w*)\b/, questions:['What agentic systems have you shipped?','Do you have multi-agent experience?','How do your agents work together?']},
 {id:'leadership', match:/\b(team|leadership|manag\w*|founder|cto|head of engineering|mentoring|engineers)\b/, questions:['How large were the teams you led?','Have you been an engineering leader?','What experience do you have as a CTO?']},
 {id:'ml', match:/\b(machine learning|deep learning|computer vision|ml|dl|neural|edge)\b/, questions:['How much deep learning experience do you have?','What computer vision systems did you build?','Have you shipped ML into products?']}
];

export function normalizeQuestion(question){
 return question.toLowerCase().normalize('NFKC').replace(/[’‘]/g,"'").replace(/[–—-]/g,' ')
  .replace(/\blaunch\s+ai\b/g,'launchai').replace(/\bple?na\s+data\b/g,'plena')
  .replace(/\b(linkdin|linked in)\b/g,'linkedin').replace(/\b(carrer|carreer)\b/g,'career')
  .replace(/\bexpere?ince\b/g,'experience').replace(/\bu\b/g,'you').replace(/\bur\b/g,'your').trim();
}
