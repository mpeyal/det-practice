import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Countdown hook. Returns [secondsLeft, restart].
 * - seconds: total time (restarting when `resetKey` changes)
 * - running: pause/resume
 * - onExpire: called exactly once when reaching 0
 */
export function useCountdown(seconds, { running = true, onExpire, resetKey } = {}) {
  const [left, setLeft] = useState(seconds)
  const expiredRef = useRef(false)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    setLeft(seconds)
    expiredRef.current = false
  }, [seconds, resetKey])

  useEffect(() => {
    if (!running || seconds == null) return
    const id = setInterval(() => {
      setLeft(prev => {
        if (prev <= 1) {
          clearInterval(id)
          if (!expiredRef.current) {
            expiredRef.current = true
            // defer so we never call setState of parent during render
            setTimeout(() => onExpireRef.current && onExpireRef.current(), 0)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running, seconds, resetKey])

  const restart = useCallback(() => { setLeft(seconds); expiredRef.current = false }, [seconds])
  return [left, restart]
}

export function fmtTime(s) {
  if (s == null) return '--:--'
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${String(ss).padStart(2, '0')}`
}

/** Keep the latest value in a ref (for use inside timeouts). */
export function useLatest(value) {
  const ref = useRef(value)
  ref.current = value
  return ref
}

/**
 * Warm the active TTS engine before an audio session so the first question
 * plays instantly. System/native voices are ready almost immediately; Studio
 * voices load + warm their models (slower), reported via `pct`.
 * Returns { ready, pct, neural }.
 */
export function useVoicePrep() {
  const [ready, setReady] = useState(false)
  const [pct, setPct] = useState(0)
  const [neural, setNeural] = useState(false)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [{ prepareTts }, { getSettings }] = await Promise.all([
        import('./tts.js'), import('./storage.js'),
      ])
      if (!alive) return
      setNeural(getSettings().ttsEngine === 'neural')
      const acc = { female: 0, male: 0 }
      try {
        await prepareTts((g, p) => {
          if (!alive || g === 'system') return
          acc[g] = p
          setPct(Math.round((acc.female + acc.male) / 2))
        })
      } catch { /* proceed anyway */ }
      if (alive) setReady(true)
    })()
    return () => { alive = false }
  }, [])
  return { ready, pct, neural }
}
