// Optional sampled intelligibility check; public model downloads, local inference only.
import fs from 'node:fs';import {execFileSync} from 'node:child_process';import {createRequire} from 'node:module';import {pathToFileURL,fileURLToPath} from 'node:url';
const require=createRequire(pathToFileURL(process.env.KOKORO_MODULE));
const transformers=await import(pathToFileURL(require.resolve('@huggingface/transformers')));
const {pipeline}=transformers.default||transformers;
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
const records=fs.readdirSync(root+'/public/voices-natural').filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(root+'/public/voices-natural/'+f)));
const boundaries=process.env.CHECK_BOUNDARIES==='1';
const selected=[];for(const gender of ['female','male']){const clips=records.filter(r=>r.gender===gender);if(boundaries){
 const pace=r=>r.text.split(/\s+/).length/r.seconds;
 selected.push(clips.find(r=>r.text==='Good luck!'),clips.slice().sort((a,b)=>pace(b)-pace(a))[0],clips.filter(r=>r.chunks>1&&r.seconds<30).sort((a,b)=>pace(b)-pace(a))[0]);
}else selected.push(clips.filter(r=>r.seconds>30&&r.seconds<60).sort((a,b)=>b.seconds-a.seconds)[0],clips.filter(r=>r.text.split(/\s+/).length>=5&&r.seconds<5).sort((a,b)=>a.seconds-b.seconds)[0]);}
const pipe=await pipeline('automatic-speech-recognition','Xenova/whisper-tiny.en',{dtype:'q8',device:'cpu'});
const report=[];const words=s=>s.toLowerCase().replace(/[’']/g,'').match(/[a-z0-9]+/g)||[];
function wer(ref,hyp){let row=Array.from({length:hyp.length+1},(_,i)=>i);for(let i=0;i<ref.length;i++){const next=[i+1];for(let j=0;j<hyp.length;j++)next.push(Math.min(next[j]+1,row[j+1]+1,row[j]+(ref[i]===hyp[j]?0:1)));row=next}return row.at(-1)/ref.length;}
for(const r of selected){
 const file=`${root}/public/voices-natural/${r.key}.m4a`,out='/private/tmp/parrot-asr-generated.wav';
 execFileSync('/usr/bin/afconvert',['-f','WAVE','-d','LEI16@16000',file,out]);
 const b=fs.readFileSync(out);let offset=12,pcm;
 while(offset+8<=b.length){const name=b.toString('ascii',offset,offset+4),size=b.readUInt32LE(offset+4);if(name==='data'){pcm=new Float32Array(size/2);for(let n=0;n<pcm.length;n++)pcm[n]=b.readInt16LE(offset+8+n*2)/32768;break}offset+=8+size+(size%2)}
 const result=await pipe(pcm,{chunk_length_s:30,stride_length_s:5});const error=wer(words(r.text),words(result.text));const entry={key:r.key,voice:r.voice,seconds:r.seconds,expected:r.text,transcribed:result.text,wordErrorRate:error};report.push(entry);console.log(JSON.stringify(entry));
}
fs.writeFileSync(root+`/docs/voices/${boundaries?'boundary':'generated'}-transcription.json`,JSON.stringify({date:new Date().toISOString(),engine:'Whisper tiny.en local CPU; sample intelligibility check, not a human naturalness rating',samples:report},null,2));
if(report.some(r=>r.wordErrorRate>.2))process.exitCode=1;
