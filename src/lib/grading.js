// Local auto-grading for all objective item types, with per-blank/per-word
// partial credit. Every grade returns:
//   { score: 0..1, correct: boolean, detail: <type-specific>, studyTags: [..] }
// Subjective (writing/speaking) items return { subjective: true } and are
// graded via AI marking or self-scoring on the review screen.

export function normalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function levenshtein(a, b) {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}

/** Word-level similarity 0..1 between what was said and what was typed (Listen and Type). */
export function sentenceSimilarity(target, response) {
  const tw = normalize(target).split(' ').filter(Boolean)
  const rw = normalize(response).split(' ').filter(Boolean)
  if (!tw.length) return 0
  // word-level edit distance
  const m = tw.length, n = rw.length
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      const same = tw[i - 1] === rw[j - 1] ||
        levenshtein(tw[i - 1], rw[j - 1]) <= (tw[i - 1].length >= 6 ? 1 : 0) // forgive 1 typo in long words
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (same ? 0 : 1))
    }
    prev = cur
  }
  return Math.max(0, 1 - prev[n] / m)
}

/** Token-overlap F1 between a selected span and the key span (Interactive Reading highlight). */
export function spanF1(selected, answer) {
  const sel = new Set(normalize(selected).split(' ').filter(Boolean))
  const ans = normalize(answer).split(' ').filter(Boolean)
  if (!ans.length || !sel.size) return 0
  let hit = 0
  for (const w of ans) if (sel.has(w)) hit++
  const precision = hit / sel.size
  const recall = hit / ans.length
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
}

/** Fraction of expected keywords present in a free-text summary. */
export function keywordCoverage(response, keywords) {
  const words = new Set(normalize(response).split(' ').filter(Boolean))
  const text = normalize(response)
  let hit = 0
  for (const k of keywords) {
    const nk = normalize(k)
    if (nk.includes(' ') ? text.includes(nk) : words.has(nk)) hit++
    else if ([...words].some(w => w.length > 3 && (w.startsWith(nk.slice(0, Math.max(4, nk.length - 2))) ))) hit++ // stem-ish match
  }
  return keywords.length ? hit / keywords.length : 0
}

// ---------- varied coaching tips ----------
// The same static hint on every mistake gets ignored fast, so each item type
// draws from a pool of tips, chosen deterministically per question (word
// hash) — different questions surface different advice.

function hashStr(s) {
  let h = 7
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}
const pickTip = (pool, key) => pool[hashStr(key) % pool.length]

const FB_TIPS = [
  'Decide the part of speech first — does the sentence need a noun, verb or adjective? The grammar around the gap tells you.',
  'Read the words just before and after the gap: they usually pair naturally with the answer (strong coffee, heavy rain, take a decision).',
  'Say the sentence in your head and let the word "sound" itself out before you spell it.',
  'Use the box count: the number of missing letters eliminates most wrong candidates immediately.',
  'Think about the topic of the sentence — the missing word almost always belongs to the same word family.',
  'Watch common endings: -tion, -ment, -ness for nouns, -ous, -ful, -ive for adjectives, -ed/-ing for verb forms.',
]
const RC_TIPS = [
  'Read the WHOLE paragraph once before typing anything — later sentences often reveal the earlier gaps.',
  'Restore the easy words first; every solved word gives you more context for the hard ones.',
  'Check agreement as you type: singular/plural and verb tense must match the rest of the sentence.',
  'The first intact sentence sets the topic — damaged words usually repeat or continue that topic.',
]
const LT_TIPS = [
  'Play once for meaning, once for exact words, once to verify endings (-s, -ed) — that is what the three plays are for.',
  'Most lost points hide in the small words: a, the, of, to. Listen for them specifically on your second play.',
  'Type what you hear during the first play, then use replays only to patch the gaps — do not restart from zero.',
  'If a word sounds unfamiliar, spell it the way it sounds and move on; one strange word costs less than a missing phrase.',
]
const RS_TIPS = [
  'Trust recognition, not plausibility: accept a word only if you have actually READ it before, not because it "sounds English".',
  'Pseudowords copy real spelling patterns — pattern-matching is exactly the trap. Ask "have I met this word?", nothing else.',
  'Do not overthink long words: rare-but-real words (reluctant, vivid) feel stranger than fake ones. Recognition beats logic.',
]

