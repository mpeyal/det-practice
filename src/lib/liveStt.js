// LIVE offline speech-to-text with Vosk (Kaldi engine compiled to WASM).
//
// Why Vosk: it's a production-grade streaming recognizer — it transcribes
// WHILE you speak (partial results), runs 100% locally (no key, no cloud),
// and behaves identically in the web version and the Electron desktop app.
// The English model ships inside the app (public/models/), so after install
// there is nothing to download and it works fully offline.
//
// The Web Speech API is NOT used anymore for live transcription: it's
// online-only, Chrome-only, and dead inside Electron — i.e. not stable.
// Whisper (transcribe.js) remains as the optional higher-accuracy pass on the
// finished recording.

let _model = null
let _modelLoading = null

const MODEL_URL = './models/vosk-en-small.tar.gz'

async function loadModel(onProgress) {
  if (_model) return _model
  if (_modelLoading) return _modelLoading
  _modelLoading = (async () => {
    const { createModel } = await import('vosk-browser')
    // vosk-browser fetches + unpacks the tar.gz inside a worker; it caches in
    // IndexedDB so subsequent loads are instant.
    const model = await createModel(MODEL_URL, (p) => {
      if (onProgress && typeof p === 'number') onProgress(p)
    })
    _model = model
    return model
  })()
  try { return await _modelLoading } finally { if (!_model) _modelLoading = null }
}

/** Preload the model in the background (e.g. when a speaking task opens). */
export function warmup() { loadModel().catch(() => {}) }

/**
 * Start live transcription on a MediaStream.
 * onText(fullText, isFinalChunk) fires continuously while speaking.
 * onStatus: 'loading' | 'listening' | 'error:<msg>'
 * Returns { stop() } — stop flushes the final result and frees the audio graph.
 */
export async function startLive(stream, onText, onStatus) {
  let ctx = null, src = null, proc = null, recognizer = null
  let finalText = ''
  let stopped = false

  try {
    onStatus && onStatus('loading')
    const model = await loadModel()

    const AC = window.AudioContext || window.webkitAudioContext
    ctx = new AC()
    recognizer = new model.KaldiRecognizer(ctx.sampleRate)
    recognizer.setWords(false)

    recognizer.on('result', (m) => {
      const t = m?.result?.text || ''
      if (t) { finalText = (finalText + ' ' + t).trim(); onText && onText(finalText, true) }
    })
    recognizer.on('partialresult', (m) => {
      const p = m?.result?.partial || ''
      if (p) onText && onText((finalText + ' ' + p).trim(), false)
    })

    src = ctx.createMediaStreamSource(stream)
    // ScriptProcessor is deprecated but universally supported (incl. Electron)
    proc = ctx.createScriptProcessor(4096, 1, 1)
    proc.onaudioprocess = (e) => {
      if (stopped) return
      try { recognizer.acceptWaveform(e.inputBuffer) } catch { /* keep going */ }
    }
    src.connect(proc)
    proc.connect(ctx.destination) // required for the processor to run
    onStatus && onStatus('listening')
  } catch (e) {
    onStatus && onStatus('error:' + (e?.message || e))
    try { ctx && ctx.close() } catch {}
    return { stop: async () => finalText }
  }

  return {
    /** stop feeding audio; returns the final accumulated text */
    async stop() {
      stopped = true
      try { proc && proc.disconnect() } catch {}
      try { src && src.disconnect() } catch {}
      try { recognizer && recognizer.retrieveFinalResult && recognizer.retrieveFinalResult() } catch {}
      // give the worker a beat to emit the last 'result'
      await new Promise(r => setTimeout(r, 250))
      try { recognizer && recognizer.remove() } catch {}
      try { ctx && ctx.close() } catch {}
      return finalText
    },
  }
}
