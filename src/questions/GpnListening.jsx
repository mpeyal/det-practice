import React, { useEffect, useState } from 'react'
import { QuestionCard, Choices, WordCount } from '../components/ui.jsx'
import AudioBar from '../components/AudioBar.jsx'
import { useCountdown, useLatest } from '../lib/hooks.js'
import { stopSpeaking } from '../lib/tts.js'

/** The booklet's conversation-choice workflow, followed by a separate summary. */
export default function GpnListening({ item, timed, onComplete }) {
  const p = item.payload
  const [turn, setTurn] = useState(0)
  const [stage, setStage] = useState('conversation')
  const [responses, setResponses] = useState([])
  const [selected, setSelected] = useState('')
  const [summary, setSummary] = useState('')
  const latest = useLatest({ responses, summary })
  const toSummary = () => { stopSpeaking(); setStage('summary') }
  const submit = () => onComplete(latest.current)
  useEffect(() => () => stopSpeaking(), [])
  const [left] = useCountdown(stage === 'conversation' ? 240 : 75, { running: timed, resetKey: `${item.id}-${stage}`, onExpire: stage === 'conversation' ? toSummary : submit })
  const current = p.turns[turn]
  const advance = () => {
    if (current.speaker === 'you') setResponses(r => [...r, selected])
    setSelected('')
    stopSpeaking()
    if (turn + 1 === p.turns.length) toSummary()
    else setTurn(t => t + 1)
  }
  return <QuestionCard label={stage === 'conversation' ? 'Interactive Listening' : 'Summarize the Conversation'} instructions={stage === 'conversation' ? 'Listen to your partner and choose the best response.' : 'Summarize the conversation in your own words.'} seconds={timed ? left : null}>
    {stage === 'conversation' ? <>
      <p className="mb-4 rounded-xl bg-neutral-50 p-4 font-semibold">{p.scenario}</p>
      <div className="mb-4 space-y-2">{p.turns.slice(0, turn).map((t, i) => <div key={i} className="rounded-xl bg-neutral-50 p-3 text-sm"><b>{t.speaker === 'you' ? 'You' : p.partner}: </b>{t.speaker === 'you' ? <>{t.answer}{responses[p.turns.slice(0,i).filter(t => t.speaker === 'you').length] !== t.answer && <p className="mt-1 text-xs text-amber-700">The correct response is shown above. Your choice: {responses[p.turns.slice(0,i).filter(t => t.speaker === 'you').length] || '(none)'}</p>}</> : 'Audio played'}</div>)}</div>
      {current.speaker === 'partner' ? <div key={turn}><h2 className="mb-3 font-bold">{p.partner}</h2><AudioBar text={current.text} maxPlays={1} voiceKey={item.id} autoPlay /><p className="mt-2 text-xs text-neutral-500">Generated American English audio from the booklet’s conversation transcript.</p></div> : <Choices letters options={current.options} value={selected} onChange={setSelected} />}
      <div className="mt-5 text-right"><button className="btn" disabled={current.speaker === 'you' && !selected} onClick={advance}>Next</button></div>
    </> : <><textarea autoFocus className="min-h-48 w-full rounded-xl border-2 p-3 text-lg" placeholder="Who spoke, what did they discuss, and what did they decide?" value={summary} onChange={e => setSummary(e.target.value)} /><WordCount text={summary} /><div className="mt-4 text-right"><button className="btn" onClick={submit}>Submit</button></div></>}
  </QuestionCard>
}
