// Exam assembly: builds Full Timed Exams #1..#50 deterministically from seeds
// (generated items are always fresh; banked items are rotated so repeats are
// rare across exams), plus single-type practice sets.

import { makeRng, randomRng } from './rng.js'
import { genReadSelect, genFillBlank, genReadComplete } from './generators.js'
import { tierBank, levelForSet } from './difficulty.js'

import wordlist from '../data/wordlist.json'
import sentences from '../data/sentences.json'
import paragraphs from '../data/paragraphs.json'
import passages from '../data/passages.json'
import conversations from '../data/conversations.json'
import writing from '../data/writing.json'
import speaking from '../data/speaking.json'
import photos from '../data/photos.json'

export const DATA = { wordlist, sentences, paragraphs, passages, conversations, writing, speaking, photos }

// Banks split into easy/medium/hard tiers (sentences use their authored
// level; the rest are scored heuristically — see difficulty.js).
export const TIERED = {
  sentences: {
    easy: sentences.filter(s => s.level === 'easy'),
    medium: sentences.filter(s => s.level === 'medium'),
    hard: sentences.filter(s => s.level === 'hard'),
  },
  paragraphs: tierBank(paragraphs, p => p.text),
  // passages carry an authored level; fall back to the heuristic if absent
  passages: passages[0]?.level
    ? { easy: passages.filter(p => p.level === 'easy'), medium: passages.filter(p => p.level === 'medium'), hard: passages.filter(p => p.level === 'hard') }
    : tierBank(passages, p => p.passage || `${p.paragraph1} ${p.paragraph2}`),
  conversations: tierBank(conversations, c =>
    c.dialogue.map(t => t.text).join(' ') + ' ' + c.rounds.map(r => r.options.join(' ')).join(' ')),
}

export const EXAM_COUNT = 50

// Per-item time limits in seconds (matches the 2026 DET format).
export const TIME = {
  read_select_item: 5,      // per word
  fill_blanks: 20,          // per sentence
  read_complete: 180,
  interactive_reading: 180, // per passage (6 linked tasks)
  listen_type: 60,          // includes listening + typing, max 3 plays
  interactive_listening: 240,
  il_summary: 75,
  write_photo: 60,
  interactive_writing_1: 300,
  interactive_writing_2: 180,
  writing_sample: 300,
  speak_photo: 90,          // speak time (after 20s to look at the photo)
  speak_prep: 20,
  read_then_speak_prep: 30,
  read_then_speak: 90,
  interactive_speaking_q: 35, // per question, 6 questions
  speaking_sample: 180,
  speaking_sample_prep: 30,
}

let uid = 0
const mk = (type, payload, extra = {}) => ({ id: `q${++uid}_${type}`, type, payload, ...extra })

/**
 * Deterministic pick of `n` bank items for exam #examNo. Rotates through the
 * bank so consecutive exams use different items; the offset stride keeps
 * repeats rare until the bank is exhausted many times over.
 */
function rotate(bank, examNo, n, salt = 0) {
  const out = []
  const start = ((examNo - 1) * n + salt * 7) % bank.length
  for (let i = 0; i < n; i++) out.push(bank[(start + i * (salt ? 3 : 1)) % bank.length])
  // dedupe fallback for tiny banks
  return [...new Set(out)].slice(0, n)
}

/**
 * Build Full Timed Exam #examNo (1..50). ~45 min graded + ~10 min samples.
 *
 * Objective question types are emitted as ADAPTIVE descriptors (no payload
 * yet): the ExamRunner materializes each one at the moment it's shown, using
 * the current difficulty level — the exam gets harder as you do well and
 * eases off when you struggle, like the real DET. Writing/speaking prompts
 * are difficulty-neutral and stay pre-assigned.
 */
