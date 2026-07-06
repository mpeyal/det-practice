import React, { useState } from 'react'
import { QuestionCard } from '../components/ui.jsx'
import AudioBar from '../components/AudioBar.jsx'
import { useCountdown, useLatest } from '../lib/hooks.js'

/**
 * Listen and Type — TTS reads one sentence (max 3 plays); type exactly what
 * you heard. 1 minute when timed.
 */
export default function ListenType({ item, timed, onComplete }) {
  const [text, setText] = useState('')
  const latest = useLatest(text)

  const submit = () => onComplete({ text: latest.current })
  const [left] = useCountdown(item.timeLimit, { running: timed, onExpire: submit, resetKey: item.id })

  return (
    <QuestionCard
      label="Listen and Type"
      instructions="Type the statement you hear. You can play it up to 3 times."
      seconds={timed ? left : null}
    >
      {/* voiceKey rotates the speaker per question, like the real test */}
      <div className="mb-5"><AudioBar text={item.payload.text} maxPlays={3} voiceKey={item.id} autoPlay /></div>
      <textarea
        autoFocus
        className="min-h-28 w-full rounded-xl border-2 border-neutral-200 p-3 text-lg font-medium focus:border-[#1cb0f6] focus:outline-none"
        placeholder="Type what you hear…"
        value={text}
        onChange={e => setText(e.target.value)}
      />
      <div className="mt-4 text-right">
        <button className="btn" onClick={submit}>Next</button>
      </div>
    </QuestionCard>
  )
}
