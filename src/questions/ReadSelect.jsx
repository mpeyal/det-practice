import React, { useEffect, useRef, useState } from 'react'
import { QuestionCard } from '../components/ui.jsx'
import { useCountdown } from '../lib/hooks.js'
import { TIME } from '../lib/exam.js'

/**
 * Read and Select — words appear one at a time; decide real vs not real.
 * 5 seconds per word when timed (matches the real exam).
 */
export default function ReadSelect({ item, timed, onComplete }) {
  const words = item.payload.items
  const [index, setIndex] = useState(0)
  const answersRef = useRef([])
  const [, force] = useState(0)

  const finish = () => onComplete({ answers: answersRef.current.slice() })

  const lastAnswerAt = useRef(0)
  const answer = (val) => {
    // debounce: a double-click (or click + timer expiry together) must not
    // answer two words at once
    const now = Date.now()
    if (now - lastAnswerAt.current < 250) return
    lastAnswerAt.current = now
    answersRef.current[index] = val
    if (index + 1 >= words.length) finish()
    else { setIndex(i => i + 1); force(x => x + 1) }
  }

  const [left] = useCountdown(TIME.read_select_item, {
    running: timed,
    resetKey: index,
    onExpire: () => answer(null), // no answer counts as wrong
  })

  // keyboard: 1/Y = real, 2/N = not real
  useEffect(() => {
    const h = (e) => {
      if (e.key === '1' || e.key.toLowerCase() === 'y') answer(true)
      if (e.key === '2' || e.key.toLowerCase() === 'n') answer(false)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }) // re-bind each render so `index` is fresh

  return (
    <QuestionCard
      label={`Read and Select · ${index + 1} of ${words.length}`}
      instructions="Is this a real English word?"
      seconds={timed ? left : null}
    >
      <div className="py-10 text-center">
        <div className="mb-10 text-5xl font-black tracking-wide">{words[index].word}</div>
        <div className="flex justify-center gap-4">
          <button className="btn min-w-36" onClick={() => answer(true)}>Yes <span className="ml-1 rounded bg-white/25 px-1.5 text-xs">1</span></button>
          <button className="btn btn-red min-w-36" onClick={() => answer(false)}>No <span className="ml-1 rounded bg-white/25 px-1.5 text-xs">2</span></button>
        </div>
        <div className="mt-8 flex justify-center gap-1">
          {words.map((_, i) => (
            <span key={i} className={`h-1.5 w-3 rounded-full ${i < index ? 'bg-[#58cc02]' : i === index ? 'bg-[#1cb0f6]' : 'bg-neutral-200'}`} />
          ))}
        </div>
      </div>
    </QuestionCard>
  )
}