export function assembleExam(examNo) {
  const rng = makeRng(examNo * 7919 + 13)
  uid = 0
  const items = []
  // adaptive descriptor: payload chosen at show-time based on current level
  const mkA = (type, extra = {}) =>
    items.push({ id: `q${++uid}_${type}`, type, adaptive: true, seed: 1 + rng.int(2 ** 31 - 2), ...extra })

  // --- graded adaptive section (types interleaved like the real exam) ---
  mkA('read_select', { timeLimit: 18 * TIME.read_select_item })
  for (let i = 0; i < 7; i++) mkA('fill_blanks', { timeLimit: TIME.fill_blanks })
  mkA('listen_type', { timeLimit: TIME.listen_type })
  for (let i = 0; i < 2; i++) mkA('read_complete', { timeLimit: TIME.read_complete })
  for (let i = 0; i < 3; i++) mkA('listen_type', { timeLimit: TIME.listen_type })
  // the real test has TWO Interactive Reading passages
  for (let i = 0; i < 2; i++) mkA('interactive_reading', { timeLimit: TIME.interactive_reading })
  for (let i = 0; i < 2; i++) mkA('interactive_listening', { timeLimit: TIME.interactive_listening })

  // the real test shows THREE Write About the Photo images (1 min each),
  // plus one photo for the speaking task — all distinct
  const photo = rotate(photos, examNo, 4, 5)
  for (let i = 0; i < 3; i++) items.push(mk('write_photo', { photo: photo[i] }, { timeLimit: TIME.write_photo }))

  const iw = rotate(writing.interactive, examNo, 1, 6)[0]
  items.push(mk('interactive_writing', iw, { timeLimit: TIME.interactive_writing_1 + TIME.interactive_writing_2 }))

  items.push(mk('speak_photo', { photo: photo[3] }, { timeLimit: TIME.speak_prep + TIME.speak_photo }))
  items.push(mk('read_then_speak', rotate(speaking.readThenSpeak, examNo, 1, 7)[0], { timeLimit: TIME.read_then_speak_prep + TIME.read_then_speak }))
  items.push(mk('interactive_speaking', rotate(speaking.interactive, examNo, 1, 8)[0], { timeLimit: 6 * TIME.interactive_speaking_q }))

  // --- ungraded samples (shown to institutions on the real test) ---
  items.push(mk('writing_sample', rotate(writing.samples, examNo, 1, 9)[0], { timeLimit: TIME.writing_sample, isSample: true }))
  items.push(mk('speaking_sample', rotate(speaking.samples, examNo, 1, 10)[0], { timeLimit: TIME.speaking_sample_prep + TIME.speaking_sample, isSample: true }))

  // Interleave the middle a bit so types feel mixed (keep read_select first,
  // samples last, like the real exam).
  const head = items.slice(0, 1)
  const tail = items.slice(-2)
  const mid = rng.shuffle(items.slice(1, -2))
  return { examNo, items: [...head, ...mid, ...tail] }
}

/**
 * Turn an adaptive exam descriptor into a concrete question at the given
 * difficulty level. `usedKeys` prevents the same banked sentence/passage/
 * conversation appearing twice within one exam run.
 */
export function materializeItem(item, level, usedKeys = new Set()) {
  if (!item.adaptive) return item
  const rng = makeRng(item.seed)
  const pick = (tiers, keyOf) => {
    const tierPool = tiers[level] && tiers[level].length ? tiers[level] : [...tiers.easy, ...tiers.medium, ...tiers.hard]
    const avail = tierPool.filter(x => !usedKeys.has(keyOf(x)))
    const pool = avail.length ? avail : tierPool
    const chosen = pool[rng.int(pool.length)]
    usedKeys.add(keyOf(chosen))
    return chosen
  }
  const base = { ...item, level }
  switch (item.type) {
    case 'read_select': return { ...base, payload: genReadSelect(rng, wordlist, 18, level) }
    case 'fill_blanks': return { ...base, payload: genFillBlank(rng, pick(TIERED.sentences, s => s.text), level) }
    case 'listen_type': return { ...base, payload: { text: pick(TIERED.sentences, s => s.text).text } }
    case 'read_complete': return { ...base, payload: genReadComplete(rng, pick(TIERED.paragraphs, p => p.text), level) }
    case 'interactive_reading': return { ...base, payload: pick(TIERED.passages, p => p.id) }
    case 'interactive_listening': return { ...base, payload: pick(TIERED.conversations, c => c.id) }
    default: return base
  }
}

export const PRACTICE_SET_COUNT = 30

