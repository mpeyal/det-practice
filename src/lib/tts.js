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
import { speakNeural, stopNeural, isDownloaded, isNeuralSpeaking, storedNeuralVoices, STUDIO_VOICES } from './neuralTts.js'
import VOICE_PACK from '../data/voicePack.json'

// ---- pre-rendered Studio audio (bundled MP3s) ----
// The exam's spoken content comes from finite banks, so every clip is rendered
// ONCE with the Studio (Piper) voices at build time and shipped as MP3. At
// runtime we just play the matching file — instant, Studio quality, offline,
// and with NO model download. voicePack.json is the manifest of available keys.
const _pack = new Set(VOICE_PACK)

/** Deterministic key for a clip — MUST match scripts/render-voices.py exactly. */
function packKey(text, gender) {
  let h = 7
  const s = gender + String(text)
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h.toString(16)
}
function preRenderedUrl(text, gender) {
  if (!_pack.size) return null
  const k = packKey(text, gender)
  return _pack.has(k) ? `${import.meta.env.BASE_URL}voices/${k}.mp3` : null
}

let _preAudio = null
function playUrl(url, rate) {
  return new Promise((resolve) => {
    let a
    try { a = new Audio(url) } catch { resolve(false); return }
    _preAudio = a
    a.playbackRate = rate || 1
    if ('preservesPitch' in a) a.preservesPitch = true
    let done = false
    const fin = (ok) => { if (done) return; done = true; if (_preAudio === a) _preAudio = null; resolve(ok) }
    a.onended = () => fin(true)
    a.onerror = () => fin(false)
    a.play().catch(() => fin(false))
  })
}

// learn which studio voices are downloaded as soon as the app starts, so the
// first listening question already uses them when available
if (typeof window !== 'undefined') storedNeuralVoices().catch(() => {})

// Which engine speaks: 'neural' = bundled Studio voices (Piper — identical
// professional quality on Mac/Windows/web), 'system' = OS voices.
// While a Studio voice is still downloading, speak() falls back to the system
// voice for that utterance so nothing ever blocks.
function engine() { return getSettings().ttsEngine || 'neural' }

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

/** Wait until the OS voice list is populated (it loads async on first use). */
function ensureVoicesLoaded(timeout = 2500) {
  return new Promise((resolve) => {
    if (!ttsSupported()) { resolve(false); return }
    loadVoices()
    if (cachedVoices.length) { resolve(true); return }
    let done = false
    const finish = () => { if (done) return; done = true; resolve(cachedVoices.length > 0) }
    window.speechSynthesis.onvoiceschanged = () => { loadVoices(); if (cachedVoices.length) finish() }
    setTimeout(finish, timeout)
  })
}

/**
 * Warm the audio engine before a session. Studio clips are pre-rendered and
 * bundled (nothing to load), so this just enumerates the OS voice list — used
 * both for the 'system' engine and as the fallback when a rare piece of text
 * has no pre-rendered clip. Essentially instant.
 */
export async function prepareTts(onProgress) {
  await ensureVoicesLoaded()
  onProgress && onProgress('system', 100)
  return { ready: true }
}

// ---------- voice ranking & gender tagging ----------

const FEMALE = /aria|jenny|jane|sonia|libby|maisie|michelle|emma|ana\b|clara|natasha|hazel|susan|zira|samantha|allison|ava|karen|moira|tessa|fiona|veena|kate|serena|zoe|nicky|joanna|salli|kendra|kimberly|ivy|olivia|amy|aditi|raveena|catherine|linda|heather|female/i
const MALE = /guy\b|davis|tony|ryan|thomas|william|liam|christopher|eric\b|brian|andrew|roger|steffan|david|mark\b|james|george|alex\b|daniel|oliver|fred|rishi|aaron|evan|nathan|tom\b|lee\b|gordon|matthew|justin|joey|russell|male/i

export function guessGender(v) {
  if (FEMALE.test(v.name)) return 'female'
  if (MALE.test(v.name)) return 'male'
  return 'unknown'
}

// macOS `say -v '?'` lists every voice, including robotic novelty ones — hide
// those so the picker shows only real, natural voices.
const NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|pipe|princess|junior|ralph|fred|kathy|bruce|agnes|grandma|grandpa|rocko|sandy|shelley|flo|eddy|reed|sara)\b/i

