// Offline EN→BN learner dictionary covering every word the generators can
// test (built from the content banks; see scripts/vocab-words-*.txt).
// Each entry: { bn: Bangla translation, en: short meaning, sim: [2 similar words] }

import p1 from '../data/vocab-part1.json'
import p2 from '../data/vocab-part2.json'
import p3 from '../data/vocab-part3.json'

const VOCAB = { ...p1, ...p2, ...p3 }

/** Look up a word, trying simple stemming so "systems"/"gathered" still hit. */
export function lookupWord(word) {
  const lw = (word || '').toLowerCase().replace(/[^a-z]/g, '')
  if (!lw) return null
  if (VOCAB[lw]) return { word: lw, ...VOCAB[lw] }
  const tries = []
  for (const [suf, rep] of [['ies', 'y'], ['ied', 'y'], ['es', ''], ['s', ''], ['ing', ''], ['ing', 'e'], ['ed', ''], ['ed', 'e'], ['ly', ''], ['er', ''], ['est', '']]) {
    if (lw.endsWith(suf) && lw.length - suf.length >= 3) tries.push(lw.slice(0, lw.length - suf.length) + rep)
  }
  // doubled final consonant: running -> run
  const m = lw.match(/^(.+?)([bdfglmnprt])\2(ing|ed)$/)
  if (m) tries.push(m[1] + m[2])
  for (const t of tries) if (VOCAB[t]) return { word: t, ...VOCAB[t] }
  return null
}

export function vocabSize() {
  return Object.keys(VOCAB).length
}
