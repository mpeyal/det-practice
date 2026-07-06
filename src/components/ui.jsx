import React, { useEffect, useRef } from 'react'
import { fmtTime } from '../lib/hooks.js'

/** Countdown pill; turns red under 10s. */
export function TimerPill({ seconds, warn = 10 }) {
  if (seconds == null) return null
  const danger = seconds <= warn
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-extrabold tabular-nums
      ${danger ? 'bg-red-100 text-red-500 animate-pulse' : 'bg-neutral-100 text-neutral-600'}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5" /><path d="M9 2h6" />
      </svg>
      {fmtTime(seconds)}
    </div>
  )
}

/** Standard frame around every question. */
export function QuestionCard({ label, instructions, seconds, children }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-widest text-[#1cb0f6]">{label}</div>
          {instructions && <div className="mt-0.5 text-sm font-semibold text-neutral-500">{instructions}</div>}
        </div>
        <TimerPill seconds={seconds} />
      </div>
      <div className="card">{children}</div>
    </div>
  )
}

export function ProgressHeader({ index, total, onQuit, title }) {
  return (
    <div className="mx-auto mb-6 flex w-full max-w-3xl items-center gap-4">
      <button onClick={onQuit} title="Quit" className="text-2xl font-black text-neutral-300 hover:text-neutral-500 cursor-pointer">✕</button>
      <div className="pbar flex-1"><div style={{ width: `${(index / total) * 100}%` }} /></div>
      <div className="whitespace-nowrap text-sm font-extrabold text-neutral-400">{title || `${index} / ${total}`}</div>
    </div>
  )
}

/**
 * One input box per missing letter (Fill in the Blanks / Read and Complete).
 * value is a plain string; boxes auto-advance and support backspace.
 */
export function LetterBoxes({ length, value, onChange, autoFocus = false, disabled = false }) {
  const refs = useRef([])
  useEffect(() => {
    if (autoFocus && refs.current[0]) refs.current[0].focus()
  }, [autoFocus])

  const setChar = (i, ch) => {
    const chars = value.padEnd(length, ' ').split('')
    chars[i] = ch || ' '
    onChange(chars.join('').replace(/\s+$/, ''))
  }

  return (
    <span className="inline-block whitespace-nowrap align-middle">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={el => (refs.current[i] = el)}
          className="gapbox"
          maxLength={1}
          disabled={disabled}
          value={(value[i] || '').trim()}
          onChange={e => {
            const ch = e.target.value.replace(/[^a-zA-Z']/g, '').slice(-1).toLowerCase()
            setChar(i, ch)
            if (ch && refs.current[i + 1]) refs.current[i + 1].focus()
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !(value[i] || '').trim() && refs.current[i - 1]) {
              refs.current[i - 1].focus()
              setChar(i - 1, '')
              e.preventDefault()
            }
            if (e.key === 'ArrowLeft' && refs.current[i - 1]) refs.current[i - 1].focus()
            if (e.key === 'ArrowRight' && refs.current[i + 1]) refs.current[i + 1].focus()
          }}
        />
      ))}
    </span>
  )
}

export function WordCount({ text, min }) {
  const n = (text || '').trim().split(/\s+/).filter(Boolean).length
  return (
    <div className={`text-right text-sm font-bold ${min && n < min ? 'text-neutral-400' : 'text-[#58cc02]'}`}>
      {n} word{n === 1 ? '' : 's'}{min ? ` · aim for ${min}+` : ''}
    </div>
  )
}

/**
 * Renders a bundled photo. Real photographs live in public/photos/ and are
 * referenced via `img`; entries may instead carry an inline `svg` scene
 * (legacy / user-added without an image file).
 */
export function PhotoView({ photo }) {
  if (photo.img) {
    return (
      <img
        src={`./${photo.img}`}
        alt={photo.alt}
        className="mx-auto block w-full max-w-md rounded-2xl border-2 border-neutral-200 object-cover"
        style={{ maxHeight: '340px' }}
      />
    )
  }
  return (
    <div
      className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border-2 border-neutral-200 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
      role="img"
      aria-label={photo.alt}
      dangerouslySetInnerHTML={{ __html: photo.svg }}
    />
  )
}

/** Multiple-choice option list. */
export function Choices({ options, value, onChange, disabled }) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt, i) => (
        <button
          key={i}
          className={`choice ${value === opt ? 'selected' : ''}`}
          disabled={disabled}
          onClick={() => onChange(opt)}
        >
          <span className="mr-2 inline-block w-6 rounded-md bg-neutral-100 text-center text-sm font-black text-neutral-400">{i + 1}</span>
          {opt}
        </button>
      ))}
    </div>
  )
}