// ---------- master dispatcher ----------

export function gradeItem(item, response) {
  const p = item.payload
  switch (item.type) {
    case 'read_select': {
      const answers = response?.answers || []
      const per = p.items.map((it, i) => ({
        word: it.word, isReal: it.isReal,
        answer: answers[i] ?? null,
        correct: answers[i] === it.isReal,
      }))
      const score = per.filter(x => x.correct).length / p.items.length
      return {
        score, correct: score >= 0.85, detail: per,
        studyTags: score < 0.85 ? ['vocabulary'] : [],
        explanation: pickTip(RS_TIPS, item.id),
      }
    }
    case 'fill_blanks': {
      const typed = (response?.text || '').toLowerCase().trim()
      const target = p.missing
      let hit = 0
      for (let i = 0; i < target.length; i++) if (typed[i] === target[i]) hit++
      const score = hit / target.length
      return {
        score, correct: typed === target,
        detail: { typed, target, word: p.word, sentence: p.before + p.word + p.after },
        studyTags: typed === target ? [] : ['spelling', 'vocabulary'],
        explanation: `The full word is "${p.word}". ${pickTip(FB_TIPS, p.word)}`,
      }
    }
    case 'read_complete': {
      const typedArr = response?.gaps || []
      const gaps = p.parts.filter(x => x.type === 'gap')
      const per = gaps.map((g, i) => {
        const typed = (typedArr[i] || '').toLowerCase().trim()
        let hit = 0
        for (let j = 0; j < g.missing.length; j++) if (typed[j] === g.missing[j]) hit++
        return { shown: g.shown, missing: g.missing, typed, letterScore: hit / g.missing.length, correct: typed === g.missing }
      })
      const score = per.reduce((s, x) => s + x.letterScore, 0) / (per.length || 1)
      return {
        score, correct: per.every(x => x.correct), detail: per,
        studyTags: score < 1 ? ['spelling', 'reading-detail'] : [],
        explanation: pickTip(RC_TIPS, item.id),
      }
    }
    case 'interactive_reading': {
      const r = response || {}
      const parts = []
      p.blanks.forEach((b, i) => parts.push({
        label: `Blank ${i + 1}`, user: r.blanks?.[i] || '(none)', key: b.answer,
        score: r.blanks?.[i] === b.answer ? 1 : 0, explanation: b.explanation,
      }))
      p.highlight.forEach((h, i) => {
        const f1 = spanF1(r.highlights?.[i] || '', h.answer)
        parts.push({
          label: `Highlight ${i + 1}: ${h.question}`, user: r.highlights?.[i] || '(none)', key: h.answer,
          score: f1 >= 0.99 ? 1 : f1 >= 0.6 ? 0.5 : 0, explanation: h.explanation,
        })
      })
      parts.push({ label: 'Main idea', user: r.mainIdea || '(none)', key: p.mainIdea.answer, score: r.mainIdea === p.mainIdea.answer ? 1 : 0, explanation: p.mainIdea.explanation })
      parts.push({ label: 'Best title', user: r.title || '(none)', key: p.title.answer, score: r.title === p.title.answer ? 1 : 0, explanation: p.title.explanation })
      const score = parts.reduce((s, x) => s + x.score, 0) / parts.length
      const tags = []
      if (p.blanks.some((b, i) => r.blanks?.[i] !== b.answer)) tags.push('vocabulary', 'grammar')
      if (p.highlight.some((h, i) => spanF1(r.highlights?.[i] || '', h.answer) < 0.6)) tags.push('reading-detail')
      if (r.mainIdea !== p.mainIdea.answer || r.title !== p.title.answer) tags.push('main-idea')
      return { score, correct: score >= 0.99, detail: parts, studyTags: [...new Set(tags)], explanation: '' }
    }
    case 'listen_type': {
      const sim = sentenceSimilarity(p.text, response?.text || '')
      return {
        score: sim, correct: sim >= 0.99,
        detail: { target: p.text, typed: response?.text || '' },
        studyTags: sim < 0.99 ? ['listening-detail', 'spelling'] : [],
        explanation: pickTip(LT_TIPS, p.text),
      }
    }
    case 'interactive_listening': {
      const r = response || {}
      const parts = []
      // Part A: comprehension blanks (accept the answer or any listed alt)
      let compMissed = false
      p.comprehension.forEach((c, i) => {
        const typed = (r.comprehension?.[i] || '').trim().toLowerCase()
        const ok = typed === c.answer.toLowerCase() || (c.alts || []).some(a => a.toLowerCase() === typed)
        if (!ok) compMissed = true
        parts.push({
          label: `Comprehension ${i + 1}`, user: r.comprehension?.[i] || '(none)', key: c.answer,
          score: ok ? 1 : 0, explanation: c.q,
        })
      })
      // Part B: opener + response rounds (single-best-choice)
      let choiceMissed = false
      const openOk = r.opener === p.opener.answer
      if (!openOk) choiceMissed = true
      parts.push({
        label: 'Conversation opener', user: r.opener || '(none)', key: p.opener.answer,
        score: openOk ? 1 : 0, explanation: p.opener.explanation,
      })
      p.rounds.forEach((rd, i) => {
        const ok = r.responses?.[i] === rd.answer
        if (!ok) choiceMissed = true
        parts.push({
          label: `Response ${i + 1}`, user: r.responses?.[i] || '(none)', key: rd.answer,
          score: ok ? 1 : 0, explanation: rd.explanation,
        })
      })
      const score = parts.reduce((s, x) => s + x.score, 0) / parts.length
      const tags = []
      if (choiceMissed) tags.push('pragmatics')
      if (compMissed) tags.push('listening-detail')
      return { score, correct: score >= 0.99, detail: parts, studyTags: [...new Set(tags)], explanation: '' }
    }
    // subjective types — graded by AI or self-score on the review screen
    case 'write_photo':
    case 'interactive_writing':
    case 'writing_sample':
    case 'speak_photo':
    case 'read_then_speak':
    case 'interactive_speaking':
    case 'speaking_sample':
      return { subjective: true, score: null, correct: null, detail: null, studyTags: [], explanation: '' }
    default:
      return { score: 0, correct: false, detail: null, studyTags: [], explanation: '' }
  }
}

