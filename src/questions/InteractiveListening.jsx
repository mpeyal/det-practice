import React, { useEffect, useRef, useState } from 'react'
import { QuestionCard, Choices } from '../components/ui.jsx'
import { useCountdown, useLatest } from '../lib/hooks.js'
import { speak, stopSpeaking, conversationVoices } from '../lib/tts.js'
import { getSettings } from '../lib/storage.js'

/**
 * Interactive Listening — a TTS conversation with linked tasks:
 * pick the best reply at each choice point (spoken lines are heard, not
 * shown), then complete a sentence from the conversation, then write a short
 * summary. One overall timer.
 */
export default function InteractiveListening({ item, timed, onComplete }) {
  const conv = item.payload
  const [phase, setPhase] = useState('intro')       // intro | dialog | completion | summary
  const [turnIdx, setTurnIdx] = useState(0)
  const [heard, setHeard] = useState([])            // transcript lines revealed so far (speaker, text)
  const [pendingChoice, setPendingChoice] = useState('')
  const [replaysLeft, setReplaysLeft] = useState(2) // per spoken line
  const [speaking, setSpeaking] = useState(false)
  const [state, setState] = useState({ choices: [], completion: ['', ''], summary: '' })
  const latest = useLatest(state)
  const voicesRef = useRef(null)

  const submit = () => { stopSpeaking(); onComplete(latest.current) }
  const [left] = useCountdown(item.timeLimit, { running: timed && phase !== 'intro', onExpire: submit, resetKey: item.id })

  useEffect(() => () => stopSpeaking(), [])

  const getVoices = () => {
    if (!voicesRef.current) voicesRef.current = conversationVoices()
    return voicesRef.current
  }

  const turns = conv.turns
  const cur = turns[turnIdx]

  const speakLine = async (text, who) => {
    const [vPartner, vYou] = getVoices()
    setSpeaking(true)
    await speak(text, { rate: getSettings().ttsRate, voice: who === 'you' ? vYou : vPartner })
    setSpeaking(false)
  }

  // auto-play each partner line when it becomes current
  useEffect(() => {
    if (phase !== 'dialog' || !cur) return
    if (cur.kind === 'line') {
      setReplaysLeft(2)
      let cancelled = false
      ;(async () => {
        await speakLine(cur.text, 'partner')
        if (!cancelled) {
          setHeard(h => [...h, { speaker: conv.partner, text: cur.text }])
          setTurnIdx(i => i + 1)
        }
      })()
      return () => { cancelled = true }
    }
  }, [phase, turnIdx]) // eslint-disable-line

  // end of turns -> completion task
  useEffect(() => {
    if (phase === 'dialog' && turnIdx >= turns.length) setPhase('completion')
  }, [turnIdx, phase, turns.length])

  const confirmChoice = async () => {
    if (!pendingChoice) return
    setState(s => ({ ...s, choices: [...s.choices, pendingChoice] }))
    setHeard(h => [...h, { speaker: conv.you + ' (you)', text: pendingChoice }])
    const said = pendingChoice
    setPendingChoice('')
    setTurnIdx(i => i + 1)
    await speakLine(said, 'you')
  }

  const renderCompletionText = () => {
    const parts = conv.completion.text.split(/(\{\d\})/)
    return parts.map((chunk, i) => {
      const m = chunk.match(/^\{(\d)\}$/)
      if (!m) return <span key={i}>{chunk}</span>
      const bi = Number(m[1]) - 1
      return (
        <input
          key={i}
          value={state.completion[bi]}
          onChange={e => setState(s => ({ ...s, completion: s.completion.map((x, k) => (k === bi ? e.target.value : x)) }))}
          className="mx-1 w-28 rounded-lg border-2 border-neutral-300 px-2 py-0.5 text-center font-bold focus:border-[#1cb0f6] focus:outline-none"
          placeholder="…"
        />
      )
    })
  }

  return (
    <QuestionCard
      label="Interactive Listening"
      instructions={
        phase === 'intro' ? 'Read the scenario, then start the conversation.' :
        phase === 'dialog' ? 'Listen to the conversation and choose the best response when asked.' :
        phase === 'completion' ? 'Complete the sentence you heard in the conversation.' :
        'Summarize the conversation in your own words.'
      }
      seconds={timed && phase !== 'intro' ? left : null}
    >
      {phase === 'intro' && (
        <div className="py-6 text-center">
          <div className="mb-2 text-4xl">🎧</div>
          <p className="mx-auto max-w-md text-lg font-semibold">{conv.scenario}</p>
          <p className="mt-2 text-sm font-semibold text-neutral-400">You will speak with: {conv.partner}</p>
          <button className="btn mt-6" onClick={() => setPhase('dialog')}>Start conversation</button>
        </div>
      )}

      {phase === 'dialog' && (
        <div>
          {/* heard-so-far transcript (like the real test's left pane) */}
          <div className="mb-4 max-h-56 space-y-2 overflow-y-auto rounded-2xl bg-neutral-50 p-4">
            {heard.length === 0 && <div className="text-sm font-semibold text-neutral-400">The conversation will play out loud…</div>}
            {heard.map((h, i) => (
              <div key={i} className={`text-sm ${h.speaker.includes('(you)') ? 'text-[#1899d6]' : 'text-neutral-600'}`}>
                <span className="font-extrabold">{h.speaker}: </span>{h.text}
              </div>
            ))}
            {speaking && <div className="text-sm font-bold text-[#1cb0f6] animate-pulse">🔊 {cur?.kind === 'line' ? conv.partner + ' is speaking…' : 'playing…'}</div>}
          </div>

          {cur?.kind === 'line' && !speaking && (
            <button
              className="btn-ghost text-sm"
              disabled={replaysLeft <= 0}
              onClick={async () => { setReplaysLeft(n => n - 1); await speakLine(cur.text, 'partner') }}
            >🔁 Replay ({replaysLeft} left)</button>
          )}

          {cur?.kind === 'choice' && !speaking && (
            <div>
              <div className="mb-2 font-bold">Choose the best response:</div>
              <Choices options={cur.options} value={pendingChoice} onChange={setPendingChoice} />
              <div className="mt-3 text-right">
                <button className="btn" disabled={!pendingChoice} onClick={confirmChoice}>Say it</button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'completion' && (
        <div className="py-4">
          <div className="text-lg leading-loose font-medium">{renderCompletionText()}</div>
          <div className="mt-5 text-right">
            <button className="btn" onClick={() => setPhase('summary')}>Next</button>
          </div>
        </div>
      )}

      {phase === 'summary' && (
        <div className="py-2">
          <textarea
            autoFocus
            className="min-h-32 w-full rounded-xl border-2 border-neutral-200 p-3 font-medium focus:border-[#1cb0f6] focus:outline-none"
            placeholder="Summarize what happened in the conversation…"
            value={state.summary}
            onChange={e => setState(s => ({ ...s, summary: e.target.value }))}
          />
          <div className="mt-4 text-right">
            <button className="btn" onClick={submit}>Submit</button>
          </div>
        </div>
      )}
    </QuestionCard>
  )
}
