import React, { useEffect, useRef, useState } from 'react'
import { QuestionCard, PhotoView } from '../components/ui.jsx'
import RecorderPanel from '../components/RecorderPanel.jsx'
import { useCountdown, useLatest } from '../lib/hooks.js'
import { TIME } from '../lib/exam.js'
import { speak, stopSpeaking } from '../lib/tts.js'
import { getSettings } from '../lib/storage.js'

/**
 * Shared shell for prep-then-record speaking tasks.
 * Phase 1: prep countdown (read/look). Phase 2: record with its own countdown.
 * When time expires the recorder is force-stopped, then the answer submits.
 */
function PrepRecordTask({ label, instructions, prepSeconds, recordSeconds, timed, resetKey, onComplete, children }) {
  const [phase, setPhase] = useState(prepSeconds > 0 ? 'prep' : 'record')
  const [stopSignal, setStopSignal] = useState(0)
  const answer = useRef({ url: null, transcript: '', recording: false })

  const finish = () => {
    // force-stop the mic, give MediaRecorder a beat to flush, then submit
    setStopSignal(s => s + 1)
    setTimeout(() => onComplete({ url: answer.current.url, transcript: answer.current.transcript }), 700)
  }

  const [prepLeft] = useCountdown(prepSeconds, {
    running: timed && phase === 'prep',
    resetKey: `${resetKey}-prep`,
    onExpire: () => setPhase('record'),
  })
  const [recLeft] = useCountdown(recordSeconds, {
    running: timed && phase === 'record',
    resetKey: `${resetKey}-rec`,
    onExpire: finish,
  })

  return (
    <QuestionCard
      label={label}
      instructions={phase === 'prep' ? 'Prepare your answer. Recording starts when the prep timer ends.' : instructions}
      seconds={timed ? (phase === 'prep' ? prepLeft : recLeft) : null}
    >
      {children}
      <div className="mt-5">
        {phase === 'prep' ? (
          <div className="flex items-center justify-between rounded-2xl bg-[#fff8e1] p-4">
            <div className="font-bold text-amber-700">🕐 Preparation time…</div>
            <button className="btn-ghost" onClick={() => setPhase('record')}>I'm ready — start now</button>
          </div>
        ) : (
          <>
            <RecorderPanel autoStart={timed} stopSignal={stopSignal} onChange={v => { answer.current = v }} />
            <div className="mt-4 text-right"><button className="btn" onClick={finish}>Submit</button></div>
          </>
        )}
      </div>
    </QuestionCard>
  )
}

/** Speak About the Photo — 20s to look, then up to 90s speaking. */
export function SpeakPhoto({ item, timed, onComplete }) {
  return (
    <PrepRecordTask
      label="Speak About the Photo"
      instructions="Describe the image aloud in as much detail as you can."
      prepSeconds={TIME.speak_prep} recordSeconds={TIME.speak_photo}
      timed={timed} resetKey={item.id} onComplete={onComplete}
    >
      <PhotoView photo={item.payload.photo} />
    </PrepRecordTask>
  )
}

/** Read, Then Speak — 30s prep, then 90s speaking. */
export function ReadThenSpeak({ item, timed, onComplete }) {
  return (
    <PrepRecordTask
      label="Read, Then Speak"
      instructions="Answer the prompt aloud. Try to speak for the whole time."
      prepSeconds={TIME.read_then_speak_prep} recordSeconds={TIME.read_then_speak}
      timed={timed} resetKey={item.id} onComplete={onComplete}
    >
      <p className="text-lg font-bold leading-relaxed">{item.payload.prompt}</p>
    </PrepRecordTask>
  )
}