/** Keep only usable English voices (drop other languages + novelty voices). */
export function usableVoices(list) {
  return (list || []).filter(v => /^en/i.test(v.lang) && !NOVELTY.test(v.name))
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
 * Studio engine: rotates the female/male studio pair by key.
 */
export function voiceForKey(key) {
  const { varyVoices } = getSettings()
  if (engine() === 'neural') {
    const gender = varyVoices && hashStr(key) % 2 ? 'male' : 'female'
    return { neuralGender: gender, name: STUDIO_VOICES[gender].label }
  }
  if (!varyVoices) return pickVoice()
  const pool = voicePool()
  if (!pool.length) return null
  return pool[hashStr(key) % pool.length]
}

/** Female/male pair for two-speaker conversations (partner first). */
export function conversationVoices() {
  if (engine() === 'neural') {
    return [
      { neuralGender: 'female', name: STUDIO_VOICES.female.label },
      { neuralGender: 'male', name: STUDIO_VOICES.male.label },
    ]
  }
  const f = voiceOfGender('female')
  const m = voiceOfGender('male')
  if (f && m && f.name !== m.name) return [f, m]
  const pool = englishVoices()
  return [pool[0] || f, pool[1] || pool[0] || m]
}

// ---------- speaking ----------
//
// Chromium's SpeechSynthesis (which Electron uses) is buggy: it cuts out on
// utterances longer than ~15 s, and calling cancel() immediately before
// speak() often drops the new utterance. On macOS this shows up as laggy,
// broken, flaky speech. Fixes applied here:
//   1) split text into short sentence chunks and speak them in sequence, so
//      no single utterance hits the ~15 s cutoff;
//   2) a pause()/resume() "keep-alive" tick that resets Chromium's internal
//      timer while speaking;
//   3) a short delay after cancel() before the next speak(), avoiding the race.

let _speakToken = 0        // invalidates an in-flight sequence when a new speak starts
let _keepAlive = null

function stopKeepAlive() { if (_keepAlive) { clearInterval(_keepAlive); _keepAlive = null } }

/** Break text into <=180-char, sentence-aligned chunks. */
function chunkText(text) {
  const sentences = String(text).match(/[^.!?]+[.!?]*\s*/g) || [String(text)]
  const out = []
  let cur = ''
  for (const s of sentences) {
    if (cur && (cur + s).length > 180) { out.push(cur.trim()); cur = s }
    else cur += s
  }
  if (cur.trim()) out.push(cur.trim())
  return out.length ? out : [String(text)]
}

/** Speak text; resolves when finished (or immediately if unsupported). */
export function speak(text, { rate = 1, voice = null, voiceKey = null } = {}) {
  // Studio (neural) engine first — professional, identical on every platform.
  // speakNeural picks the requested gender when downloaded, or any downloaded
  // studio voice; if NONE is downloaded it resolves false and we fall back to
  // the system voice for this utterance (never a silent question).
  if (engine() === 'neural') {
    const gender = voice?.neuralGender
      || (voiceKey != null ? voiceForKey(voiceKey)?.neuralGender : 'female')
      || 'female'
    // 1) bundled pre-rendered Studio clip → INSTANT, no download, offline
    const url = preRenderedUrl(text, gender)
    if (url) {
      stopSpeaking()
      return playUrl(url, rate).then(ok => ok ? true : speakSystem(text, { rate, voice, voiceKey }))
    }
    // 2) live Studio synthesis if the model is downloaded (slow, non-realtime)
    if (isDownloaded('female') || isDownloaded('male')) {
      stopSpeaking()
      return speakNeural(text, { gender, rate }).then(ok =>
        ok ? true : speakSystem(text, { rate, voice, voiceKey }))
    }
  }
  return speakSystem(text, { rate, voice, voiceKey })
}

// native macOS speech via the desktop app (Apple's engine — reliable; the
// Chromium speechSynthesis bridge on macOS drops/garbles utterances)
let _nativeSaying = false
function nativeSay() {
  return (typeof window !== 'undefined' && window.parrot?.platform === 'darwin' && window.parrot?.say) || null
}

// cache of the OS voices `say -v '?'` reports (desktop only)
let _nativeVoices = null
export function nativeVoices() { return _nativeVoices || [] }
function loadNativeVoices() {
  const n = nativeSay()
  if (!n || !n.voices || _nativeVoices) return
  n.voices().then(vs => { _nativeVoices = usableVoices(vs) }).catch(() => { _nativeVoices = [] })
}
if (typeof window !== 'undefined') loadNativeVoices()

/** Pick a native `say` voice name for a gender: pinned first, then by name. */
function nativeVoiceName(gender) {
  const st = getSettings()
  const pin = gender === 'male' ? st.voiceMale : gender === 'female' ? st.voiceFemale : ''
  if (pin) return pin
  const list = nativeVoices()
  const match = list.find(v => guessGender(v) === gender)
  return match ? match.name : undefined
}

function speakSystem(text, opts = {}) {
  const native = nativeSay()
  if (native) {
    const { rate = 1, voice = null, voiceKey = null } = opts
    // an explicitly passed native voice (Settings test button) wins; otherwise
    // resolve the gender and pick a native `say` voice (pinned or by name)
    let name
    if (voice && !voice.neuralGender && voice.name) {
      name = voice.name
    } else {
      const gender = voice?.neuralGender
        || (voiceKey != null ? voiceForKey(voiceKey)?.neuralGender : 'female')
        || 'female'
      name = nativeVoiceName(gender)
    }
    _nativeSaying = true
    return native.say.speak({ text, voice: name, rate })
      .then(r => {
        _nativeSaying = false
        if (r && r.ok) return true
        if (r && r.interrupted) return false
        // engine rejected (e.g. unknown voice name) → retry without a voice,
        // then fall back to the Chromium path so nothing is ever silent
        return native.say.speak({ text, rate }).then(r2 =>
          (r2 && r2.ok) ? true : (r2 && r2.interrupted) ? false : speakChromium(text, opts))
      })
      .catch(() => { _nativeSaying = false; return speakChromium(text, opts) })
  }
  return speakChromium(text, opts)
}

function speakChromium(text, { rate = 1, voice = null, voiceKey = null } = {}) {
  return new Promise((resolve) => {
    if (!ttsSupported()) { resolve(false); return }
    const synth = window.speechSynthesis
    const token = ++_speakToken
    synth.cancel()
    stopKeepAlive()

    // resolve a REAL system voice (a studio marker can land here when the
    // studio voice is still downloading — map it to a same-gender system voice)
    let v = voice
    if (v && v.neuralGender) v = voiceOfGender(v.neuralGender)
    if (!v) {
      const k = voiceKey != null ? voiceForKey(voiceKey) : pickVoice()
      v = k && k.neuralGender ? voiceOfGender(k.neuralGender) : k
    }
    const chunks = chunkText(text)
    let i = 0

    // keep-alive: every ~10s, pause+resume to defeat the Chromium cutoff
    _keepAlive = setInterval(() => {
      if (token !== _speakToken) { stopKeepAlive(); return }
      if (synth.speaking && !synth.paused) { try { synth.pause(); synth.resume() } catch {} }
    }, 10000)

    let settled = false
    const done = (ok) => {
      if (settled) return
      settled = true
      clearInterval(watchdog)
      if (token === _speakToken) stopKeepAlive()
      resolve(ok)
    }
    // if another speak()/stopSpeaking supersedes us, Chromium may swallow the
    // 'end' event after cancel() — resolve via watchdog so callers never hang
    // (a hung promise leaves play/replay buttons stuck disabled)
    const watchdog = setInterval(() => { if (token !== _speakToken) done(false) }, 200)

    const speakNext = () => {
      if (token !== _speakToken) { done(false); return } // superseded
      if (i >= chunks.length) { done(true); return }
      const u = new SpeechSynthesisUtterance(chunks[i++])
      u.rate = rate
      if (v) { u.voice = v; u.lang = v.lang } else u.lang = 'en-US'
      u.onend = () => { if (token === _speakToken) speakNext(); else done(false) }
      u.onerror = () => done(false)
      synth.speak(u)
    }

    // small gap after cancel() so Chromium doesn't drop the first utterance
    setTimeout(speakNext, 70)
  })
}

export function stopSpeaking() {
  _speakToken++ // invalidate any in-flight sequence
  stopKeepAlive()
  stopNeural()
  if (_preAudio) { try { _preAudio.pause() } catch {} _preAudio = null }
  const native = nativeSay()
  if (native) { _nativeSaying = false; native.say.stop().catch?.(() => {}) }
  if (ttsSupported()) window.speechSynthesis.cancel()
}

export function isSpeaking() {
  return isNeuralSpeaking() || !!_preAudio || _nativeSaying || (ttsSupported() && window.speechSynthesis.speaking)
}
