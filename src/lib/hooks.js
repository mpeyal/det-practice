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
