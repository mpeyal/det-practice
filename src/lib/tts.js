import { getSettings } from './storage.js'
import NATURAL_PACK from '../data/naturalVoicePack.json'

// Kokoro American voices, rendered once at build time and bundled offline.
// Do not route through legacy packs: some legacy male clips use British Daniel.
const _pack = new Set(NATURAL_PACK.keys)
const STUDIO_VOICES = {
  female: { label: 'Heart · American English' },
  male: { label: 'Michael · American English' },
}

/** Deterministic key for a clip — MUST match scripts/render-natural-voices.mjs exactly. */
function packKey(text, gender) {
  let h = 7
  const s = gender + String(text)
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h.toString(16)
}
function preRenderedUrl(text, gender) {
  const k = packKey(text, gender)
  return _pack.has(k) ? `${import.meta.env.BASE_URL}voices-natural/${k}.m4a` : null
}

let _preAudio = null
let _cancelPreAudio = null
function playUrl(url, rate) {
  return new Promise((resolve) => {
    let a
    try { a = new Audio(url) } catch { resolve(false); return }
    let done = false
    let lastTime = 0, lastProgress = Date.now()
    const watchdog = setInterval(() => {
      if (a.currentTime > lastTime) { lastTime = a.currentTime; lastProgress = Date.now() }
      else if (Date.now() - lastProgress >= 15000) fin(false)
    }, 1000)
    const fin = (ok) => {
      if (done) return
      done = true
      clearInterval(watchdog)
      a.onended = a.onerror = null
      if (!ok) { try { a.pause() } catch {} }
      if (_preAudio === a) { _preAudio = null; _cancelPreAudio = null }
      resolve(ok)
    }
    _preAudio = a
    _cancelPreAudio = () => fin(false)
    a.onended = () => fin(true)
    a.onerror = () => fin(false)
    try {
      a.playbackRate = rate
      if ('preservesPitch' in a) a.preservesPitch = true
      Promise.resolve(a.play()).catch(() => fin(false))
    } catch { fin(false) }
  })
}

// Preserve the saved engine preference; 'neural' now plays the natural US pack.
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
  return typeof window !== 'undefined' && (typeof Audio !== 'undefined' || !!window.speechSynthesis)
}

/** Wait until the OS voice list is populated (it loads async on first use). */
function ensureVoicesLoaded(timeout = 2500) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(false); return }
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
 * bundled (nothing to load). Only explicit system mode waits for OS voices;
 * background voice enumeration remains available for error fallback.
 */
