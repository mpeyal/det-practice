import React, { useEffect, useRef, useState } from 'react'
import { QUESTION_COMPONENTS } from '../questions/index.js'
import { ProgressHeader } from '../components/ui.jsx'
import { gradeItem } from '../lib/grading.js'
import { LEVEL_META, marksFor } from '../lib/difficulty.js'
import DetailView from '../components/DetailView.jsx'
import SubjectiveReview from '../components/SubjectiveReview.jsx'
import QuestionView from '../components/QuestionView.jsx'
import { stopSpeaking, prepareTts } from '../lib/tts.js'

/** Difficulty + marks chip shown above every practice question. */
function LevelBadge({ item }) {
  const meta = LEVEL_META[item.level]
  if (!meta) return null
  return (
    <div className="mx-auto mb-3 flex w-full max-w-3xl items-center gap-2">
      <span className="rounded-full px-3 py-1 text-xs font-black"
        style={{ background: `${meta.color}22`, color: meta.color }}>
        {meta.icon} {meta.label}
      </span>
      <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-black text-neutral-500">
        🏅 {marksFor(item)} marks
      </span>
    </div>
  )
}

/**
 * Section Practice runner: same question components, but with a timed/untimed
 * toggle honored, and immediate correct-answer feedback after every item.
 */
export default function PracticeRunner({ title, items, timed, onFinishAll, onQuit }) {
  const [index, setIndex] = useState(0)
  const [feedback, setFeedback] = useState(null) // { grade, response }
  const [selfScore, setSelfScore] = useState(null)
  const responsesRef = useRef({})
  const selfScoresRef = useRef({})

  // warm the voice engine up front so the first listening question plays with
  // no delay (non-blocking — system voices are ready almost immediately)
  useEffect(() => { prepareTts().catch(() => {}) }, [])

  const item = items[index]

  const handleComplete = (response) => {
    // double-submit guard (timer expiry + manual Next can fire together)
    if (item.id in responsesRef.current) return
    stopSpeaking()
    responsesRef.current[item.id] = response
    setFeedback({ grade: gradeItem(item, response), response })
  }

  const next = () => {
    if (selfScore != null) selfScoresRef.current[item.id] = selfScore
    setFeedback(null)
    setSelfScore(null)
    if (index + 1 >= items.length) {
      onFinishAll(items, responsesRef.current, selfScoresRef.current)
    } else {
      setIndex(i => i + 1)
    }
  }

  const Q = QUESTION_COMPONENTS[item.type]

  return (
    <div className="pb-16">
      <ProgressHeader index={index + (feedback ? 1 : 0)} total={items.length} onQuit={onQuit} title={`${title} · ${index + 1}/${items.length}`} />

      {!feedback ? (
        <>
          <LevelBadge item={item} />
          <Q key={item.id} item={item} timed={timed} onComplete={handleComplete} />
        </>
      ) : (
        <div className="mx-auto w-full max-w-3xl">
          <LevelBadge item={item} />
          {!feedback.grade.subjective ? (
            <div className="card">
              <div className={`mb-3 flex items-center justify-between gap-3 rounded-2xl p-3 text-lg font-black
                ${feedback.grade.score >= 0.85 ? 'bg-[#d7ffb8] text-[#3f8f00]' : 'bg-[#ffdfe0] text-[#d33131]'}`}>
                <span>{feedback.grade.score >= 0.85 ? '✅ Nice!' : `❌ ${Math.round(feedback.grade.score * 100)}% — check the correction`}</span>
                <span className="whitespace-nowrap rounded-xl bg-white/60 px-3 py-1 text-sm">
                  🏅 {Math.round(feedback.grade.score * marksFor(item))} / {marksFor(item)} marks
                </span>
              </div>
              <QuestionView item={item} />
              <DetailView item={item} grade={feedback.grade} />
              {feedback.grade.explanation && <p className="mt-3 text-sm text-neutral-500">{feedback.grade.explanation}</p>}
            </div>
          ) : (
            <div className="card">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-lg font-black">Your response, graded</div>
                {selfScore != null && (
                  <span className="whitespace-nowrap rounded-xl bg-neutral-100 px-3 py-1 text-sm font-black text-neutral-600">
                    🏅 {Math.round(selfScore * marksFor(item))} / {marksFor(item)} marks
                  </span>
                )}
              </div>
              <QuestionView item={item} />
              <SubjectiveReview item={item} response={feedback.response} selfScore={selfScore} onScore={setSelfScore} />
            </div>
          )}
          <div className="mt-4 text-right">
            <button className="btn" onClick={next}>{index + 1 >= items.length ? 'See summary' : 'Next'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
