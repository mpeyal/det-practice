import assert from 'node:assert/strict'
import { computeResults } from '../src/lib/scoring.js'
import { parseGradeReply, detectBackend, buildGradingPrompt, backendGrade } from '../src/lib/ai.js'

const reply = { score: 100, cefr: 'B2', task_fulfillment: 'Relevant content.', coherence: 'Clear progression.', vocabulary: 'Appropriate words.', grammar: 'Accurate grammar.', summary: 'Develop examples.', improved_version: 'Improved response.' }
const grade = parseGradeReply(JSON.stringify(reply))
const sample = { id: 'sample', type: 'writing_sample', isSample: true, payload: {} }
const results = computeResults([sample], {}, { sample: grade.frac })
assert.equal(results.subscores.writing, 100, 'Writing samples must count without inflating the AI grade')
assert.equal(results.overall, 100)
assert.equal(computeResults([sample], {}, {}).overall, null, 'Unmarked work must not become a zero or invented grade')
for (const score of [undefined, null, '100', -1, 200]) {
  assert.throws(() => parseGradeReply(JSON.stringify({ ...reply, score })))
}
assert.throws(() => parseGradeReply(JSON.stringify({ score: 100 })))

const originalFetch = globalThis.fetch
let connected = false
globalThis.fetch = async () => {
  if (!connected) throw Error('offline')
  return { json: async () => ({ backend: 'openai-cli', provider: 'openai' }) }
}
assert.equal(await detectBackend(), null)
connected = true
assert.equal((await detectBackend()).provider, 'openai', 'Retry must recover from an earlier failed probe')

globalThis.localStorage = { getItem: () => JSON.stringify({ gradingModels: { openai: 'gpt-5.6-luna' } }) }
globalThis.fetch = async (url, options) => {
  assert.equal(url, '/api/grade')
  const body = JSON.parse(options.body)
  assert.equal(body.models.openai, 'gpt-5.6-luna')
  assert(body.prompt.includes('My favorite season is summer.'))
  assert(body.prompt.includes('punctuation'))
  return { json: async () => ({ ok: true, text: JSON.stringify(reply) }) }
}
assert.equal((await backendGrade({ kind: 'writing', taskLabel: 'Writing Sample', prompt: 'Describe your favorite season.', response: 'My favorite season is summer.' })).score10to160, 100)
globalThis.fetch = originalFetch
delete globalThis.localStorage
assert(buildGradingPrompt({ kind: 'writing', taskLabel: 'Interactive Writing', prompt: 'Explain.', response: 'Answer.' }).includes('evaluate both parts'))
console.log('Writing grading regression checks passed.')
