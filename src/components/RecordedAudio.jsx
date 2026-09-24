import React, { useEffect, useRef, useState } from 'react'

/** Original bundled recording. Failed playback does not consume a replay. */
export default function RecordedAudio({ src, maxPlays = 3, autoPlay = false }) {
  const audioRef = useRef(null)
  const busy = useRef(false)
  const remaining = useRef(maxPlays)
  const [left, setLeft] = useState(maxPlays)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  const play = async () => {
    if (busy.current || remaining.current <= 0) return
    busy.current = true
    const audio = audioRef.current
    setError(''); setPlaying(true)
    try {
      audio.currentTime = 0
      await audio.play()
      remaining.current -= 1
      setLeft(remaining.current)
    } catch {
      busy.current = false; setPlaying(false)
      setError('The recording could not play. Press Play to retry; your replay was not used.')
    }
  }
  useEffect(() => {
    const audio = audioRef.current
    const timer = autoPlay ? setTimeout(play, 250) : null
    return () => { clearTimeout(timer); audio.pause() }
  }, [])
  return <div className="rounded-xl bg-neutral-50 p-4">
    <audio ref={audioRef} src={`./${src}`} preload="auto" onEnded={() => { busy.current = false; setPlaying(false) }} onError={() => { busy.current = false; setPlaying(false); setError('The recording could not load. Retry playback.') }} />
    <div className="flex items-center gap-3"><button className="btn btn-blue" onClick={play} disabled={playing || left <= 0}>{playing ? 'Playing…' : '▶ Play recording'}</button><span className="text-sm font-bold">{left} plays left</span></div>
    <p className="mt-2 text-xs text-neutral-500">Original booklet QR recording</p>
    {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
  </div>
}
