import React from 'react'
import { lookupWord } from '../lib/vocab.js'
import { normalize } from '../lib/grading.js'

/**
 * Learner card for a missed word: similar words, short contextual meaning,
 * and the Bangla translation — pulled from the bundled offline dictionary.
 */
function VocabCard({ word }) {
  const v = lookupWord(word)
  if (!v) return null
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-xl bg-[#f3fbff] px-3 py-1.5 text-sm">
      <span className="font-black text-[#1899d6]">📖 {word}</span>
      <span className="font-bold text-emerald-700">{v.bn}</span>
      <span className="text-neutral-500">“{v.en}”</span>
      <span className="text-neutral-400">similar: <b className="text-neutral-500">{v.sim.join(', ')}</b></span>
    </div>
  )
}

/** Vocab cards for a list of words (deduped, capped, only ones we know). */
function VocabList({ words, max = 4 }) {
  const seen = new Set()
  const shown = []
  for (const w of words) {
    const key = (w || '').toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    if (lookupWord(key)) shown.push(key)
    if (shown.length >= max) break
  }
  if (!shown.length) return null
  return (
    <div className="mt-2 space-y-1">
      <div className="text-xs font-extrabold uppercase tracking-wide text-neutral-400">Words to learn</div>
      {shown.map(w => <VocabCard key={w} word={w} />)}
    </div>
  )
}

/** Per-item review detail: my answer vs the key, per sub-part. */
export default function DetailView({ item, grade }) {
  const d = grade.detail
  switch (item.type) {
    case 'read_select':
      return (
        <div>
          <div className="flex flex-wrap gap-1.5">
            {d.map((x, i) => (
              <span key={i} title={`You said: ${x.answer == null ? 'no answer' : x.answer ? 'real' : 'not real'}`}
                className={`rounded-lg px-2 py-1 text-sm font-bold ${x.correct ? 'bg-[#d7ffb8] text-[#3f8f00]' : 'bg-[#ffdfe0] text-[#d33131]'}`}>
                {x.word} {x.isReal ? '· real' : '· fake'} {x.correct ? '✓' : '✗'}
              </span>
            ))}
          </div>
          {/* real words the user rejected are vocabulary gaps — teach them */}
          <VocabList words={d.filter(x => !x.correct && x.isReal).map(x => x.word)} />
        </div>
      )
    case 'fill_blanks':
      return (
        <div className="text-sm">
          <p className="mb-1 text-neutral-500">{d.sentence}</p>
          <p><b>Your letters:</b> <span className={d.typed === d.target ? 'text-[#3f8f00]' : 'text-[#d33131]'}>{d.typed || '(none)'}</span>
            {' '}· <b>Correct:</b> <span className="text-[#3f8f00]">{d.target}</span> (word: <b>{d.word}</b>)</p>
          {d.typed !== d.target && <VocabList words={[d.word]} max={1} />}
        </div>
      )
    case 'read_complete':
      return (
        <div>
          <div className="flex flex-wrap gap-1.5">
            {d.map((x, i) => (
              <span key={i} className={`rounded-lg px-2 py-1 text-sm font-bold ${x.correct ? 'bg-[#d7ffb8] text-[#3f8f00]' : 'bg-[#ffdfe0] text-[#d33131]'}`}>
                {x.shown}<u>{x.missing}</u>{!x.correct && <> · you: “{x.typed || '—'}”</>}
              </span>
            ))}
          </div>
          <VocabList words={d.filter(x => !x.correct).map(x => x.shown + x.missing)} />
        </div>
      )
    case 'listen_type': {
      // words from the sentence the user failed to type — teach those
      const typedSet = new Set(normalize(d.typed).split(' '))
      const missed = normalize(d.target).split(' ').filter(w => w.length >= 4 && !typedSet.has(w))
      return (
        <div className="text-sm">
          <p><b>Heard sentence:</b> <span className="text-[#3f8f00]">{d.target}</span></p>
          <p><b>You typed:</b> <span className={grade.correct ? 'text-[#3f8f00]' : 'text-[#d33131]'}>{d.typed || '(nothing)'}</span></p>
          {!grade.correct && <VocabList words={missed} max={3} />}
        </div>
      )
    }
    case 'interactive_reading':
    case 'interactive_listening':
      return (
        <div className="space-y-2">
          {d.map((part, i) => (
            <div key={i} className="rounded-xl bg-neutral-50 p-2.5 text-sm">
              <div className="flex items-center gap-2 font-extrabold">
                <span>{part.score >= 0.99 ? '✅' : part.score > 0 ? '🟡' : '❌'}</span>{part.label}
              </div>
              <div className="mt-1"><b>You:</b> {String(part.user)}</div>
              <div><b>Answer:</b> <span className="text-[#3f8f00]">{part.key}</span></div>
              {part.explanation && <div className="mt-1 text-neutral-500">{part.explanation}</div>}
            </div>
          ))}
        </div>
      )
    default:
      return null
  }
}
