import React, { useEffect, useRef, useState } from 'react'
import { QuestionCard } from '../components/ui.jsx'
import { useCountdown, useLatest } from '../lib/hooks.js'
import { speak, stopSpeaking, conversationVoices } from '../lib/tts.js'
import { getSettings } from '../lib/storage.js'

/**
 * Interactive Listening — the current Duolingo English Test format, in two parts:
 *
 *  Part A — Listen & comprehend
 *    Hear the whole scenario conversation, then fill in short comprehension
 *    blanks about what was said.
 *
 *  Part B — Participate in the conversation
 *    Pick the best option to START the conversation, then each turn: hear the
 *    other speaker (audio plays once) and SELECT the best response. Immediate
 *    right/wrong + best-answer feedback after every choice.
 *
 * Audio is the bundled Studio voice, so every clip plays instantly.
 */
export default function InteractiveListening({ item, timed, onComplete }) {
  const conv = item.payload
  const [phase, setPhase] = useState('scenario')   // scenario | comprehend | participate
  const [state, setState] = useState({
    comprehension: conv.comprehension.map(() => ''),
    opener: '',
    responses: conv.rounds.map(() => ''),
  })
  const latest = useLatest(state)
  const voicesRef = useRef(null)
  const getVoices = () => (voicesRef.current || (voicesRef.current = conversationVoices()))

  const submit = () => { stopSpeaking(); onComplete(latest.current) }
  const [left] = useCountdown(item.timeLimit, { running: timed && phase !== 'scenario', onExpire: submit, resetKey: item.id })
  useEffect(() => () => stopSpeaking(), [])

  const nQuestions = conv.comprehension.length + 1 + conv.rounds.length

  return (
    <QuestionCard
      label="Interactive Listening"
      instructions={
        phase === 'participate'
          ? 'Participate in a conversation about this scenario'
          : 'Listen to the scenario and then answer questions'
      }
      seconds={timed && phase !== 'scenario' ? left : null}
    >
      {phase === 'scenario' && (
        <ScenarioStage conv={conv} getVoices={getVoices} nQuestions={nQuestions} onDone={() => setPhase('comprehend')} />
      )}

      {phase === 'comprehend' && (
        <Comprehension
          conv={conv} getVoices={getVoices}
          values={state.comprehension}
          onChange={(i, v) => setState(s => ({ ...s, comprehension: s.comprehension.map((x, k) => (k === i ? v : x)) }))}
          onDone={() => setPhase('participate')}
        />
      )}

      {phase === 'participate' && (
        <Participate
          conv={conv} getVoices={getVoices}
          onPick={(kind, i, val) => setState(s => kind === 'opener'
            ? { ...s, opener: val }
            : { ...s, responses: s.responses.map((x, k) => (k === i ? val : x)) })}
          onDone={submit}
        />
      )}
    </QuestionCard>
  )
}

/* ---------- Part A: listen to the scenario ---------- */

function Waveform({ playing }) {
  // decorative bars, like the real test's audio clip
  const bars = [6, 12, 20, 14, 26, 18, 10, 22, 30, 16, 8, 24, 14, 20, 12, 28, 18, 10, 22, 14, 8, 18, 26, 12]
  return (
    <div className="flex flex-1 items-center gap-[3px] overflow-hidden">
      {bars.map((h, i) => (
        <span key={i} className={`w-[3px] rounded-full ${playing ? 'bg-[#1cb0f6]' : 'bg-neutral-300'}`}
          style={{ height: h, opacity: playing ? 0.5 + 0.5 * Math.abs(Math.sin(i)) : 0.6 }} />
      ))}
    </div>
  )
}

/** Play the whole scenario dialogue in sequence (both speakers). */
function useDialoguePlayer(conv, getVoices) {
  const [playing, setPlaying] = useState(false)
  const tokenRef = useRef(0)
  const play = async () => {
    if (playing) return
    const token = ++tokenRef.current
    setPlaying(true)
    const [vPartner, vYou] = getVoices()
    for (const line of conv.dialogue) {
      if (token !== tokenRef.current) break
      await speak(line.text, { rate: getSettings().ttsRate, voice: line.speaker === 'you' ? vYou : vPartner })
    }
    if (token === tokenRef.current) setPlaying(false)
  }
  const stop = () => { tokenRef.current++; stopSpeaking(); setPlaying(false) }
  useEffect(() => () => { tokenRef.current++ }, [])
  return { playing, play, stop }
}

