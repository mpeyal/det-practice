// Difficulty engine.
//
// Every content bank is split into easy / medium / hard tiers. Sentences
// carry an explicit "level" written by the author; the other banks are
// scored heuristically (average word length, share of long words, sentence
// length) and split into terciles, so each tier is always non-empty.
//
// The Full Timed Exam is ADAPTIVE like the real DET: it starts at medium,
// steps up when you score well on an item and down when you struggle —
// see materializeItem() in exam.js and the level logic in ExamRunner.
// Practice sets use a fixed training ramp: sets 1-10 easy, 11-20 medium,
// 21-30 hard.

export const LEVELS = ['easy', 'medium', 'hard']

/** 0..1 rough reading-difficulty score for a piece of text. */
export function textDifficulty(text) {
  const words = text.match(/[A-Za-z']+/g) || []
  if (!words.length) return 0
  const avgLen = words.reduce((s, w) => s + w.length, 0) / words.length
  const longFrac = words.filter(w => w.length >= 7).length / words.length
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 2)
  const wordsPerSentence = words.length / (sentences.length || 1)
  const a = Math.min(1, Math.max(0, (avgLen - 3.8) / 2.4))
  const b = Math.min(1, Math.max(0, longFrac / 0.42))
  const c = Math.min(1, Math.max(0, (wordsPerSentence - 7) / 16))
  return a * 0.4 + b * 0.35 + c * 0.25
}

/** Split a bank into difficulty terciles by the score of getText(item). */
export function tierBank(bank, getText) {
  const scored = bank
    .map(x => ({ x, s: textDifficulty(getText(x)) }))
    .sort((p, q) => p.s - q.s)
  const n = scored.length
  const t1 = Math.max(1, Math.floor(n / 3))
  const t2 = Math.max(t1 + 1, Math.floor((2 * n) / 3))
  return {
    easy: scored.slice(0, t1).map(p => p.x),
    medium: scored.slice(t1, t2).map(p => p.x),
    hard: scored.slice(t2).map(p => p.x),
  }
}

export function stepUp(level) {
  return level === 'easy' ? 'medium' : 'hard'
}
export function stepDown(level) {
  return level === 'hard' ? 'medium' : 'easy'
}

/** Difficulty tier for a numbered practice set (training ramp). */
export function levelForSet(setNo) {
  if (setNo == null) return 'medium'
  return setNo <= 10 ? 'easy' : setNo <= 20 ? 'medium' : 'hard'
}

export const LEVEL_META = {
  easy: { label: 'Beginner', icon: '🌱', color: '#58cc02' },
  medium: { label: 'Medium', icon: '🌿', color: '#1cb0f6' },
  hard: { label: 'Advanced', icon: '🔥', color: '#ff4b4b' },
}

// Marks per question by difficulty — harder questions are worth more.
export const LEVEL_MARKS = { easy: 5, medium: 8, hard: 10 }

export function marksFor(item) {
  return LEVEL_MARKS[item.level] ?? LEVEL_MARKS.medium
}
