import React, { useEffect, useRef, useState } from 'react'
import { speak, stopSpeaking, ttsSupported } from '../lib/tts.js'
import { getSettings, saveSettings } from '../lib/storage.js'
import { isDownloaded, downloadNeural, onNeuralProgress, storedNeuralVoices } from '../lib/neuralTts.js'

/**
 * Playback control for TTS audio with a replay counter that enforces the
 * real exam limits (e.g. max 3 plays for Listen and Type) and a speed control.
 *
 * Robustness rules:
 * - a play is only spent when audio ACTUALLY plays (failed/blocked attempts,
 *   e.g. browser autoplay policy or a flaky OS voice, are refunded);
 * - if audio can't be produced we surface a clear, actionable message with a
 *   one-tap "Use Studio Voice" (reliable, offline) instead of failing silent.
 */
export default function AudioBar({ text, maxPlays = 3, voice = null, voiceKey = null, autoPlay = false, onFirstPlay }) {
  const [playsLeft, setPlaysLeft] = useState(maxPlays)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(getSettings().ttsRate)
  const [failed, setFailed] = useState(false)      // last attempt produced no sound
  const [dlPct, setDlPct] = useState(null)         // studio-voice download progress
  const mounted = useRef(true)
  const autoPlayed = useRef(false)

  useEffect(() => {
    mounted.current = true
    storedNeuralVoices() // learn download state early
    const off = onNeuralProgress((_g, p) => { if (mounted.current) setDlPct(p >= 100 ? null : p) })
    return () => { mounted.current = false; off(); stopSpeaking() }
  }, [])

  // reset when the text changes (new sub-question)
  useEffect(() => { setPlaysLeft(maxPlays); autoPlayed.current = false; setFailed(false) }, [text, maxPlays])

  const play = async () => {
    if (playing || playsLeft <= 0) return
    setFailed(false)
    setPlaysLeft(n => n - 1)
    setPlaying(true)
    onFirstPlay && playsLeft === maxPlays && onFirstPlay()
    const ok = await speak(text, { rate, voice, voiceKey })
    if (!mounted.current) return
    setPlaying(false)
    // refund a play that produced no audio (autoplay blocked, silent OS voice,
    // interrupted) so the user never loses a play to a failure they didn't hear
    if (!ok) { setPlaysLeft(n => Math.min(maxPlays, n + 1)); setFailed(true) }
  }

  // Enable the offline Studio voice, then immediately play with it.
  const enableStudio = async () => {
    setFailed(false)
    setDlPct(0)
    try {
      if (!isDownloaded('female')) await downloadNeural('female')
      saveSettings({ ttsEngine: 'neural' })
      setDlPct(null)
      autoPlayed.current = true
      await play()
    } catch {
      if (mounted.current) { setDlPct(null); setFailed(true) }
    }
  }

  useEffect(() => {
    if (autoPlay && !autoPlayed.current) {
      autoPlayed.current = true
      // slight delay so voices are loaded and the UI has painted
      const t = setTimeout(play, 400)
      return () => clearTimeout(t)
    }
  }, [text]) // eslint-disable-line

  if (!ttsSupported() && !isDownloaded('female') && !isDownloaded('male')) {
    return <div className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">
      Your browser has no speech synthesis — showing the text instead: “{text}”
    </div>
  }

  const downloading = dlPct != null

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={play}
          disabled={playing || playsLeft <= 0 || downloading}
          className={`flex h-16 w-16 items-center justify-center rounded-full text-white transition
            ${playing ? 'bg-[#1cb0f6] animate-pulse' : playsLeft > 0 && !downloading ? 'bg-[#1cb0f6] hover:brightness-105 cursor-pointer shadow-[0_4px_0_#1899d6]' : 'bg-neutral-300'}`}
          title={playsLeft > 0 ? 'Play' : 'No plays left'}
        >
          {playing
            ? <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M4 9h4v6H4zM10 6h4v12h-4zM16 3h4v18h-4z"/></svg>
            : <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
        </button>
        <div>
          <div className="text-sm font-extrabold text-neutral-600">
            {playsLeft} play{playsLeft === 1 ? '' : 's'} left
          </div>
          <div className="mt-1 flex gap-1">
            {[0.75, 1, 1.25].map(r => (
              <button key={r}
                onClick={() => { setRate(r); saveSettings({ ttsRate: r }) }}
                className={`rounded-lg px-2 py-0.5 text-xs font-black cursor-pointer
                  ${rate === r ? 'bg-[#ddf4ff] text-[#1899d6]' : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'}`}>
                {r}×
              </button>
            ))}
          </div>
        </div>
      </div>

      {downloading && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#f3fbff] p-3">
          <div className="pbar !h-2.5 flex-1"><div style={{ width: `${dlPct}%` }} /></div>
          <span className="text-xs font-bold text-[#1899d6]">Preparing Studio voice… {dlPct}%</span>
        </div>
      )}

      {failed && !downloading && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          Couldn’t play the audio. Check your device volume, then tap ▶ to retry.
          {!isDownloaded('female') && (
            <>
              {' '}For guaranteed, offline audio on any device:{' '}
              <button className="font-black text-[#1899d6] underline" onClick={enableStudio}>
                Use Studio Voice (one-time ~60 MB)
              </button>.
            </>
          )}
          <div className="mt-1 text-xs font-medium text-amber-700/80">The statement: “{text}”</div>
        </div>
      )}
    </div>
  )
}
