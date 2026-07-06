import React, { useEffect, useRef, useState } from 'react'
import { createRecorder, micSupported, recognitionSupported } from '../lib/recorder.js'

/**
 * Microphone recording UI used by all speaking tasks.
 * - Records audio locally (replayable), streams a live transcript when the
 *   browser supports SpeechRecognition, and always lets the user edit the
 *   transcript afterwards (needed for AI marking / offline review).
 * - `autoStart`: begin recording on mount (exam mode).
 * - `stopSignal`: increment to force-stop (parent timer expired).
 * - `onChange({ url, transcript, recording })` fires on every state change;
 *   the parent keeps the latest value and submits it.
 */
export default function RecorderPanel({ autoStart = false, stopSignal = 0, onChange, compact = false }) {
  const recRef = useRef(null)
  const [recording, setRecording] = useState(false)
  const [url, setUrl] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const emit = (patch = {}) => {
    const next = { url, transcript, recording, ...patch }
    onChangeRef.current && onChangeRef.current(next)
  }

  const start = async () => {
    if (!micSupported()) { setError('This browser has no microphone support. Type your response below instead.'); return }
    // getUserMedia only works in a secure context (the desktop app or an
    // http://localhost / https page) — not when the built file is opened
    // directly (file://) or inside a sandboxed preview frame.
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setError('The microphone needs a secure page. Use the DET Practice desktop app, or open the app at http://localhost — it can’t record from a file:// page. You can type your response below instead.')
      return
    }
    try {
      recRef.current = createRecorder()
      await recRef.current.start(t => { setTranscript(t); onChangeRef.current?.({ url: null, transcript: t, recording: true }) })
      setError('')
      setRecording(true)
      emit({ recording: true })
    } catch (e) {
      const name = e && e.name
      let msg = 'Could not access the microphone. Type your response below instead.'
      if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
        msg = 'Microphone blocked. Click the camera/lock icon in the address bar → Allow microphone, then press Record again. (This preview panel can’t grant the mic — open the app in a normal browser tab or the desktop app.) You can also just type your response below.'
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        msg = 'No microphone was found on this device. Type your response below instead.'
      } else if (name === 'NotReadableError') {
        msg = 'The microphone is in use by another app. Close it and press Record again, or type your response below.'
      }
      setError(msg)
    }
  }

  const stop = async () => {
    if (!recRef.current) return
    const res = await recRef.current.stop()
    recRef.current = null
    setRecording(false)
    if (res.url) setUrl(res.url)
    setTranscript(prev => res.transcript && res.transcript.length > prev.length ? res.transcript : prev)
    onChangeRef.current?.({
      url: res.url || url,
      transcript: res.transcript && res.transcript.length > transcript.length ? res.transcript : transcript,
      recording: false,
    })
  }

  useEffect(() => { if (autoStart) start() ; return () => { recRef.current?.stop() } }, []) // eslint-disable-line
  useEffect(() => { if (stopSignal > 0 && recording) stop() }, [stopSignal]) // eslint-disable-line

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {recording ? (
          <button onClick={stop} className="btn btn-red">
            <span className="rec-dot inline-block h-3 w-3 rounded-full bg-white" /> Stop recording
          </button>
        ) : (
          <button onClick={start} className="btn btn-blue">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v5a4 4 0 0 0 4 4zm6-4a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.94V22h2v-3.06A8 8 0 0 0 20 11h-2z"/></svg>
            {url ? 'Re-record' : 'Record'}
          </button>
        )}
        {url && !recording && <audio controls src={url} className="h-10 max-w-[220px]" />}
      </div>
      {error && <div className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">{error}</div>}
      {!compact && (
        <div>
          <div className="mb-1 text-xs font-extrabold uppercase tracking-wide text-neutral-400">
            Transcript {recognitionSupported() ? '(live — edit if needed)' : '(no speech recognition in this browser — type what you said)'}
          </div>
          <textarea
            className="min-h-24 w-full rounded-xl border-2 border-neutral-200 p-3 font-medium focus:border-[#1cb0f6] focus:outline-none"
            value={transcript}
            placeholder="Your spoken words appear here…"
            onChange={e => { setTranscript(e.target.value); emit({ transcript: e.target.value }) }}
          />
        </div>
      )}
    </div>
  )
}
