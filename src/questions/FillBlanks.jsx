import React, { useState } from 'react'
import { QuestionCard, LetterBoxes } from '../components/ui.jsx'
import { useCountdown, useLatest } from '../lib/hooks.js'

/**
 * Fill in the Blanks — one word in the sentence is partly missing;
 * type the missing letters. 20 seconds when timed.
 */
export default function FillBlanks({ item, timed, onComplete }) {
  const p = item.payload
  const [text, setText] = useState('')
  const latest = useLatest(text)

  const submit = () => onComplete({ text: latest.current })
  const [left] = useCountdown(item.timeLimit, { running: timed, onExpire: submit, resetKey: item.id })

  return (
    <QuestionCard
      label="Fill in the Blanks"
      instructions="Type the missing letters to complete the word."
      seconds={timed ? left : null}
    >
      <div className="py-6 text-xl leading-relaxed font-medium">
        {p.before}
        <span className="font-bold">{p.shown}</span>
        <LetterBoxes length={p.missing.length} value={text} onChange={setText} autoFocus />
        {p.after}
      </div>
      <div className="mt-4 text-right">
        <button className="btn" onClick={submit}>Next</button>
      </div>
    </QuestionCard>
  )
}