export async function prepareTts(onProgress) {
  if (engine() === 'system') {
    if (nativeSay()) await loadNativeVoices()
    else await ensureVoicesLoaded()
  }
  onProgress && onProgress(engine(), 100)
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

/** Keep only usable American English voices (drop other languages + novelty voices). */
export function usableVoices(list) {
  return (list || []).filter(v => /^en[-_]US$/i.test(v.lang) && !NOVELTY.test(v.name))
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

/** American English voices, best-sounding first. */
export function englishVoices() {
  if (!cachedVoices.length) loadVoices()
  return usableVoices(cachedVoices)
    .sort((a, b) => scoreVoice(b) - scoreVoice(a))
}

/** Best voice of a gender, honoring the user's pinned choice in Settings. */
function systemVoices() {
  return nativeSay() && nativeVoices().length ? nativeVoices() : englishVoices()
}

export function voiceOfGender(gender, pool = systemVoices()) {
  const { voiceFemale, voiceMale } = getSettings()
  if (!pool.length) return null
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
  const pool = systemVoices()
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
  const pool = systemVoices()
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
  for (const sentence of sentences) {
    for (const word of sentence.trim().split(/\s+/)) {
      if (cur && cur.length + word.length + 1 > 180) { out.push(cur); cur = '' }
      // A pathological long token should not bypass the browser utterance limit.
      let rest = word
      while (rest.length > 180) {
        if (cur) { out.push(cur); cur = '' }
        out.push(rest.slice(0, 180)); rest = rest.slice(180)
      }
      if (rest) cur = cur ? `${cur} ${rest}` : rest
    }
    if (cur) { out.push(cur); cur = '' }
  }
  if (cur.trim()) out.push(cur.trim())
  return out.length ? out : [String(text)]
}

/** Speak text; cancelled playback resolves false and never starts a fallback. */
export function speak(text, { rate = 1, voice = null, voiceKey = null } = {}) {
  stopSpeaking()
  text = String(text ?? '').trim()
  if (!text) return Promise.resolve(false)
  rate = Number(rate)
  if (!Number.isFinite(rate) || rate < 0.5 || rate > 2) rate = 1
  const token = _speakToken
  const opts = { rate, voice, voiceKey }
  if (engine() === 'neural') {
    const gender = voice?.neuralGender
      || (voiceKey != null ? voiceForKey(voiceKey)?.neuralGender : 'female') || 'female'
    const url = preRenderedUrl(String(text).trim(), gender)
    if (url) return playUrl(url, rate).then(ok => {
      if (token !== _speakToken) return false
      return ok || speakSystem(text, opts, token)
    })
  }
  return speakSystem(text, opts, token)
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
let _nativeLoading = null
function loadNativeVoices() {
  const n = nativeSay()
  if (!n?.voices) return Promise.resolve()
  if (_nativeVoices) return Promise.resolve()
  if (!_nativeLoading) _nativeLoading = n.voices().then(vs => {
    _nativeVoices = usableVoices(vs).sort((a, b) => scoreVoice(b) - scoreVoice(a))
  }).catch(() => { _nativeLoading = null })
  return _nativeLoading
}
if (typeof window !== 'undefined') loadNativeVoices()

/** A stored British voice must not bypass the American locale filter. */
function nativeVoiceName(gender) {
  const st = getSettings()
  const pin = gender === 'male' ? st.voiceMale : st.voiceFemale
  const list = nativeVoices()
  return (list.find(v => v.name === pin)
    || list.find(v => guessGender(v) === gender) || list[0])?.name
}

async function speakSystem(text, opts = {}, token = _speakToken) {
  const native = nativeSay()
  if (native) {
    await loadNativeVoices()
    if (token !== _speakToken) return false
    const { rate = 1, voice = null, voiceKey = null } = opts
    const requested = voice || (voiceKey != null ? voiceForKey(voiceKey) : null)
    const gender = requested?.neuralGender || (requested ? guessGender(requested) : 'female')
    const name = nativeVoices().find(v => v.name === requested?.name)?.name || nativeVoiceName(gender)
    if (name) {
      _nativeSaying = true
      try {
        const r = await native.speak({ text, voice: name, rate })
        if (token !== _speakToken) return false
        if (r?.ok) return true
        if (r?.interrupted) return false
      } catch { if (token !== _speakToken) return false }
      finally { if (token === _speakToken) _nativeSaying = false }
    }
  }
  if (token !== _speakToken) return false
  await ensureVoicesLoaded()
  if (token !== _speakToken) return false
  return speakChromium(text, opts)
}

function speakChromium(text, { rate = 1, voice = null, voiceKey = null } = {}) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(false); return }
    const synth = window.speechSynthesis
    const token = ++_speakToken
    try { synth.cancel() } catch { resolve(false); return }
    stopKeepAlive()

    // Native IPC voices are plain descriptors. Chromium requires an actual
    // SpeechSynthesisVoice from its own list, even when the names match.
    const pool = englishVoices()
    const requested = voice || (voiceKey != null ? voiceForKey(voiceKey) : pickVoice())
    const gender = requested?.neuralGender || (requested ? guessGender(requested) : 'female')
    const v = pool.find(v => v.name === requested?.name) || voiceOfGender(gender, pool)
    // Never allow the OS default to silently choose a different accent.
    if (!v) { resolve(false); return }
    const chunks = chunkText(text)
    let i = 0
    let chunkDeadline = Date.now() + 30000 / rate

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
      if (token === _speakToken) {
        stopKeepAlive()
        if (!ok) { try { synth.cancel() } catch {} }
      }
      resolve(ok)
    }
    // if another speak()/stopSpeaking supersedes us, Chromium may swallow the
    // 'end' event after cancel() — resolve via watchdog so callers never hang
    // (a hung promise leaves play/replay buttons stuck disabled)
    const watchdog = setInterval(() => {
      if (token !== _speakToken || Date.now() > chunkDeadline) done(false)
    }, 200)

    const speakNext = () => {
      if (settled) return
      if (token !== _speakToken) { done(false); return } // superseded
      if (i >= chunks.length) { done(true); return }
      try {
        chunkDeadline = Date.now() + 30000 / rate
        const u = new SpeechSynthesisUtterance(chunks[i++])
        u.rate = rate
        u.voice = v; u.lang = v.lang
        u.onend = () => { if (token === _speakToken) speakNext(); else done(false) }
        u.onerror = () => done(false)
        synth.speak(u)
      } catch { done(false) }
    }

    // small gap after cancel() so Chromium doesn't drop the first utterance
    setTimeout(speakNext, 70)
  })
}

export function stopSpeaking() {
  // MUST NOT throw — this runs at the start of every Submit/Next handler, so an
  // exception here would block navigation (that bug once stuck the whole exam
  // on the desktop app).
  _speakToken++ // invalidate any in-flight sequence
  try { stopKeepAlive() } catch {}
  try { _cancelPreAudio?.() } catch {}
  _cancelPreAudio = null
  if (_preAudio) { try { _preAudio.pause() } catch {} _preAudio = null }
  try { const native = nativeSay(); if (native) { _nativeSaying = false; native.stop()?.catch?.(() => {}) } } catch {}
  try { if (ttsSupported()) window.speechSynthesis.cancel() } catch {}
}

export function isSpeaking() {
  return !!_preAudio || _nativeSaying || (typeof window !== 'undefined' && !!window.speechSynthesis?.speaking)
}
