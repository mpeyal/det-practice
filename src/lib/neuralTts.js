// Studio voices: neural text-to-speech with Piper (the open-source engine
// used in production by Home Assistant), running locally via ONNX/WASM.
//
// Why: system voices vary wildly — robotic SAPI voices in the Windows desktop
// app, whatever happens to be installed on a Mac. Piper gives the SAME
// professional, Duolingo-grade voice on Mac, Windows and web. Two matched
// studio voices ship as downloads (~60 MB each, female + male), fetched once
// with progress and cached in the browser's origin-private file system (OPFS)
// — after that they work fully offline.
//
// speak flow: text → sentence chunks → session.predict(chunk) → WAV blob →
// <audio> playback. The next chunk is synthesized WHILE the current one plays,
// so long passages stream smoothly with no mid-sentence cutouts (this also
// completely sidesteps Chromium's flaky SpeechSynthesis).

export const STUDIO_VOICES = {
  female: { id: 'en_US-hfc_female-medium', label: 'Studio Female (US)' },
  male: { id: 'en_US-hfc_male-medium', label: 'Studio Male (US)' },
}

const sessions = { female: null, male: null }
const sessionLoading = { female: null, male: null }
const progressCbs = new Set()

// Loaded at RUNTIME from a pinned CDN build rather than bundled: the engine
// drags in onnxruntime-web (~70 MB of WASM), which must never bloat the app
// bundle. The library fetches its own WASM from CDNs regardless, and the
// browser caches everything after first use.
const LIB_URL = 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.4/+esm'

let _lib = null
async function lib() {
  if (!_lib) _lib = await import(/* @vite-ignore */ LIB_URL)
  return _lib
}

/** Subscribe to voice-download progress: cb(gender, pct 0..100). */
export function onNeuralProgress(cb) { progressCbs.add(cb); return () => progressCbs.delete(cb) }
function emitProgress(gender, pct) { for (const cb of progressCbs) { try { cb(gender, pct) } catch {} } }

export function neuralReady(gender = 'female') { return !!sessions[gender] }
export function anyNeuralReady() { return !!(sessions.female || sessions.male) }

/** Which studio voices are already cached on this machine (OPFS)? */
export async function storedNeuralVoices() {
  try {
    const t = await lib()
    const ids = await t.stored()
    return {
      female: ids.includes(STUDIO_VOICES.female.id),
      male: ids.includes(STUDIO_VOICES.male.id),
    }
  } catch { return { female: false, male: false } }
}

/** Load (downloading + caching if needed) a studio voice session. */
export async function loadNeural(gender = 'female') {
  if (sessions[gender]) return sessions[gender]
  if (sessionLoading[gender]) return sessionLoading[gender]
  sessionLoading[gender] = (async () => {
    const t = await lib()
    const session = await t.TtsSession.create({
      voiceId: STUDIO_VOICES[gender].id,
      progress: (p) => {
        if (p && p.total) emitProgress(gender, Math.round((p.loaded / p.total) * 100))
      },
    })
    // TtsSession is a singleton internally in some versions — keep our own ref
    sessions[gender] = session
    emitProgress(gender, 100)
    return session
  })()
  try { return await sessionLoading[gender] } finally { if (!sessions[gender]) sessionLoading[gender] = null }
}

/** Preload both studio voices in the background (call from Settings / app start). */
export function warmupNeural() {
  loadNeural('female').catch(() => {})
  // stagger the second voice so the first is usable sooner
  setTimeout(() => loadNeural('male').catch(() => {}), 4000)
}

// ---- playback ----

let _token = 0
let _audio = null

function chunkText(text) {
  const sentences = String(text).match(/[^.!?]+[.!?]*\s*/g) || [String(text)]
  const out = []
  let cur = ''
  for (const s of sentences) {
    if (cur && (cur + s).length > 220) { out.push(cur.trim()); cur = s }
    else cur += s
  }
  if (cur.trim()) out.push(cur.trim())
  return out.length ? out : [String(text)]
}

function playBlob(blob, rate, token) {
  return new Promise((resolve) => {
    if (token !== _token) { resolve(false); return }
    const url = URL.createObjectURL(blob)
    const a = new Audio(url)
    _audio = a
    a.playbackRate = rate
    if ('preservesPitch' in a) a.preservesPitch = true
    let settled = false
    const done = (ok) => {
      if (settled) return
      settled = true
      clearInterval(watchdog)
      URL.revokeObjectURL(url)
      if (_audio === a) _audio = null
      resolve(ok)
    }
    // CRITICAL: when another speak()/stop supersedes this one, the audio is
    // paused — which never fires 'ended'. Without this watchdog the promise
    // hangs forever and the caller's playing/speaking state sticks, killing
    // replay buttons and conversation flow.
    const watchdog = setInterval(() => { if (token !== _token) { try { a.pause() } catch {} done(false) } }, 200)
    a.onended = () => done(true)
    a.onerror = () => done(false)
    a.play().catch(() => done(false))
  })
}

/**
 * Speak text with a studio voice. Sentence-chunked and pipelined: chunk N+1
 * synthesizes while chunk N plays. Resolves when playback finishes.
 * NOTE: the session must be loaded — callers check neuralReady() and fall
 * back to the system engine otherwise (tts.js handles this).
 */
export async function speakNeural(text, { gender = 'female', rate = 1 } = {}) {
  const session = sessions[gender] || sessions[gender === 'female' ? 'male' : 'female']
  if (!session) return false
  const token = ++_token
  const chunks = chunkText(text)

  let nextWav = session.predict(chunks[0])
  for (let i = 0; i < chunks.length; i++) {
    if (token !== _token) return false
    let wav
    try { wav = await nextWav } catch { return false }
    if (token !== _token) return false
    // start synthesizing the next chunk while this one plays
    if (i + 1 < chunks.length) nextWav = session.predict(chunks[i + 1])
    const ok = await playBlob(wav, rate, token)
    if (!ok && token !== _token) return false
  }
  return token === _token
}

export function stopNeural() {
  _token++
  if (_audio) { try { _audio.pause() } catch {} _audio = null }
}

export function isNeuralSpeaking() { return !!_audio }
