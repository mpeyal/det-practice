// Sanity-checks the bundled content banks against the schema the app expects.
// Run: node scripts/validate-data.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data')
const load = f => JSON.parse(readFileSync(join(root, f), 'utf8'))
let errors = 0
const err = m => { errors++; console.log('  ✗ ' + m) }
const ok = m => console.log('  ✓ ' + m)

// wordlist
try {
  const w = load('wordlist.json')
  if (!Array.isArray(w.real) || w.real.length < 100) err('wordlist.real too small')
  else ok(`wordlist: ${w.real.length} real, ${w.fake.length} fake`)
  const realSet = new Set(w.real)
  const overlap = w.fake.filter(f => realSet.has(f))
  if (overlap.length) err('fake words overlap real: ' + overlap.join(','))
} catch (e) { err('wordlist.json: ' + e.message) }

// sentences
try {
  const s = load('sentences.json')
  if (s.length < 30) err('sentences: only ' + s.length)
  else ok(`sentences: ${s.length}`)
  s.forEach((x, i) => { if (!x.text || !x.level) err(`sentences[${i}] missing fields`) })
} catch (e) { err('sentences.json: ' + e.message) }

// paragraphs
try {
  const p = load('paragraphs.json')
  ok(`paragraphs: ${p.length}`)
  p.forEach((x, i) => {
    if (!x.text || !x.text.includes('. ')) err(`paragraphs[${i}] needs at least two sentences`)
  })
} catch (e) { err('paragraphs.json: ' + e.message) }

// passages (interactive reading — two-panel: passage with {1}..{7} + dropdowns)
try {
  const ps = load('passages.json')
  ok(`passages: ${ps.length}`)
  ps.forEach((p) => {
    const text = p.passage || `${p.paragraph1 || ''} ${p.paragraph2 || ''}`
    const n = p.blanks.length
    for (let k = 1; k <= n; k++) {
      const c = (text.match(new RegExp(`\\{${k}\\}`, 'g')) || []).length
      if (c !== 1) err(`${p.id}: marker {${k}} appears ${c} times`)
    }
    if (n < 5) err(`${p.id}: only ${n} blanks (want ~7)`)
    p.blanks.forEach((b, j) => { if (!b.options.includes(b.answer)) err(`${p.id} blank ${j}: answer not in options`) })
    p.highlight.forEach((h, j) => {
      if (h.answer.includes('{')) err(`${p.id} highlight ${j}: answer contains a gap marker`)
      if (!text.includes(h.answer)) err(`${p.id} highlight ${j}: answer not a substring of the passage`)
    })
    for (const k of ['mainIdea', 'title']) if (!p[k].options.includes(p[k].answer)) err(`${p.id} ${k}: answer not in options`)
  })
} catch (e) { err('passages.json: ' + e.message) }

// conversations (interactive listening)
try {
  const cs = load('conversations.json')
  ok(`conversations: ${cs.length}`)
  cs.forEach(c => {
    const choices = c.turns.filter(t => t.kind === 'choice')
    if (!choices.length) err(`${c.id}: no choice turns`)
    choices.forEach((t, j) => { if (!t.options.includes(t.answer)) err(`${c.id} choice ${j}: answer not in options`) })
    if (c.turns[0].kind !== 'line') err(`${c.id}: must start with a line turn`)
    for (const n of [1, 2]) if (!c.completion.text.includes(`{${n}}`)) err(`${c.id}: completion missing {${n}}`)
    if (c.completion.answers.length !== 2) err(`${c.id}: completion needs 2 answers`)
    if (!c.summary?.keywords?.length) err(`${c.id}: summary keywords missing`)
  })
} catch (e) { err('conversations.json: ' + e.message) }

// writing
try {
  const w = load('writing.json')
  ok(`writing: ${w.interactive.length} interactive, ${w.samples.length} samples`)
  w.interactive.forEach(x => { for (const k of ['prompt', 'followUp', 'model', 'modelFollowUp']) if (!x[k]) err(`${x.id} missing ${k}`) })
  w.samples.forEach(x => { for (const k of ['prompt', 'model']) if (!x[k]) err(`${x.id} missing ${k}`) })
} catch (e) { err('writing.json: ' + e.message) }

// speaking
try {
  const s = load('speaking.json')
  ok(`speaking: ${s.readThenSpeak.length} RTS, ${s.interactive.length} interactive, ${s.samples.length} samples`)
  s.interactive.forEach(x => {
    if (x.questions.length !== 6) err(`${x.id}: needs 6 questions`)
    if (x.models.length !== 6) err(`${x.id}: needs 6 models`)
  })
} catch (e) { err('speaking.json: ' + e.message) }

// photos: each entry needs either a real image file in public/ or an inline svg
try {
  const { existsSync } = await import('node:fs')
  const p = load('photos.json')
  ok(`photos: ${p.length}`)
  p.forEach(x => {
    if (x.img) {
      if (!existsSync(join(root, '..', '..', 'public', x.img))) err(`${x.id}: missing file public/${x.img}`)
    } else if (x.svg) {
      if (!/^<svg[^>]*viewBox=.0 0 400 300/.test(x.svg)) err(`${x.id}: svg missing viewBox 0 0 400 300`)
      if (/<script|<text|onload|onerror/i.test(x.svg)) err(`${x.id}: svg contains disallowed elements`)
    } else err(`${x.id}: needs "img" or "svg"`)
    for (const k of ['alt', 'modelWritten', 'modelSpoken']) if (!x[k]) err(`${x.id} missing ${k}`)
  })
} catch (e) { err('photos.json: ' + e.message) }

console.log(errors ? `\n${errors} problem(s) found` : '\nAll content banks valid ✔')
process.exit(errors ? 1 : 0)
