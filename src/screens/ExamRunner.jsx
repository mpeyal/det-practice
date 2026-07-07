import React, { useEffect, useRef, useState } from 'react'
import { QUESTION_COMPONENTS } from '../questions/index.js'
import { ProgressHeader } from '../components/ui.jsx'
import { TYPE_LABELS, materializeItem } from '../lib/exam.js'
import { gradeItem } from '../lib/grading.js'
import { stepUp, stepDown } from '../lib/difficulty.js'
import { fmtTime, useVoicePrep } from '../lib/hooks.js'
import { stopSpeaking } from '../lib/tts.js'

/**
 * Full Timed Exam runner: one question at a time, per-question timers inside
 * each component, auto-advance, NO going back. A running total clock is shown
 * like the real thing.
 *
 * ADAPTIVE difficulty (like the real DET): the exam starts at medium.
 * Objective items are materialized at show-time with the current level;
 * scoring >=80% on an item steps the difficulty up, <=45% steps it down.
 */
export default function ExamRunner({ exam, onFinish, onQuit }) {
  const [index, setIndex] = useState(-1) // -1 = pre-section interstitial
  const responsesRef = useRef({})
  const levelRef = useRef('medium')
  const materializedRef = useRef({})   // item.id -> concrete question
  const usedKeysRef = useRef(new Set()) // banked content already used this run
  const [elapsed, setElapsed] = useState(0)
  const prep = useVoicePrep() // warm the voice engine while the user reads the intro

  useEffect(() => {
    const id = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => () => stopSpeaking(), [])

  const items = exam.items
  const raw = items[index]
  // materialize once per item, at the difficulty level in force when reached
  const item = raw
    ? (materializedRef.current[raw.id] ||
       (materializedRef.current[raw.id] = materializeItem(raw, levelRef.current, usedKeysRef.current)))
    : null

  const handleComplete = (response) => {
    // double-submit guard: the per-question timer expiring and a manual Next
    // click can fire together — without this, the index advances twice and
    // silently SKIPS the following question.
    if (item.id in responsesRef.current) return
    responsesRef.current[item.id] = response
    stopSpeaking()
    // adapt: good performance -> harder items; poor -> easier
    const g = gradeItem(item, response)
    if (!g.subjective && g.score != null) {
      if (g.score >= 0.8) levelRef.current = stepUp(levelRef.current)
      else if (g.score <= 0.45) levelRef.current = stepDown(levelRef.current)
    }
    if (index + 1 >= items.length) {
      // hand the REVIEW the materialized items (with payloads + levels)
      onFinish(items.map(it => materializedRef.current[it.id] || it), responsesRef.current)
    } else {
      setIndex(i => i + 1)
    }
  }

  // brief interstitial before the first item and before the ungraded samples
  if (index === -1) {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <div className="card">
          <div className="text-5xl">🧭</div>
          <h1 className="mt-3 text-2xl font-black">Graded section begins</h1>
          <p className="mt-2 font-semibold text-neutral-500">
            About forty-five minutes of mixed question types. Each question has its own timer and advances automatically —
            you cannot go back. The test is adaptive: answer well and the questions get harder, which is how you reach a
            high score. At the end there is an ungraded Writing Sample and Speaking Sample (about ten minutes).
          </p>

          {/* Voice engine warms up here so listening audio plays instantly.
              System/native voice: ready almost immediately. Studio voice: shows
              load progress and can be skipped. */}
          {prep.ready ? (
            <p className="mt-4 text-sm font-bold text-[#3f8f00]">🔊 Voice ready — listening audio will play instantly.</p>
          ) : prep.neural ? (
            <div className="mt-4">
              <div className="mx-auto flex max-w-xs items-center gap-2">
                <div className="pbar !h-2.5 flex-1"><div style={{ width: `${prep.pct}%` }} /></div>
                <span className="text-xs font-bold text-neutral-400">{prep.pct}%</span>
              </div>
              <p className="mt-1 text-xs font-semibold text-neutral-400">Preparing Studio voices for instant playback…</p>
            </div>
          ) : (
            <p className="mt-4 text-sm font-semibold text-neutral-400">Preparing voice…</p>
          )}

          <button
            className="btn mt-6 disabled:opacity-60"
            disabled={!prep.ready && prep.neural}
            onClick={() => setIndex(0)}
          >
            {(!prep.ready && prep.neural) ? `Preparing… ${prep.pct}%` : 'Begin'}
          </button>
          {!prep.ready && prep.neural && (
            <div>
              <button className="mt-3 text-sm font-bold text-neutral-400 underline" onClick={() => setIndex(0)}>
                Skip and start now (audio may lag on the first question)
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const Q = QUESTION_COMPONENTS[item.type]
  return (
    <div className="pb-16">
      <ProgressHeader
        index={index + 1}
        total={items.length}
        onQuit={onQuit}
        title={`${index + 1}/${items.length} · ⏱ ${fmtTime(elapsed)}`}
      />
      {item.isSample && (
        <div className="mx-auto mb-3 w-full max-w-3xl rounded-2xl bg-[#fff8e1] px-4 py-2 text-sm font-bold text-amber-700">
          Ungraded {TYPE_LABELS[item.type]} — shown to institutions on the real test. Do your best anyway.
        </div>
      )}
      <Q key={item.id} item={item} timed onComplete={handleComplete} />
    </div>
  )
}