function AudioClip({ playing, onPlay, disabled, big }) {
  return (
    <div className={`flex items-center gap-4 rounded-2xl border-2 border-[#e8e8e6] ${big ? 'p-4' : 'p-3'}`}>
      <button
        onClick={onPlay}
        disabled={disabled}
        className={`flex ${big ? 'h-14 w-14' : 'h-12 w-12'} shrink-0 items-center justify-center rounded-2xl text-white transition
          ${disabled ? 'bg-neutral-300' : playing ? 'bg-[#1cb0f6] animate-pulse' : 'bg-[#1cb0f6] hover:brightness-105 cursor-pointer shadow-[0_4px_0_#1899d6]'}`}
        title={playing ? 'Playing…' : 'Play'}
      >
        {playing
          ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
          : <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
      </button>
      <Waveform playing={playing} />
    </div>
  )
}

function ScenarioStage({ conv, getVoices, nQuestions, onDone }) {
  const { playing, play } = useDialoguePlayer(conv, getVoices)
  const [heard, setHeard] = useState(false)
  useEffect(() => {
    // auto-play once on mount
    const t = setTimeout(() => { play(); setHeard(true) }, 400)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line

  return (
    <div className="py-2">
      <p className="mb-4 text-center text-sm font-semibold text-neutral-500">{conv.scenario}</p>
      <AudioClip big playing={playing} onPlay={() => { play(); setHeard(true) }} />
      <div className="mt-6 text-right">
        <button className="btn" disabled={!heard} onClick={onDone}>Answer the questions →</button>
      </div>
      {!heard && <p className="mt-2 text-right text-xs font-semibold text-neutral-400">Listen to the scenario first</p>}
    </div>
  )
}

/* ---------- Part A: comprehension blanks ---------- */

function Comprehension({ conv, getVoices, values, onChange, onDone }) {
  const { playing, play } = useDialoguePlayer(conv, getVoices)
  const filled = values.filter(v => v.trim()).length
  return (
    <div className="py-2">
      <div className="mb-5"><AudioClip playing={playing} onPlay={play} /></div>
      <div className="space-y-4">
        {conv.comprehension.map((c, i) => (
          <div key={i}>
            <div className="mb-1 font-bold text-neutral-700">{c.q}</div>
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-neutral-50 p-3 text-[15px] font-medium">
              <span>{c.pre}</span>
              <input
                value={values[i]}
                onChange={e => onChange(i, e.target.value)}
                className="w-40 border-b-2 border-[#1cb0f6] bg-transparent px-1 py-0.5 text-center font-bold text-[#1899d6] focus:outline-none"
                placeholder="…"
              />
              <span>{c.post}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 text-right">
        <button className="btn" disabled={filled === 0} onClick={onDone}>Continue →</button>
      </div>
    </div>
  )
}

/* ---------- Part B: participate in the conversation ---------- */

function Participate({ conv, getVoices, onPick, onDone }) {
  // steps: index 0 = opener, 1..rounds.length = rounds
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState('')
  const [revealed, setRevealed] = useState(false) // feedback shown for this step
  const total = 1 + conv.rounds.length
  const isOpener = step === 0
  const round = isOpener ? null : conv.rounds[step - 1]
  const q = isOpener ? conv.opener : round

  // play the other speaker's line for a round (audio "plays once")
  const [playing, setPlaying] = useState(false)
  const playedRef = useRef(-1)
  const playRoundAudio = async (force) => {
    if (isOpener || !round?.audio) return
    if (!force && playedRef.current === step) return
    playedRef.current = step
    setPlaying(true)
    const [vPartner] = getVoices()
    await speak(round.audio, { rate: getSettings().ttsRate, voice: vPartner })
    setPlaying(false)
  }
  useEffect(() => {
    setSelected(''); setRevealed(false)
    if (!isOpener) { const t = setTimeout(() => playRoundAudio(false), 350); return () => clearTimeout(t) }
  }, [step]) // eslint-disable-line

  const confirm = () => {
    if (!selected) return
    onPick(isOpener ? 'opener' : 'round', isOpener ? 0 : step - 1, selected)
    setRevealed(true)
  }
  const next = () => {
    if (step + 1 >= total) onDone()
    else setStep(s => s + 1)
  }

  const correct = q.answer
  const isRight = selected === correct

  return (
    <div className="py-2">
      <div className="mb-3 text-xs font-bold text-neutral-400">Question {step + 1} of {total}</div>

      {/* the other speaker's audio (rounds only) */}
      {!isOpener && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-bold text-neutral-500">🔒 Listen closely! Audio clips only play once.</p>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#ddf4ff] text-xl">💬</div>
            <div className="flex-1"><AudioClip playing={playing} onPlay={() => playRoundAudio(true)} disabled={revealed} /></div>
          </div>
        </div>
      )}

      <div className="mb-2 font-extrabold text-neutral-700">{q.prompt}</div>

      <div className="space-y-2">
        {q.options.map((opt, i) => {
          const chosen = selected === opt
          let cls = 'border-neutral-200 bg-white hover:border-neutral-300'
          if (revealed) {
            if (opt === correct) cls = 'border-[#58cc02] bg-[#d7ffb8]'
            else if (chosen) cls = 'border-[#ff4b4b] bg-[#ffdfe0] line-through text-neutral-500'
            else cls = 'border-neutral-200 bg-white opacity-60'
          } else if (chosen) cls = 'border-[#1cb0f6] bg-[#ddf4ff]'
          return (
            <button key={i} disabled={revealed}
              onClick={() => setSelected(opt)}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[15px] font-semibold transition ${cls}`}>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${chosen ? 'border-current' : 'border-neutral-300'}`}>
                {revealed && opt === correct ? '✓' : revealed && chosen ? '✕' : chosen ? '•' : ''}
              </span>
              {opt}
            </button>
          )
        })}
      </div>

      {revealed && (
        <div className={`mt-4 rounded-2xl p-3 text-sm ${isRight ? 'bg-[#d7ffb8]' : 'bg-[#fff1f1]'}`}>
          <div className="font-black">{isRight ? '✅ Correct!' : '❌ Not quite'}</div>
          {!isRight && <div className="mt-1"><b>Best answer:</b> {correct}</div>}
          {q.explanation && <div className="mt-1 text-neutral-600">{q.explanation}</div>}
        </div>
      )}

      <div className="mt-5 text-right">
        {!revealed
          ? <button className="btn" disabled={!selected} onClick={confirm}>Submit</button>
          : <button className="btn" onClick={next}>{step + 1 >= total ? 'Finish' : 'Continue →'}</button>}
      </div>
    </div>
  )
}
