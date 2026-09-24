import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gradeItem } from '../src/lib/grading.js'
import { computeResults } from '../src/lib/scoring.js'
import { expandListeningSummaries, LISTENING_SECONDS, SUMMARY_SECONDS } from '../src/lib/listening.js'
const bank = JSON.parse(readFileSync(new URL('../src/data/conversations.json', import.meta.url)))
const audioKeys = new Set(JSON.parse(readFileSync(new URL('../src/data/naturalVoicePack.json', import.meta.url))).keys)
assert.equal(LISTENING_SECONDS, 390)
assert.equal(SUMMARY_SECONDS, 75)
for (const c of bank) {
  for (const text of [c.scenario,c.opener.audio,...c.rounds.map(r=>r.audio)]) for (const gender of ['female','male']) {
    let h=7
    for(const ch of gender+text) h=(h*31+ch.charCodeAt(0))>>>0
    const key=h.toString(16)
    assert(audioKeys.has(key),`Missing bundled voice ${key}`)
    assert(readFileSync(new URL(`../public/voices-natural/${key}.m4a`,import.meta.url)).length>1000)
  }
  assert([3,4].includes(c.comprehension.length))
  assert([5,6].includes(c.rounds.length+1))
  for (const q of [c.opener,...c.rounds]) {
    assert(q.audio && q.options.includes(q.answer))
    assert.equal(new Set(q.options).size,q.options.length)
  }
  const item = {id:c.id,type:'interactive_listening',payload:c}
  const response = {comprehension:c.comprehension.map(q=>q.answer+'.'),opener:c.opener.answer,responses:c.rounds.map(q=>q.answer),summary:'We discussed a problem and agreed on a plan.'}
  assert.equal(gradeItem(item,response).score,1,'Minor punctuation must not lose listening marks')
  const expanded = expandListeningSummaries([item],{[item.id]:response})
  assert.equal(expanded.items.length,2)
  assert.equal(expandListeningSummaries(expanded.items,expanded.responses).items.length,2,'Saved history must not duplicate summary tasks')
  const result = computeResults(expanded.items,expanded.responses,{[`${c.id}:summary`]:0.6})
  assert.equal(result.subscores.writing,100)
  assert(result.subscores.listening > 0)
  assert.equal(expandListeningSummaries([item],{[item.id]:{}}).items.length,1,'Legacy attempts did not include a summary')
}
console.log('All 12 listening scenarios and summary-scoring regression checks passed.')
