import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { gradeItem, spanF1 } from '../../src/lib/grading.js'
import { computeResults } from '../../src/lib/scoring.js'
const root = path.resolve(import.meta.dirname, '../..')
const d = JSON.parse(fs.readFileSync(path.join(root, 'src/data/gpnSamples.json')))
const banks = { read_complete: ['readComplete',40], read_select: ['readSelect',500], fill_blanks: ['fillBlanks',60], listen_type: ['listenType',60], read_aloud: ['readAloud',60], interactive_reading: ['interactiveReading',40], interactive_listening: ['interactiveListening',40], write_photo: ['photos',40], speak_photo: ['speakingPhotos',40], interactive_writing: ['interactiveWriting',40], read_then_speak: ['readThenSpeak',40], listen_then_speak: ['listenThenSpeak',40], writing_sample: ['writingSample',40], speaking_sample: ['speakingSample',40] }
let total = 0
for (const [type,[bank,count]] of Object.entries(banks)) {
 assert.equal(d[bank].length,count,bank)
 assert.deepEqual(d[bank].map(x=>x.number),Array.from({length:count},(_,i)=>i+1),bank)
 total += count
 for(const p of d[bank]) {
  const item={id:`gpn_${type}_${p.number}`,source:'gpn',type,payload:p}
  let r={}
  if(type==='read_select') {item.payload={items:[p]};r={answers:[p.isReal]}}
  if(type==='fill_blanks') {assert.equal(p.shown+p.missing,p.word);r={text:p.missing}}
  if(type==='read_complete') {
   assert.equal(p.unmatched.length,0)
   assert.equal(p.parts.filter(x=>x.type==='gap').length,p.gapCount)
   assert.ok(p.gapCount>0)
   assert.equal(p.parts.map(x=>x.type==='text'?x.text:x.shown+'_'.repeat(x.missing.length)).join(''),p.maskedText)
   r={gaps:p.parts.filter(x=>x.type==='gap').map(x=>x.missing)}
  }
  if(type==='listen_type')r={text:p.text}
  if(type==='interactive_reading') {
   const nums=[...p.passage.matchAll(/\{(\d+)\}/g)].map(m=>+m[1])
   assert.deepEqual(nums,Array.from({length:p.blanks.length},(_,i)=>i+1),`IR ${p.number} gaps`)
   for(const q of [...p.blanks,p.sentence,p.mainIdea,p.title])assert.ok(q.options.includes(q.answer))
   assert.equal(p.sentencePassage.split('{sentence}').length,2)
   assert.equal(p.highlight.length,2)
   for(const h of p.highlight)assert.ok(spanF1(h.answer,h.answer)===1)
   r={blanks:p.blanks.map(x=>x.answer),sentence:p.sentence.answer,highlights:p.highlight.map(x=>x.alts?.[0] || x.answer),mainIdea:p.mainIdea.answer,title:p.title.answer}
  }
  if(type==='interactive_listening') {
   const qs=p.turns.filter(x=>x.speaker==='you')
   assert.ok(qs.length>=4 && qs.length<=6,`IL ${p.number} responses`)
   for(const q of qs)assert.ok(q.options.includes(q.answer))
   assert.equal(p.dialogue.filter(x=>x.speaker==='you').length,qs.length)
   r={responses:qs.map(x=>x.answer),summary:'Practice summary'}
  }
  if(type==='interactive_writing')assert.equal(p.followUps.length,3)
  if(p.img)assert.ok(fs.statSync(path.join(root,'public',p.img)).size>1000)
  if(p.audio){
   const audio=fs.readFileSync(path.join(root,'public',p.audio))
   assert.ok(audio.length>1000)
   assert.ok(audio.subarray(0,3).toString()==='ID3'||audio[0]===255||audio.subarray(0,4).toString()==='RIFF',p.audio)
  }
  const g=gradeItem(item,r)
  if(!g.subjective){assert.equal(g.score,1,`${type} ${p.number}`);assert.equal(gradeItem(item,{}).score,0,`${type} empty ${p.number}`)}
  assert.doesNotThrow(()=>computeResults([item],{[item.id]:r},{[item.id]:.8}))
 }
}
assert.equal(total,1080)
assert.equal(d.readComplete[0].topic,'A Gentle Touch, A Powerful Impact')
assert.equal(d.scoredExamples.length,6)
assert.equal(d.interactiveListening.filter(x=>x.summaryModel).length,10)
for (const m of d.scoredExamples)if(m.audio)assert.ok(fs.statSync(path.join(root,'public',m.audio)).size>1000)
console.log('PASS: all 1,080 numbers, exact RC masks, source choice keys, perfect/empty grading, 80 photos, 100 question recordings, 6 scored models, 10 summaries, and skill scoring.')
