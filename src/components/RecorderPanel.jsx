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
  const blobRef = useRef(null)
  const [recording, setRecording] = useState(false)
  const [url, setUrl] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const [stt, setStt] = useState('idle') // idle | listening | working | unavailable
  const [tx, setTx] = useState(null) // {stage:'loading'|'running', pct} while offline-transcribing
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
      setStt('idle')
      await recRef.current.start(
        t => { setTranscript(t); onChangeRef.current?.({ url: null, transcript: t, recording: true }) },
        status => setStt(status.startsWith('unavailable') ? 'unavailable' : status)
      )
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

  // offline speech-to-text (Whisper via WASM) — used when live recognition
  // isn't available (desktop app) or the user wants to auto-fill the transcript
  const transcribeRecording = async () => {
    if (!blobRef.current) return
    setError(''); setTx({ stage: 'loading', pct: 0 })
    try {
      const { transcribeBlob } = await import('../lib/transcribe.js')
      const text = await transcribeBlob(blobRef.current, (stage, pct) => setTx({ stage, pct }))
      setTx(null)
      if (text) { setTranscript(text); emit({ transcript: text }) }
      else setError('Nothing was transcribed — the recording may be silent. Type your answer instead.')
    } catch (e) {
      setTx(null)
      setError('Auto-transcription failed (' + (e?.message || e) + '). Type your answer below instead.')
    }
  }

  const stop = async () => {
    if (!recRef.current) return
    const res = await recRef.current.stop()
    recRef.current = null
    setRecording(false)
    if (res.blob) blobRef.current = res.blob
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
        {/* offline auto-transcribe (Whisper WASM) — available once a recording exists */}
        {url && !recording && !tx && (
          <button className="btn-ghost !px-3 !py-2 text-xs" onClick={transcribeRecording}>✨ Transcribe recording</button>
        )}
      </div>

      {tx && (
        <div className="rounded-xl bg-[#f3fbff] p-3 text-sm font-bold text-[#1899d6]">
          {tx.stage === 'loading'
            ? <>⬇️ Preparing the offline speech model… {tx.pct}% <span className="font-semibold text-neutral-400">(first time only — needs internet once, then works offline)</span></>
            : <>✍️ Transcribing your recording… <span className="font-semibold text-neutral-400">(this can take a moment)</span></>}
        </div>
      )}

      {error && <div className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">{error}</div>}

      {/* status about live (real-time) speech-to-text */}
      {stt === 'unavailable' && !tx && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">
          🎙️ Live (real-time) transcription isn’t available in the desktop app. After you stop recording, click
          <b> ✨ Transcribe recording</b> to convert it to text with the built-in offline model — or just type your answer below.
        </div>
      )}

      {!compact && (
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-neutral-400">
            <span>Transcript</span>
            {stt === 'listening' && <span className="text-[#1cb0f6]">● listening…</span>}
            {stt === 'working' && <span className="text-[#3f8f00]">● transcribing…</span>}
            {(stt === 'unavailable' || !recognitionSupported()) && <span className="text-amber-600">type your answer</span>}
          </div>
          <textarea
            className="min-h-24 w-full rounded-xl border-2 border-neutral-200 p-3 font-medium focus:border-[#1cb0f6] focus:outline-none"
            value={transcript}
            placeholder="Type what you said here (this is what gets graded)…"
            onChange={e => { setTranscript(e.target.value); emit({ transcript: e.target.value }) }}
          />
        </div>
      )}
    </div>
  )
}
