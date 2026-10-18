import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildKnowledge,chooseAnswer} from '../static/profile-knowledge.js';
const facts=JSON.parse(await readFile(new URL('../static/profile.json',import.meta.url)));
const cards=buildKnowledge(facts);
test('profile questions return the right public facts without a model warmup',()=>{
 for(const [question,id] of [
  ['Walk me through your career','career'],['What is slm.expert?','project-slm.expert'],
  ['How can I contact you?','contact'],['Where did you study?','education'],
  ['Tell me about your agent experience','agents'],['Who are you?','intro'],
  ['Tell me about hockey and communities','personal'],['What is your PyConf talk?','talk']
 ])assert.equal(chooseAnswer(cards,question).id,id,question);
 assert.match(chooseAnswer(cards,'Tell me about Plena').answer,/13 engineers/);
 assert.match(chooseAnswer(cards,'Tell me about Flytta').answer,/YOLOv2/);
});
test('retrieval is scoped to the named company and never writes new facts',()=>{
 const result=chooseAnswer(cards,'What systems did you build at Plena?',[
  {id:'flytta',score:.99},{id:'plena-0',score:.85},{id:'plena',score:.55}
 ]);
 assert.equal(result.id,'plena-0');assert.equal(result.answer,cards.find(c=>c.id===result.id).answer);
 assert.equal(chooseAnswer(cards,'What is your salary?',[{id:'leadership',score:.99}]).id,'unknown');
 assert.equal(chooseAnswer(cards,'Write a recipe for lasagne',[]).id,'unknown');
});
test('follow-up stays with the previous employer and talk is the published talk',()=>{
 const result=chooseAnswer(cards,'Tell me more',[],'launchai');
 assert.ok(result.id.startsWith('launchai-'));
 assert.match(chooseAnswer(cards,'What is your talk?').answer,/Small Models.*Big Impact/);
 assert.equal(chooseAnswer(cards,'Email').link.href,'#contact-card');
});
test('conversation replies use prose and short follow-ups advance the story',()=>{
 for(const card of cards){
  assert.ok(card.answer.length>20,card.id);
  assert.doesNotMatch(card.answer,/\n| · |^[-•]/,card.id+' must be spoken prose');
 }
 assert.equal(chooseAnswer(cards,'Yes please',[],'agents').id,'plena-0');
 assert.equal(chooseAnswer(cards,'Go on',[],'plena-0').id,'plena-1');
 assert.equal(chooseAnswer(cards,'Tell me more',[],'plena-1').id,'plena-2');
 assert.equal(chooseAnswer(cards,'Sure',[],'career').id,'flytta');
 assert.notEqual(chooseAnswer(cards,'Tell me more',[],'plena-0').answer,cards.find(c=>c.id==='plena-0').answer);
});
test('expanded questions cover technical depth, product outcomes and colloquial variations',()=>{
 const cases=[
 ['What sets you apart?','expertise'],['What are your strongest skills?','expertise'],
 ['What is your current role?','launchai'],['What are you working on today?','launchai'],
 ['Have you worked with LLMs?','llms'],['Tell me about your NLP experience','llms'],
 ['How do you evaluate language models?','evaluation'],['Do you fine-tune models?','evaluation'],
 ['How do you benchmark agents?','evaluation'],['What about observability?','evaluation'],
 ['How do you handle context across agents?','context'],['Explain your agent handoffs','context'],
 ['Have you used prompt management?','context'],['How do you make agents reliable?','guardrails'],
 ['What have you done about agent security?','guardrails'],['What impact have you had?','impact'],
 ['What business results can you share?','impact'],['Have you built products from scratch?','zero-to-one'],
 ['Tell me about your RAG work','rag'],['Do you have entity resolution experience?','rag'],
 ['Have you worked on sentiment analysis?','rag'],['Tell me about small language models','model-efficiency'],
 ['What is your experience with lightweight models?','model-efficiency'],['What is your tech stack?','tech-stack'],
 ['Which frameworks have you used?','tech-stack'],['What did you do with YOLO?','flytta-0'],
 ['Tell me about on-device inference at Flytta','flytta-0'],['What did you do with LSTM?','flytta-1'],
 ['What about Raspberry Pi?','flytta-1'],['Have you worked on compliance extraction?','pramati-0'],
 ['Have you used Neo4j?','pramati-1'],['What did LEGAL-BERT do?','pramati-1'],
 ['Do you have speech synthesis experience?','pramati-2'],['Tell me about your 3D face work','pramati-2'],
 ['Did you work on satellite orbits?','accenture-0'],['What physics-informed ML did you do?','accenture-0'],
 ['Have you built OCR systems?','accenture-2'],['What did Tamr connectors do?','accenture-2'],
 ['What did the sales agents do at Plena?','plena-0'],['Tell me about the cloud migration at Plena','plena-2'],
 ['How do you approach MCP?','launchai-0'],['What work did you do on tool calling?','launchai-0'],
 ['How did modular models help Launch AI?','launchai-1'],['Tell me about Refuse','project-Refuse.dev'],
 ['What is Agentend?','project-Agentend.ai'],['Where is your model directory?','project-slm.expert'],
 ['Walk me through ur carrer','career'],['Tell me about hockey','personal'],
 ['How large were the teams you led?','leadership'],['Tell me about your deep learning experience','ml']
 ];
 assert.deepEqual(cases.map(([question,expected])=>({question,expected,actual:chooseAnswer(cards,question).id})).filter(item=>item.expected!==item.actual),[]);
});
test('unresolved requests offer direct contact without inventing availability or private facts',()=>{
 for(const question of ['What is your hourly rate?','Are you available for consulting?','That did not answer my question','What is your notice period?','Write a recipe for lasagne']){
  const result=chooseAnswer(cards,question);assert.equal(result.id,'unknown',question);assert.equal(result.openContact,true);assert.equal(result.link.href,'#contact-card');
 }
 for(const question of ['What is your phone number?','How can I reach you?','Your linked in please']){
  const result=chooseAnswer(cards,question);assert.equal(result.id,'contact',question);assert.equal(result.openContact,true);assert.match(result.answer,/\+91-8220869194/);
 }
 assert.equal(chooseAnswer(cards,'Hello there!').openContact,undefined);
 assert.equal(chooseAnswer(cards,'Help').id,'help');
 assert.equal(chooseAnswer(cards,'Can you elaborate?',[],'evaluation').id,'model-efficiency');
 assert.equal(chooseAnswer(cards,'Give me an example',[],'guardrails').id,'project-Refuse.dev');
});
