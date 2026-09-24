import React, { useState } from 'react'
import { QuestionCard, PhotoView, WordCount } from '../components/ui.jsx'
import { useCountdown, useLatest } from '../lib/hooks.js'
import { TIME } from '../lib/exam.js'

const TA = (props) => (
  <textarea
    autoFocus
    className="min-h-40 w-full rounded-xl border-2 border-neutral-200 p-3 text-lg font-medium leading-relaxed focus:border-[#1cb0f6] focus:outline-none"
    {...props}
  />
)

/** Write About the Photo — 1 minute. */
export function WritePhoto({ item, timed, onComplete }) {
  const [text, setText] = useState('')
  const latest = useLatest(text)
  const submit = () => onComplete({ text: latest.current })
  const [left] = useCountdown(item.timeLimit, { running: timed, onExpire: submit, resetKey: item.id })

  return (
    <QuestionCard label="Write About the Photo" instructions="Write one or more sentences describing the image." seconds={timed ? left : null}>
      <PhotoView photo={item.payload.photo} />
      <div className="mt-4">
        <TA placeholder="Describe what you see…" value={text} onChange={e => setText(e.target.value)} style={{ minHeight: '7rem' }} />
        <WordCount text={text} min={25} />
      </div>
      <div className="mt-2 text-right"><button className="btn" onClick={submit}>Submit</button></div>
    </QuestionCard>
  )
}

/** Interactive Writing — respond to a prompt (5 min), then a follow-up (3 min). */
export function InteractiveWriting({ item, timed, onComplete }) {
  const p = item.payload
  const [part, setPart] = useState(1)
  const [t1, setT1] = useState('')
  const [t2, setT2] = useState('')
  const l1 = useLatest(t1), l2 = useLatest(t2)

  const submitAll = () => onComplete({ part1: l1.current, part2: l2.current })
  const toPart2 = () => setPart(2)

  const [left] = useCountdown(part === 1 ? TIME.interactive_writing_1 : TIME.interactive_writing_2, {
    running: timed,
    resetKey: `${item.id}-${part}`,
    onExpire: () => (part === 1 ? toPart2() : submitAll()),
  })

  return (
    <QuestionCard
      label={`Interactive Writing · part ${part} of 2`}
      instructions={part === 1 ? 'Respond to the prompt below.' : 'Now answer the follow-up question on the same topic.'}
      seconds={timed ? left : null}
    >
      {part === 1 ? (
        <>
          <p className="mb-3 text-lg font-bold">{p.prompt}</p>
          <TA placeholder="Write your response…" value={t1} onChange={e => setT1(e.target.value)} />
          <WordCount text={t1} min={80} />
          <div className="mt-2 text-right"><button className="btn" onClick={toPart2}>Continue</button></div>
        </>
      ) : (
        <>
          <div className="mb-3 max-h-28 overflow-y-auto rounded-xl bg-neutral-50 p-3 text-sm text-neutral-500">
            <span className="font-bold">Your first answer: </span>{t1 || '(empty)'}
          </div>
          <p className="mb-3 text-lg font-bold">{p.followUp}</p>
          <TA placeholder="Write your follow-up response…" value={t2} onChange={e => setT2(e.target.value)} />
          <WordCount text={t2} min={40} />
          <div className="mt-2 text-right"><button className="btn" onClick={submitAll}>Submit</button></div>
        </>
      )}
    </QuestionCard>
  )
}

/** Writing Sample — ungraded longer response (5 min). */
export function WritingSample({ item, timed, onComplete }) {
  const [text, setText] = useState('')
  const [preparing, setPreparing] = useState(!!item.payload.prepSeconds)
  const latest = useLatest(text)
  const submit = () => onComplete({ text: latest.current })
  const [left] = useCountdown(item.timeLimit, { running: timed && !preparing, onExpire: submit, resetKey: item.id })

  const [prepLeft] = useCountdown(item.payload.prepSeconds || 0, { running: timed && preparing, onExpire: () => setPreparing(false), resetKey: `${item.id}-prep` })
  return (
    <QuestionCard label="Writing Sample" instructions="Write your best response. Your writing will receive practice feedback after submission." seconds={timed ? (preparing ? prepLeft : left) : null}>
      <p className="mb-3 text-lg font-bold">{item.payload.prompt}</p>
      {preparing ? <div className="flex items-center justify-between rounded-xl bg-amber-50 p-4"><b>Prepare your response</b><button className="btn-ghost" onClick={() => setPreparing(false)}>Start writing</button></div> : <>
      <TA placeholder="Write your response…" value={text} onChange={e => setText(e.target.value)} />
      <WordCount text={text} min={120} />
      <div className="mt-2 text-right"><button className="btn" onClick={submit}>Submit</button></div>
      </>}
    </QuestionCard>
  )
}
