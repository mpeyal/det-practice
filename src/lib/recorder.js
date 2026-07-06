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

  return {
    /** Start mic capture; onTranscript(text) streams live recognition results if available. */
    async start(onTranscript) {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunks = []
      finalTranscript = ''
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      mediaRecorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
      mediaRecorder.start(500)

      if (recognitionSupported() && onTranscript) {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition
        recognition = new SR()
        recognition.lang = 'en-US'
        recognition.continuous = true
        recognition.interimResults = true
        recognition.onresult = (e) => {
          let interim = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i]
            if (r.isFinal) finalTranscript += r[0].transcript + ' '
            else interim += r[0].transcript
          }
          onTranscript((finalTranscript + interim).trim())
        }
        // NOTE: Chrome's SpeechRecognition uses an online service; if offline
        // it just errors out silently and the user edits the transcript by hand.
        recognition.onerror = () => {}
        try { recognition.start() } catch { /* already started */ }
      }
    },

    /** Stop and return { url, blob, transcript } */
    stop() {
      return new Promise((resolve) => {
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
