// Microphone capture (MediaRecorder) + optional live transcription
// (Web Speech API SpeechRecognition, where the browser supports it).
// Audio blobs are kept in memory as object URLs so responses can be replayed
// on the review screen; nothing ever leaves the machine unless AI marking is
// explicitly requested.

export function micSupported() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
}

export function recognitionSupported() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export function createRecorder() {
  let mediaRecorder = null
  let chunks = []
  let stream = null
  let recognition = null
  let finalTranscript = ''
  let wantRunning = false // keep restarting recognition until stop() is called

  return {
    /**
     * Start mic capture.
     * @param onTranscript(text)  streams live recognition results (browser only)
     * @param onStatus(status)    'listening' | 'working' | 'unavailable:<reason>'
     *   so the UI can tell the user when auto speech-to-text isn't available
     *   (e.g. the desktop app or offline) and to type instead.
     */
    async start(onTranscript, onStatus) {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunks = []
      finalTranscript = ''
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      mediaRecorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
      mediaRecorder.start(500)

      if (!recognitionSupported()) { onStatus && onStatus('unavailable:unsupported'); return }
      if (onTranscript) {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition
        recognition = new SR()
        recognition.lang = 'en-US'
        recognition.continuous = true
        recognition.interimResults = true
        wantRunning = true
        recognition.onstart = () => onStatus && onStatus('listening')
        recognition.onresult = (e) => {
          onStatus && onStatus('working')
          let interim = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i]
            if (r.isFinal) finalTranscript += r[0].transcript + ' '
            else interim += r[0].transcript
          }
          onTranscript((finalTranscript + interim).trim())
        }
        // 'network'/'service-not-allowed' = the online speech service is
        // unreachable — this is what happens in the desktop app (no Google
        // key) and when offline. Report it so the UI guides the user to type.
        recognition.onerror = (e) => {
          const reason = e && e.error
          if (reason === 'no-speech' || reason === 'aborted') return // benign
          wantRunning = false
          onStatus && onStatus('unavailable:' + (reason || 'error'))
        }
        // Chrome stops after a pause even with continuous=true — restart so
        // long answers keep transcribing.
        recognition.onend = () => { if (wantRunning) { try { recognition.start() } catch {} } }
        try { recognition.start() } catch { onStatus && onStatus('unavailable:start-failed') }
      }
    },

    /** Stop and return { url, blob, transcript } */
    stop() {
      return new Promise((resolve) => {
        wantRunning = false
        if (recognition) { try { recognition.stop() } catch {} recognition = null }
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
          cleanup()
          resolve({ url: null, blob: null, transcript: finalTranscript.trim() })
          return
        }
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' })
          const url = URL.createObjectURL(blob)
          cleanup()
          resolve({ url, blob, transcript: finalTranscript.trim() })
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
