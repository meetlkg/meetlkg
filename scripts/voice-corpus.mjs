import {buildKnowledge,chooseAnswer} from '../static/profile-knowledge.js';
// Enumerate the actual reply function, including every possible follow-up.
// Audio is keyed by the complete answer so stale clips cannot narrate new facts.
export function voiceCorpus(facts){
 const cards=buildKnowledge(facts),answers=[...cards];
 for(const question of ['Hello','Thanks','Help','What is your salary?','Write a recipe'])answers.push(chooseAnswer(cards,question));
 for(const card of cards)answers.push(chooseAnswer(cards,'Tell me more',[],card.id));
 return [...new Map(answers.map(answer=>[answer.answer,{id:answer.id,text:answer.answer}])).values()];
}
export function spokenText(text){
 return text.replace(/0→1/g,'zero to one').replace(/→/g,' to ').replace(/(\d)[–—](\d)/g,'$1 to $2')
 .replace(/(\d{4})[–—]present/g,'$1 to the present').replace(/[·]/g,'. ').replace(/\n+/g,'. ').replace(/\.\s*\./g,'.').replace(/—/g,', ')
 .replace(/\bYOLOv2\b/g,'YOLO version two').replace(/\bLLMs\b/gi,'large language models').replace(/\bLLM\b/gi,'large language model')
 .replace(/\bML\b/gi,'machine learning').replace(/\bAI\b/g,'A I').replace(/\bMCP\b/g,'M C P').replace(/\bLSTM\b/g,'L S T M')
 .replace(/\bSLM\b/g,'small language model').replace(/\bSVLM\b/g,'small vision language model').replace(/\bERP\b/g,'E R P')
 .replace(/\bNER\b/g,'named entity recognition').replace(/\bOCR\b/g,'optical character recognition')
 .replace(/gokul\.0369@gmail\.com/gi,'gokul dot zero three six nine at gmail dot com').replace(/gok03/g,'gok zero three')
 .replace(/\+91-8220869194/g,'plus nine one, eight two two zero eight, six nine one nine four')
 .replace(/Refuse\.dev/gi,'Refuse dot dev').replace(/slm\.expert/gi,'S L M dot expert').replace(/Agentend\.ai/gi,'Agent end dot A I')
 .replace(/LaunchAI/g,'Launch A I').replace(/PyConf/g,'Pie Conf').replace(/PyCon/g,'Pie Con').replace(/\s+/g,' ').trim();
}
export function splitSpeech(text,max=270){
 // Bound chunks before the neural model's 510-token limit, preserving sentences.
 const sentences=text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[text],out=[];
 for(let sentence of sentences){
  sentence=sentence.trim();if(!sentence)continue;
  while(sentence.length>max){let at=sentence.lastIndexOf(', ',max);if(at<max/2)at=sentence.lastIndexOf(' ',max);out.push(sentence.slice(0,at).trim());sentence=sentence.slice(at).replace(/^,?\s*/,'');}
  if(out.length&&out.at(-1).length+sentence.length<max)out[out.length-1]+=' '+sentence;else out.push(sentence);
 }
 return out;
}
