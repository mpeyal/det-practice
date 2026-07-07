// Studio voices: neural text-to-speech with Piper (the open-source engine
// used in production by Home Assistant), running locally via ONNX/WASM.
//
// IMPORTANT CONSTRAINT: the piper-tts-web library keeps ONE global session —
// asking it for a second voice silently reuses the already-loaded model (you
// hear the wrong voice). So this wrapper tracks which voice is TRULY loaded
// (activeGender), resets the library singleton to switch voices (fast once
// the model is in OPFS), and tracks downloads separately from readiness.
//
// speak flow: text → sentence chunks → predict → WAV → <audio>, with the next
// chunk synthesized while the current one plays.

export const STUDIO_VOICES = {
  female: { id: 'en_US-hfc_female-medium', label: 'Studio Female (US)' },
  male: { id: 'en_US-hfc_male-medium', label: 'Studio Male (US)' },
}

const LIB_URL = 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.4/+esm'

let _lib = null
async function lib() {
  if (!_lib) _lib = await import(/* @vite-ignore */ LIB_URL)
  return _lib
}

// ---- state ----
let session = null            // the ONE live library session
let activeGender = null       // which voice that session truly has loaded
let switching = Promise.resolve() // serializes load/switch operations
const downloaded = { female: false, male: false }
let downloadedChecked = false

const progressCbs = new Set()
export function onNeuralProgress(cb) { progressCbs.add(cb); return () => progressCbs.delete(cb) }
function emitProgress(gender, pct) { for (const cb of progressCbs) { try { cb(gender, pct) } catch {} } }

/** Which studio voices are downloaded (OPFS)? Cached after first check. */
export async function storedNeuralVoices(force = false) {
  if (!downloadedChecked || force) {
    try {
      const t = await lib()
      const ids = await t.stored()
      downloaded.female = ids.includes(STUDIO_VOICES.female.id)
      downloaded.male = ids.includes(STUDIO_VOICES.male.id)
      downloadedChecked = true
    } catch { /* leave as-is */ }
  }
  return { ...downloaded }
}

/** TRUTHFUL readiness: is this exact voice the one loaded right now? */
export function neuralReady(gender = 'female') { return activeGender === gender && !!session }
export function anyNeuralReady() { return !!session }
export function activeNeuralGender() { return activeGender }
export function isDownloaded(gender) { return !!downloaded[gender] }

/** Download a voice to OPFS (no session switch). Progress via onNeuralProgress. */
export async function downloadNeural(gender) {
  const t = await lib()
  await t.download(STUDIO_VOICES[gender].id, (p) => {
    if (p && p.total) emitProgress(gender, Math.round((p.loaded / p.total) * 100))
  })
  downloaded[gender] = true
  emitProgress(gender, 100)
}

/**
 * Make `gender` the ACTIVE voice (downloading if necessary). Resets the
 * library singleton when switching — required, or it reuses the old model.
 */
export function loadNeural(gender = 'female') {
  const run = async () => {
    if (activeGender === gender && session) return session
    const t = await lib()
    await storedNeuralVoices()
    if (!downloaded[gender]) await downloadNeural(gender)
    // reset the lib's global session so the new voice REALLY loads
    try { t.TtsSession._instance = null } catch {}
    session = await t.TtsSession.create({
      voiceId: STUDIO_VOICES[gender].id,
      progress: (p) => { if (p && p.total) emitProgress(gender, Math.round((p.loaded / p.total) * 100)) },
    })
    activeGender = gender
    emitProgress(gender, 100)
    return session
  }
  switching = switching.then(run, run)
  return switching
}

/** Preload: activate the female voice; make sure the male is downloaded too. */
export function warmupNeural() {
  storedNeuralVoices().then(async (d) => {
    try {
      if (d.female) await loadNeural('female')
      // don't silently pull 60MB for the male voice — Settings offers it
    } catch {}
  })
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
    // when superseded, the audio is paused — which never fires 'ended';
    // resolve via watchdog so callers never hang (stuck replay buttons)
    const watchdog = setInterval(() => { if (token !== _token) { try { a.pause() } catch {} done(false) } }, 200)
    a.onended = () => done(true)
    a.onerror = () => done(false)
    a.play().catch(() => done(false))
  })
}

/**
 * Speak with a studio voice.
 * - strict: use EXACTLY this gender (switching if needed); fails if not
 *   downloaded (Settings Test uses this — never plays the wrong voice).
 * - non-strict (exam speech): prefer the requested gender when downloaded,
 *   otherwise use whichever studio voice is available; returns false if none.
 */
export async function speakNeural(text, { gender = 'female', rate = 1, strict = false } = {}) {
  await storedNeuralVoices()
  let target = gender
  if (!downloaded[target]) {
    if (strict) return false
    const other = target === 'female' ? 'male' : 'female'
    if (!downloaded[other]) return false
    target = other
  }
  if (activeGender !== target || !session) {
    try { await loadNeural(target) } catch { return false }
  }
  const s = session
  const token = ++_token
  const chunks = chunkText(text)

  let nextWav = s.predict(chunks[0])
  for (let i = 0; i < chunks.length; i++) {
    if (token !== _token) return false
    let wav
    try { wav = await nextWav } catch { return false }
    if (token !== _token) return false
    if (i + 1 < chunks.length) nextWav = s.predict(chunks[i + 1])
    await playBlob(wav, rate, token)
  }
  return token === _token
}

export function stopNeural() {
  _token++
  if (_audio) { try { _audio.pause() } catch {} _audio = null }
}

export function isNeuralSpeaking() { return !!_audio }
