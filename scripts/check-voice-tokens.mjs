import fs from 'node:fs';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
const moduleURL=pathToFileURL(process.env.KOKORO_MODULE);
const {KokoroTTS}=await import(moduleURL);
const require=createRequire(moduleURL);
const transformers=await import(pathToFileURL(require.resolve('@huggingface/transformers')));
const {AutoTokenizer}=transformers.default||transformers;
import {spokenStrings,chunkText} from './render-natural-voices.mjs';
const tokenizer=await AutoTokenizer.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX');
const noTruncate=(text,opts)=>tokenizer(text,{...opts,truncation:false});
const tts=new KokoroTTS(null,noTruncate);tts.generate_from_ids=async ids=>ids;
let maxTokens=0,chunks=0;
for(const text of spokenStrings())for(const chunk of chunkText(text)){
 const ids=await tts.generate(chunk,{voice:'af_heart'});const n=Number(ids.dims.at(-1));if(n>510)throw Error('Overlong phonemes '+n);maxTokens=Math.max(n,maxTokens);chunks++;
}
const report={date:new Date().toISOString(),ok:true,chunks,maxTokens,limit:510,language:'en-us (both selected voices)',method:'Real Kokoro phonemizer and tokenizer, truncation disabled; no synthesis needed'};
fs.writeFileSync(new URL('../docs/voices/token-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(report);
