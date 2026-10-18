import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {voiceCorpus,spokenText} from './voice-corpus.mjs';

const destination=process.argv[2];
if(!destination)throw new Error('Usage: node scripts/prepare-voice-corpus.mjs <external-build-directory>');
const facts=JSON.parse(await readFile(new URL('../static/profile.json',import.meta.url)));
const corpus=voiceCorpus(facts).map(entry=>({...entry,spokenText:spokenText(entry.text)}));
const directory=resolve(destination);
await mkdir(directory,{recursive:true});
await writeFile(join(directory,'corpus.json'),JSON.stringify(corpus,null,2)+'\n');
console.log(`Prepared ${corpus.length} profile replies.`);