/** Speaking Sample — ungraded; 30s prep, up to 3 minutes speaking. */
export function SpeakingSample({ item, timed, onComplete }) {
  return (
    <PrepRecordTask
      label="Speaking Sample (ungraded)"
      instructions="This part is shown to institutions on the real test. Speak for one to three minutes."
      prepSeconds={TIME.speaking_sample_prep} recordSeconds={TIME.speaking_sample}
      timed={timed} resetKey={item.id} onComplete={onComplete}
    >
      <p className="text-lg font-bold leading-relaxed">{item.payload.prompt}</p>
    </PrepRecordTask>
  )
}

/**
 * Interactive Speaking — 6 short questions in a simulated conversation,
 * 35 seconds of speaking per question. Each question is spoken via TTS.
 */
export function InteractiveSpeaking({ item, timed, onComplete }) {
  const p = item.payload
  const [qIdx, setQIdx] = useState(-1) // -1 = intro
  const [asking, setAsking] = useState(false) // true while the TTS reads the question
  const [stopSignal, setStopSignal] = useState(0)
  const answersRef = useRef([])
  const current = useRef({ url: null, transcript: '' })

  useEffect(() => () => stopSpeaking(), [])

  const startQuestion = async (i) => {
    setQIdx(i)
    setAsking(true) // reading the question aloud — do NOT record yet, or the
    current.current = { url: null, transcript: '' } // mic captures the TTS voice
    // one consistent interviewer voice for the whole conversation
    await speak(p.questions[i], { rate: getSettings().ttsRate, voiceKey: item.id })
    setAsking(false) // question finished — now the mic + timer start
  }

  const nextQuestion = () => {
    setStopSignal(s => s + 1)
    setTimeout(() => {
      answersRef.current[qIdx] = { ...current.current }
      if (qIdx + 1 >= p.questions.length) {
        onComplete({ answers: answersRef.current.slice() })
      } else {
        startQuestion(qIdx + 1)
      }
    }, 700)
  }

  // the 35s answer timer only runs once the question has finished being read
  const [left] = useCountdown(TIME.interactive_speaking_q, {
    running: timed && qIdx >= 0 && !asking,
    resetKey: `q${qIdx}`,
    onExpire: nextQuestion,
  })

  if (qIdx === -1) {
    return (
      <QuestionCard label="Interactive Speaking" instructions="You will hear 6 questions. Answer each one aloud — 35 seconds each.">
        <div className="py-6 text-center">
          <div className="mb-2 text-4xl">🎤</div>
          <p className="mx-auto max-w-md text-lg font-semibold">{p.scenario}</p>
          <button className="btn mt-6" onClick={() => startQuestion(0)}>Start</button>
        </div>
      </QuestionCard>
    )
  }

  return (
    <QuestionCard
      label={`Interactive Speaking · question ${qIdx + 1} of ${p.questions.length}`}
      instructions="Answer aloud. The next question comes automatically."
      seconds={timed ? left : null}
    >
      <div className="mb-4 flex items-start gap-3 rounded-2xl bg-neutral-50 p-4">
        <button className="btn-ghost !px-3 !py-1.5 text-sm" disabled={asking} onClick={() => speak(p.questions[qIdx], { rate: getSettings().ttsRate, voiceKey: item.id })}>🔊</button>
        <p className="pt-1 text-lg font-bold">{p.questions[qIdx]}</p>
      </div>
      {asking ? (
        <div className="flex items-center gap-2 rounded-2xl bg-[#f3fbff] p-4 text-sm font-extrabold text-[#1899d6]">
          <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[#1cb0f6]" />
          🔊 Listen to the question… recording starts when it finishes.
        </div>
      ) : (
        // mount only after the question is spoken, so the mic never records the TTS voice
        <RecorderPanel key={qIdx} autoStart={timed} stopSignal={stopSignal} onChange={v => { current.current = v }} />
      )}
      <div className="mt-4 text-right">
        <button className="btn" disabled={asking} onClick={nextQuestion}>{qIdx + 1 >= p.questions.length ? 'Finish' : 'Next question'}</button>
      </div>
    </QuestionCard>
  )
}
