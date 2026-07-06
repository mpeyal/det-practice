// Procedural item generators. These give near-infinite variety for the three
// "mechanical" question types, using the bundled word list / sentence /
// paragraph banks as raw material.

// ---------- Read and Select: real word vs pseudoword ----------

const ONSETS = ['bl', 'br', 'cl', 'cr', 'dr', 'fl', 'gr', 'pl', 'pr', 'sc', 'sl', 'sm', 'sn', 'sp', 'st', 'str', 'tr', 'thr', 'ch', 'sh', 'wh', 'b', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w']
const MIDS = ['a', 'e', 'i', 'o', 'u', 'ai', 'ea', 'ee', 'oa', 'ou', 'oo', 'ar', 'er', 'or', 'ur', 'an', 'en', 'in', 'un', 'am', 'em', 'im', 'ol', 'el', 'il', 'av', 'ev', 'iv', 'ab', 'ub', 'ad', 'ud', 'ag', 'og', 'ig']
const ENDS = ['le', 'er', 'el', 'et', 'it', 'in', 'on', 'ent', 'ant', 'ish', 'ick', 'ock', 'ade', 'ode', 'ine', 'ane', 'one', 'ard', 'ord', 'ure', 'age', 'idge', 'umb', 'ance', 'ery', 'ory', 'ale', 'ime']

/** Rule-based pseudoword generator; rejects anything present in the real-word set. */
export function generateFakeWord(rng, realSet) {
  for (let tries = 0; tries < 40; tries++) {
    const w = rng.pick(ONSETS) + rng.pick(MIDS) + rng.pick(ENDS)
    if (w.length >= 4 && w.length <= 9 && !realSet.has(w)) return w
  }
  return null
}

/**
 * Build a Read-and-Select run: n words shown one at a time,
 * roughly half real, half fake (curated fakes + rule-generated fakes).
 * Difficulty: easy = short everyday real words + obviously odd fakes;
 * hard = longer/rarer real words and a higher share of rule-generated
 * pseudowords, which imitate English morphology most convincingly.
 */
export function genReadSelect(rng, wordlist, n = 18, level = 'medium') {
  const realSet = new Set(wordlist.real)
  // per-word difficulty mix so a run never feels flat: most words sit at the
  // requested band, with some from the neighboring bands (Duolingo-style)
  const dist = level === 'easy' ? ['easy', 'easy', 'easy', 'medium']
    : level === 'hard' ? ['hard', 'hard', 'hard', 'medium']
    : ['easy', 'medium', 'medium', 'hard']

  const realPoolOf = (l) => {
    const p = l === 'easy' ? wordlist.real.filter(w => w.length <= 6)
      : l === 'hard' ? wordlist.real.filter(w => w.length >= 6)
      : wordlist.real
    return p.length ? p : wordlist.real
  }
  const fakePoolOf = (l) => {
    const p = l === 'easy' ? wordlist.fake.filter(w => w.length <= 7)
      : l === 'hard' ? wordlist.fake.filter(w => w.length >= 6)
      : wordlist.fake
    return p.length ? p : wordlist.fake
  }

  const realCount = Math.round(n / 2) + rng.int(3) - 1 // slight variation, like the real test
  const reals = []
  while (reals.length < realCount) {
    const w = rng.pick(realPoolOf(rng.pick(dist)))
    if (!reals.includes(w)) reals.push(w)
  }
  const fakes = []
  while (fakes.length < n - realCount) {
    const l = rng.pick(dist)
    // hard words lean on rule-generated pseudowords (the most deceptive kind)
    const genShare = l === 'easy' ? 0.15 : l === 'hard' ? 0.6 : 0.35
    const w = rng.chance(genShare) ? generateFakeWord(rng, realSet) : rng.pick(fakePoolOf(l))
    if (w && !fakes.includes(w) && !realSet.has(w)) fakes.push(w)
  }
  const items = rng.shuffle([
    ...reals.map(w => ({ word: w, isReal: true })),
    ...fakes.map(w => ({ word: w, isReal: false })),
  ])
  return { items }
}

// ---------- Fill in the Blanks: one word with missing letters ----------

const STOPWORDS = new Set(['the', 'and', 'that', 'this', 'with', 'from', 'they', 'them', 'their', 'there', 'have', 'has', 'had', 'was', 'were', 'been', 'being', 'will', 'would', 'could', 'should', 'about', 'into', 'over', 'under', 'after', 'before', 'because', 'while', 'when', 'where', 'which', 'these', 'those', 'than', 'then', 'very', 'some', 'many', 'much', 'each', 'every', 'other', 'more', 'most', 'also', 'just', 'only', 'even', 'still', 'both'])

function wordTokens(text) {
  // tokens with positions, letters only
  const out = []
  const re = /[A-Za-z]+/g
  let m
  while ((m = re.exec(text))) out.push({ word: m[0], start: m.index, end: m.index + m[0].length })
  return out
}

/**
 * Turn a bank sentence into a Fill-in-the-Blanks item:
 * one content word has its second half removed; the user types the missing letters.
 * Difficulty controls WHICH word is masked (longer/rarer at hard) and HOW MANY
 * letters remain visible (easy ~60%, medium 50%, hard ~a third).
 */
export function genFillBlank(rng, sentenceObj, level = 'medium') {
  const text = sentenceObj.text
  const tokens = wordTokens(text)
  const [minLen, maxLen] = level === 'easy' ? [5, 8] : level === 'hard' ? [7, 12] : [5, 10]
  let candidates = tokens.filter(t =>
    t.word.length >= minLen && t.word.length <= maxLen &&
    !STOPWORDS.has(t.word.toLowerCase()) &&
    t.word[0] === t.word[0].toLowerCase() // avoid sentence-initial / proper nouns
  )
  if (!candidates.length) {
    candidates = tokens.filter(t => t.word.length >= 5 && !STOPWORDS.has(t.word.toLowerCase()) && t.word[0] === t.word[0].toLowerCase())
  }
  const target = candidates.length ? rng.pick(candidates) : tokens[Math.floor(tokens.length / 2)]
  const len = target.word.length
  const shownCount = Math.max(1,
    level === 'easy' ? Math.ceil(len * 0.6) :
    level === 'hard' ? Math.floor(len / 3) :
    Math.floor(len / 2))
  return {
    before: text.slice(0, target.start),
    after: text.slice(target.end),
    shown: target.word.slice(0, shownCount),
    missing: target.word.slice(shownCount).toLowerCase(),
    word: target.word,
    themes: sentenceObj.themes || [],
  }
}

// ---------- Read and Complete: paragraph C-test ----------

/**
 * Turn a bank paragraph into a Read-and-Complete item.
 * First sentence stays intact (context), then roughly every second eligible
 * word loses its second half. Returns a token stream of text + gap parts.
 */
export function genReadComplete(rng, paragraphObj, level = 'medium') {
  const text = paragraphObj.text
  const firstBreak = text.indexOf('. ') + 2 // keep the first sentence whole
  const head = text.slice(0, firstBreak)
  const rest = text.slice(firstBreak)

  // harder = more gaps, longer words eligible, fewer letters shown
  const maxGaps = level === 'easy' ? 6 : level === 'hard' ? 12 : 9
  const maxWordLen = level === 'hard' ? 12 : 10
  const step = level === 'hard' ? 2 : 2

  const tokens = wordTokens(rest)
  const eligible = tokens.filter(t =>
    t.word.length >= 4 && t.word.length <= maxWordLen &&
    t.word[0] === t.word[0].toLowerCase()
  )
  // pick alternating eligible words, capped
  const chosen = []
  for (let i = rng.int(2); i < eligible.length && chosen.length < maxGaps; i += step) {
    chosen.push(eligible[i])
  }

  const parts = [{ type: 'text', text: head }]
  let cursor = 0
  for (const t of chosen) {
    if (t.start > cursor) parts.push({ type: 'text', text: rest.slice(cursor, t.start) })
    const half = Math.ceil(t.word.length / 2)
    const shownCount = Math.max(1,
      level === 'easy' ? half :
      level === 'hard' ? half - (t.word.length > 5 ? 2 : 1) :
      half - (t.word.length > 6 ? 1 : 0))
    parts.push({
      type: 'gap',
      shown: t.word.slice(0, shownCount),
      missing: t.word.slice(shownCount).toLowerCase(),
    })
    cursor = t.end
  }
  parts.push({ type: 'text', text: rest.slice(cursor) })
  return { parts, topic: paragraphObj.topic, gapCount: chosen.length }
}
