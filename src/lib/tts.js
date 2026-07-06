// Offline text-to-speech built on the browser's SpeechSynthesis API.
// All "listening" audio in the app is produced here — no audio files needed.
//
// Voice strategy (cross-platform: Windows / macOS / Linux):
// - Every available English voice is scored for quality (neural/natural/
//   premium voices rank far above robotic system ones).
// - Voices are tagged male/female by name, and the app keeps a POOL of the
//   best voices of each gender:
//     * Listen and Type rotates through the pool per question (deterministic
//       per item), so you hear different speakers like on the real test.
//     * Interactive Listening uses a female/male pair so the two sides of the
//       conversation are easy to tell apart.
// - The user can pin a specific female and male voice in Settings.
//
// Best quality per platform:
//   macOS  — System Settings ▸ Accessibility ▸ Spoken Content ▸ System Voice
//            ▸ Manage Voices… → download "Enhanced"/"Premium" voices (Ava,
//            Zoe, Evan, Nathan…). They appear in Safari and Chrome.
//   Windows — Microsoft Edge ships "… Online (Natural)" neural voices.
//   Both — Chrome's "Google US English" voices are decent everywhere.

import { getSettings } from './storage.js'

let cachedVoices = []

function loadVoices() {
  cachedVoices = window.speechSynthesis ? window.speechSynthesis.getVoices() : []
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices()
  window.speechSynthesis.onvoiceschanged = loadVoices
}

export function ttsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

// ---------- voice ranking & gender tagging ----------

const FEMALE = /aria|jenny|jane|sonia|libby|maisie|michelle|emma|ana\b|clara|natasha|hazel|susan|zira|samantha|allison|ava|karen|moira|tessa|fiona|veena|kate|serena|zoe|nicky|joanna|salli|kendra|kimberly|ivy|olivia|amy|aditi|raveena|catherine|linda|heather|female/i
const MALE = /guy\b|davis|tony|ryan|thomas|william|liam|christopher|eric\b|brian|andrew|roger|steffan|david|mark\b|james|george|alex\b|daniel|oliver|fred|rishi|aaron|evan|nathan|tom\b|lee\b|gordon|matthew|justin|joey|russell|male/i

export function guessGender(v) {
  if (FEMALE.test(v.name)) return 'female'
  if (MALE.test(v.name)) return 'male'
  return 'unknown'
}

/** Heuristic quality ranking: neural/premium voices far above robotic ones. */
export function scoreVoice(v) {
  const n = v.name.toLowerCase()
  let s = 0
  if (/natural/.test(n)) s += 8          // Edge neural ("Aria Online (Natural)")
  if (/neural/.test(n)) s += 8
  if (/premium|enhanced/.test(n)) s += 7 // macOS downloaded high-quality voices
  if (/siri/.test(n)) s += 6             // Safari-exposed Siri voices
  if (/google/.test(n)) s += 4           // Chrome server voices
  if (/online/.test(n)) s += 2
  if (/samantha|ava|zoe|evan|nathan|alex\b/.test(n)) s += 2 // top macOS names
  if (/^en-us/i.test(v.lang)) s += 1
  if (/david|zira|mark desktop|desktop|espeak|compact|whisper|bad news|albert|zarvox|trinoids|bells|boing|bubbles|cellos|jester|organ|superstar|wobble/.test(n)) s -= 6
  return s
}

/** All English voices, best-sounding first. */
export function englishVoices() {
  if (!cachedVoices.length) loadVoices()
  return cachedVoices
    .filter(v => /^en([-_]|$)/i.test(v.lang))
    .sort((a, b) => scoreVoice(b) - scoreVoice(a))
}

/** Best voice of a gender, honoring the user's pinned choice in Settings. */
export function voiceOfGender(gender) {
  const { voiceFemale, voiceMale } = getSettings()
  const pool = englishVoices()
  if (!pool.length) return cachedVoices[0] || null
  const pinned = gender === 'female' ? voiceFemale : gender === 'male' ? voiceMale : ''
  if (pinned) {
    const m = pool.find(v => v.name === pinned)
    if (m) return m
  }
  return pool.find(v => guessGender(v) === gender) || pool[0]
}

/** Default single voice (used when variety is off): female pick, else best. */
export function pickVoice() {
  return voiceOfGender('female')
}

/**
 * The rotation pool: up to 4 of the best voices, mixing genders when
 * possible, with the user's pinned voices always included.
 */
export function voicePool() {
  const pool = englishVoices()
  if (!pool.length) return []
  const out = []
  const push = v => { if (v && !out.some(x => x.name === v.name)) out.push(v) }
  push(voiceOfGender('female'))
  push(voiceOfGender('male'))
  for (const v of pool) { if (out.length >= 4) break; push(v) }
  return out
}

function hashStr(s) {
  let h = 7
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

/**
 * Voice for a given question (keyed by item id): rotates through the pool so
 * consecutive listening items use different speakers. With "vary voices" off,
 * always the pinned/default voice.
 */
export function voiceForKey(key) {
  const { varyVoices } = getSettings()
  if (!varyVoices) return pickVoice()
  const pool = voicePool()
  if (!pool.length) return null
  return pool[hashStr(key) % pool.length]
}

/** Female/male pair for two-speaker conversations (partner first). */
export function conversationVoices() {
  const f = voiceOfGender('female')
  const m = voiceOfGender('male')
  if (f && m && f.name !== m.name) return [f, m]
  const pool = englishVoices()
  return [pool[0] || f, pool[1] || pool[0] || m]
}

// ---------- speaking ----------

let activeUtterance = null

/** Speak text; resolves when finished (or immediately if unsupported). */
export function speak(text, { rate = 1, voice = null, voiceKey = null } = {}) {
  return new Promise((resolve) => {
    if (!ttsSupported()) { resolve(false); return }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = rate
    const v = voice || (voiceKey != null ? voiceForKey(voiceKey) : pickVoice())
    if (v) { u.voice = v; u.lang = v.lang }
    u.onend = () => { activeUtterance = null; resolve(true) }
    u.onerror = () => { activeUtterance = null; resolve(false) }
    activeUtterance = u
    window.speechSynthesis.speak(u)
  })
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel()
  activeUtterance = null
}

export function isSpeaking() {
  return ttsSupported() && window.speechSynthesis.speaking
}