// "What to study" knowledge base used by the review screen.
export const STUDY_TIPS = {
  'vocabulary': { title: 'Vocabulary breadth', tip: 'Read graded readers or news daily and keep a word journal. For Read and Select, only accept words you have actually seen in print before.' },
  'spelling': { title: 'Spelling accuracy', tip: 'Practice common patterns (double consonants, -tion/-sion, ie/ei). Type words you miss three times; typing builds motor memory that the test rewards.' },
  'grammar': { title: 'Grammar & word forms', tip: 'When filling blanks, check what PART OF SPEECH the sentence needs (noun/verb/adjective) and the tense/agreement before choosing letters.' },
  'reading-detail': { title: 'Reading for detail', tip: 'For highlight tasks, find the question\'s keywords in the passage and select the smallest complete span that answers it — not the whole paragraph.' },
  'main-idea': { title: 'Main idea & titles', tip: 'The main idea covers the WHOLE passage, not one detail. Eliminate options that are true but only mentioned once.' },
  'listening-detail': { title: 'Listening for detail', tip: 'Use play one for meaning, play two for exact words, play three to verify endings (-s, -ed) and small words (a/the/of), which carry most of the lost points.' },
  'pragmatics': { title: 'Conversational responses', tip: 'The best reply directly addresses what was JUST said. Cross out options that are polite but ignore the question, or change topic.' },
  'summarizing': { title: 'Summarizing', tip: 'Cover who spoke, what the problem/request was, and what was decided. Two or three sentences, past tense, no small details.' },
  'writing': { title: 'Writing development', tip: 'Use the PEEL shape: Point, Explain, Example, Link. Aim for 60+ words in short tasks and vary sentence openings.' },
  'speaking': { title: 'Speaking fluency', tip: 'Answer the question in the first sentence, then add a reason and an example. Keep talking for the full time — silence costs more than small mistakes.' },
}
