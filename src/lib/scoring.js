// Score estimation on the DET 10–160 scale, plus per-skill subscores.
// This is an ESTIMATE for study purposes: accuracy fractions are mapped onto
// the scale with a mild curve (the real test uses IRT-based adaptive scoring).

import { gradeItem } from './grading.js'

export const SKILL_OF_TYPE = {
  read_select: 'reading',
  fill_blanks: 'reading',
  read_complete: 'reading',
  interactive_reading: 'reading',
  listen_type: 'listening',
  interactive_listening: 'listening',
  write_photo: 'writing',
  interactive_writing: 'writing',
  writing_sample: 'writing',
  speak_photo: 'speaking',
  read_then_speak: 'speaking',
  interactive_speaking: 'speaking',
  speaking_sample: 'speaking',
}

export function toScale(frac) {
  if (frac == null) return null
  // mild curve: random-ish guessing (~40%) lands near 60, perfect = 160
  const curved = Math.pow(Math.max(0, Math.min(1, frac)), 0.85)
  return Math.max(10, Math.min(160, Math.round((10 + curved * 150) / 5) * 5))
}

// Difficulty weighting, like the real adaptive test: a correct answer on a
// hard item proves more ability than one on an easy item. A perfect run that
// never leaves easy tops out around ~120; reaching 160 requires beating hard
// items. (Writing/speaking grades are absolute, so they aren't weighted.)
const LEVEL_WEIGHT = { easy: 0.7, medium: 0.88, hard: 1 }

/**
 * items: exam items; responses: map itemId -> response;
 * subjectiveScores: map itemId -> 0..1 (from AI marking or self-scoring).
 * Ungraded samples (isSample) are excluded, like the real test.
 */
export function computeResults(items, responses, subjectiveScores = {}) {
  const skills = { reading: { got: 0, of: 0 }, listening: { got: 0, of: 0 }, writing: { got: 0, of: 0 }, speaking: { got: 0, of: 0 } }
  const graded = []
  for (const item of items) {
    const g = gradeItem(item, responses[item.id])
    graded.push({ item, response: responses[item.id], grade: g })
    if (item.isSample) continue
    const skill = SKILL_OF_TYPE[item.type]
    if (g.subjective) {
      const s = subjectiveScores[item.id]
      if (s != null) { skills[skill].got += s; skills[skill].of += 1 }
    } else {
      skills[skill].got += g.score * (LEVEL_WEIGHT[item.level] ?? LEVEL_WEIGHT.medium)
      skills[skill].of += 1
    }
  }
  const sub = {}
  let wSum = 0, wOf = 0
  for (const k of Object.keys(skills)) {
    const { got, of } = skills[k]
    sub[k] = of ? toScale(got / of) : null
    if (of) { wSum += got; wOf += of }
  }
  return {
    overall: wOf ? toScale(wSum / wOf) : null,
    subscores: sub,
    graded,
  }
}

/** Collect study tags from graded results -> ordered list of weak areas. */
export function studySummary(graded) {
  const counts = {}
  for (const { grade } of graded) {
    if (grade.subjective) continue
    if (grade.score != null && grade.score >= 0.85) continue
    for (const t of grade.studyTags || []) counts[t] = (counts[t] || 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([tag, n]) => ({ tag, n }))
}
