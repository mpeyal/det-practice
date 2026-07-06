import React, { useState } from 'react'
import { QuestionCard, LetterBoxes } from '../components/ui.jsx'
import { useCountdown, useLatest } from '../lib/hooks.js'

/**
 * Read and Complete — a paragraph where several words lost their second half.
 * 3 minutes for the whole paragraph when timed.
 */
export default function ReadComplete({ item, timed, onComplete }) {
  const parts = item.payload.parts
  const gaps = parts.filter(x => x.type === 'gap')
  const [values, setValues] = useState(() => gaps.map(() => ''))
  const latest = useLatest(values)

  const submit = () => onComplete({ gaps: latest.current })
  const [left] = useCountdown(item.timeLimit, { running: timed, onExpire: submit, resetKey: item.id })

  let gapIdx = -1
  return (
    <QuestionCard
      label="Read and Complete"
      instructions="Type the missing letters to complete the text."
      seconds={timed ? left : null}
    >
      <div className="py-4 text-lg leading-loose font-medium">
        {parts.map((part, i) => {
          if (part.type === 'text') return <span key={i}>{part.text}</span>
          gapIdx++
          const gi = gapIdx
          return (
            <span key={i} className="whitespace-nowrap">
              <span className="font-bold">{part.shown}</span>
              <LetterBoxes
                length={part.missing.length}
                value={values[gi]}
                onChange={v => setValues(vals => vals.map((x, k) => (k === gi ? v : x)))}
                autoFocus={gi === 0}
              />
            </span>
          )
        })}
      </div>
      <div className="mt-4 text-right">
        <button className="btn" onClick={submit}>Next</button>
      </div>
    </QuestionCard>
  )
}
