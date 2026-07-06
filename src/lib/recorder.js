// Microphone capture (MediaRecorder) + LIVE offline transcription (Vosk WASM,
// see liveStt.js). Audio blobs are kept in memory as object URLs so responses
// can be replayed on the review screen; nothing leaves the machine unless AI
// marking is explicitly requested.

import { startLive, warmup } from './liveStt.js'

export function micSupported() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
}

/** Preload the live speech model (call when a speaking task opens). */
export function warmupStt() { warmup() }

export function createRecorder() {
  let mediaRecorder = null
  let chunks = []
  let stream = null
  let live = null
  let liveText = ''

  return {
    /**
     * Start mic capture + live transcription.
     * @param onTranscript(text)  streams the live transcript as you speak
     * @param onStatus(status)    'loading' | 'listening' | 'unavailable:<reason>'
     */
    async start(onTranscript, onStatus) {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunks = []
      liveText = ''
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      mediaRecorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
      mediaRecorder.start(500)

      // live transcription (offline Vosk engine — works in web AND desktop)
      live = await startLive(
        stream,
        (text) => { liveText = text; onTranscript && onTranscript(text) },
        (status) => {
          if (!onStatus) return
          if (status.startsWith('error:')) onStatus('unavailable:' + status.slice(6))
          else onStatus(status)
        }
      )
    },

    /** Stop and return { url, blob, transcript } */
    async stop() {
      if (live) { try { liveText = (await live.stop()) || liveText } catch {} live = null }
      return new Promise((resolve) => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
          cleanup()
          resolve({ url: null, blob: null, transcript: liveText.trim() })
          return
        }
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' })
          const url = URL.createObjectURL(blob)
          cleanup()
          resolve({ url, blob, transcript: liveText.trim() })
        }
        mediaRecorder.stop()
      })
      function cleanup() {
        if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
        mediaRecorder = null
      }
    },

    isRecording() {
      return !!mediaRecorder && mediaRecorder.state === 'recording'
    },
  }
}
