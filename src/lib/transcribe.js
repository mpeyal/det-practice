// Offline speech-to-text with Whisper, running locally in the browser/app via
// WebAssembly (transformers.js). This is the fallback for when the Web Speech
// API isn't available (the desktop app, or offline) — no API key, no cloud.
//
// The model (~40 MB, English) downloads from a CDN the FIRST time and is then
// cached by the browser, so subsequent transcriptions work fully offline.
// transformers.js itself is loaded from a CDN on demand so it never bloats the
// app bundle.

const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/+esm'
const MODEL = 'Xenova/whisper-tiny.en' // small + fast; English

let _pipe = null
let _loading = null

async function loadPipe(onProgress) {
  if (_pipe) return _pipe
  if (_loading) return _loading
  _loading = (async () => {
    const url = CDN
    const t = await import(/* @vite-ignore */ url)
    t.env.allowLocalModels = false          // fetch the model from the HF CDN
    if (t.env.backends?.onnx?.wasm) t.env.backends.onnx.wasm.proxy = false
    const pipe = await t.pipeline('automatic-speech-recognition', MODEL, {
      progress_callback: onProgress,
    })
    _pipe = pipe
    return pipe
  })()
  try { return await _loading } finally { _loading = _pipe ? null : _loading }
}

/** Decode a recorded audio Blob into 16 kHz mono Float32 PCM for Whisper. */
async function blobToPCM(blob) {
  const buf = await blob.arrayBuffer()
  const AC = window.AudioContext || window.webkitAudioContext
  const ctx = new AC()
  let audioBuf
  try { audioBuf = await ctx.decodeAudioData(buf.slice(0)) }
  finally { try { ctx.close() } catch {} }
  const target = 16000
  const frames = Math.max(1, Math.ceil(audioBuf.duration * target))
  const off = new OfflineAudioContext(1, frames, target)
  const src = off.createBufferSource()
  src.buffer = audioBuf
  src.connect(off.destination)
  src.start()
  const rendered = await off.startRendering()
  return rendered.getChannelData(0)
}

export function transcribeSupported() {
  return typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext)
}

/** Whether the model is already downloaded/loaded (so it works offline). */
export function modelReady() { return !!_pipe }

/**
 * Transcribe a recorded audio Blob to text.
 * @param onStage(stage, pct)  'loading' while the model downloads (pct 0-100),
 *                             'running' while transcribing.
 */
export async function transcribeBlob(blob, onStage) {
  const pipe = await loadPipe((p) => {
    if (onStage && p && p.status === 'progress') onStage('loading', Math.round(p.progress || 0))
  })
  onStage && onStage('running', 0)
  const pcm = await blobToPCM(blob)
  const out = await pipe(pcm, { chunk_length_s: 30, stride_length_s: 5 })
  const text = Array.isArray(out) ? out.map(o => o.text).join(' ') : (out?.text || '')
  return text.trim()
}