/** Stable small hash so each question type gets its own seed space. */
function typeSeed(type) {
  let h = 7
  for (const c of type) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

/**
 * Build a practice drill for one question type.
 * With a setNo (1..PRACTICE_SET_COUNT) the set is deterministic — "Fill in
 * the Blanks · Set #7" is always the same items, so sets can be worked
 * through one by one. Without setNo the drill is random (surprise mode).
 */
// Duolingo-style difficulty MIX per band: every set contains a ramp of
// levels rather than one flat difficulty. Beginner sets lean easy but end
// with medium; Advanced sets start at medium and climb to hard.
const BAND_MIX = {
  easy: ['easy', 'easy', 'easy', 'medium', 'medium'],
  medium: ['easy', 'medium', 'medium', 'medium', 'hard'],
  hard: ['medium', 'medium', 'hard', 'hard', 'hard'],
}

export function assemblePractice(type, count = 5, setNo = null) {
  const rng = setNo ? makeRng(typeSeed(type) + setNo * 7919) : randomRng()
  // band focus: sets 1-10 beginner, 11-20 medium, 21-30 advanced
  const band = levelForSet(setNo)
  uid = 0
  const items = []
  const add = (t, p, extra) => items.push(mk(t, p, extra))

  /** Per-question levels for a set of n items: ramped easy→hard within the band. */
  const levelsFor = (n) => {
    if (!setNo) return Array.from({ length: n }, () => rng.pick(['easy', 'medium', 'medium', 'hard']))
    const pat = BAND_MIX[band]
    return Array.from({ length: n }, (_, i) => pat[Math.min(pat.length - 1, Math.floor((i * pat.length) / n))])
  }

  /**
   * Pick `n` items from a full bank (difficulty-neutral types). With a set
   * number, consecutive sets WALK the bank in order (wrapping) so every item
   * is used before any repeats; "surprise me" samples randomly.
   */
  const fromBank = (bank, n, idx = setNo ? setNo - 1 : null) => {
    const need = Math.min(n, bank.length)
    if (idx == null) return rng.sample(bank, need)
    const start = (idx * need) % bank.length
    return Array.from({ length: need }, (_, i) => bank[(start + i) % bank.length])
  }

  /** Pick the i-th banked item at a specific level, walking that tier across sets. */
  const setIdx = setNo ? (setNo - 1) % 10 : null
  const pickTier = (tiers, lvl, i, salt = 0) => {
    const bank = tiers[lvl] && tiers[lvl].length ? tiers[lvl] : [...tiers.easy, ...tiers.medium, ...tiers.hard]
    if (setIdx == null) return rng.pick(bank)
    return bank[(setIdx * 5 + i + salt * 7) % bank.length]
  }

  switch (type) {
    case 'read_select':
      // the 18 words inside are themselves difficulty-mixed by band
      add(type, genReadSelect(rng, wordlist, 18, band), { timeLimit: 18 * TIME.read_select_item, level: band }); break
    case 'fill_blanks':
      levelsFor(count).forEach((l, i) =>
        add(type, genFillBlank(rng, pickTier(TIERED.sentences, l, i), l), { timeLimit: TIME.fill_blanks, level: l })); break
    case 'read_complete':
      levelsFor(Math.min(count, 3)).forEach((l, i) =>
        add(type, genReadComplete(rng, pickTier(TIERED.paragraphs, l, i), l), { timeLimit: TIME.read_complete, level: l })); break
    case 'interactive_reading':
      levelsFor(Math.min(count, 2)).forEach((l, i) =>
        add(type, pickTier(TIERED.passages, l, i), { timeLimit: TIME.interactive_reading, level: l })); break
    case 'listen_type':
      // salt offsets the rotation so listening sets don't mirror fill-blank sets
      levelsFor(count).forEach((l, i) =>
        add(type, { text: pickTier(TIERED.sentences, l, i, 3).text }, { timeLimit: TIME.listen_type, level: l })); break
    case 'interactive_listening':
      levelsFor(Math.min(count, 2)).forEach((l, i) =>
        add(type, pickTier(TIERED.conversations, l, i), { timeLimit: TIME.interactive_listening, level: l })); break
    case 'write_photo':
      for (const ph of fromBank(photos, Math.min(count, 3))) add(type, { photo: ph }, { timeLimit: TIME.write_photo }); break
    case 'interactive_writing':
      add(type, fromBank(writing.interactive, 1)[0], { timeLimit: TIME.interactive_writing_1 + TIME.interactive_writing_2 }); break
    case 'writing_sample':
      add(type, fromBank(writing.samples, 1)[0], { timeLimit: TIME.writing_sample, isSample: true }); break
    case 'speak_photo':
      // offset so speaking-photo sets don't mirror writing-photo sets
      for (const ph of fromBank([...photos.slice(5), ...photos.slice(0, 5)], Math.min(count, 2))) add(type, { photo: ph }, { timeLimit: TIME.speak_prep + TIME.speak_photo }); break
    case 'read_then_speak':
      for (const sp of fromBank(speaking.readThenSpeak, Math.min(count, 2))) add(type, sp, { timeLimit: TIME.read_then_speak_prep + TIME.read_then_speak }); break
    case 'interactive_speaking':
      add(type, fromBank(speaking.interactive, 1)[0], { timeLimit: 6 * TIME.interactive_speaking_q }); break
    case 'speaking_sample':
      add(type, fromBank(speaking.samples, 1)[0], { timeLimit: TIME.speaking_sample_prep + TIME.speaking_sample, isSample: true }); break
    default: break
  }
  // items without an explicit per-question level get the band's focus level
  return { items: items.map(it => (it.level ? it : { ...it, level: band })) }
}

/** Skill groups for "practice a whole skill" mode. */
export const SKILL_GROUPS = {
  reading: ['read_select', 'fill_blanks', 'read_complete', 'interactive_reading'],
  listening: ['listen_type', 'interactive_listening'],
  writing: ['write_photo', 'interactive_writing', 'writing_sample'],
  speaking: ['speak_photo', 'read_then_speak', 'interactive_speaking', 'speaking_sample'],
}

export function assembleSkillPractice(skill, setNo = null) {
  const parts = SKILL_GROUPS[skill].map(t => assemblePractice(t, 2, setNo).items)
  uid = 0
  return { items: parts.flat().map(it => ({ ...it, id: `s_${skill}_${++uid}_${it.type}` })) }
}

export const TYPE_LABELS = {
  read_select: 'Read and Select',
  fill_blanks: 'Fill in the Blanks',
  read_complete: 'Read and Complete',
  interactive_reading: 'Interactive Reading',
  listen_type: 'Listen and Type',
  interactive_listening: 'Interactive Listening',
  write_photo: 'Write About the Photo',
  interactive_writing: 'Interactive Writing',
  writing_sample: 'Writing Sample',
  speak_photo: 'Speak About the Photo',
  read_then_speak: 'Read, Then Speak',
  interactive_speaking: 'Interactive Speaking',
  speaking_sample: 'Speaking Sample',
}
