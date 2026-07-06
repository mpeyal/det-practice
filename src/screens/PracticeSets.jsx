import React from 'react'
import { PRACTICE_SET_COUNT, TYPE_LABELS } from '../lib/exam.js'
import { LEVEL_META, levelForSet } from '../lib/difficulty.js'
import { getHistory } from '../lib/storage.js'

const cap = s => s[0].toUpperCase() + s.slice(1)

/**
 * Set picker for Section Practice: 30 numbered, repeatable sets per question
 * type (or per whole skill). Completed sets — matched against result history
 * titles — get a check mark. "Surprise me" builds a random one instead.
 */
export default function PracticeSets({ go, type, skill, timed }) {
  const label = skill ? `${cap(skill)} practice` : TYPE_LABELS[type]
  const done = new Set(
    getHistory()
      .map(h => h.title || '')
      .filter(t => t.startsWith(`${label} · Set #`))
      .map(t => parseInt(t.match(/Set #(\d+)/)?.[1], 10))
      .filter(Number.isFinite)
  )

  return (
    <div className="mx-auto w-full max-w-2xl pb-16">
      <button className="mb-4 text-sm font-extrabold text-neutral-400 cursor-pointer" onClick={() => go({ name: 'practice-menu' })}>← Back</button>
      <div className="card">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h1 className="text-xl font-black">{label}</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${timed ? 'bg-[#ffdfe0] text-[#d33131]' : 'bg-[#d7ffb8] text-[#3f8f00]'}`}>
            {timed ? '⏱ timed' : '🐢 untimed'}
          </span>
        </div>
        <p className="mb-4 text-sm font-semibold text-neutral-500">
          {PRACTICE_SET_COUNT} practice sets in a training ramp — start easy, finish hard. Each set number always
          contains the same questions, so you can work through them in order. {done.size > 0 && `Completed: ${done.size}/${PRACTICE_SET_COUNT}.`}
        </p>

        {[[1, 10], [11, 20], [21, 30]].map(([from, to]) => {
          const meta = LEVEL_META[levelForSet(from)]
          return (
            <div key={from} className="mb-4">
              <div className="mb-1.5 text-xs font-black uppercase tracking-widest" style={{ color: meta.color }}>
                {meta.icon} {meta.label} · sets {from}–{to}
              </div>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                {Array.from({ length: to - from + 1 }, (_, i) => from + i).map(n => (
                  <button
                    key={n}
                    onClick={() => go({ name: 'practice', type, skill, timed, setNo: n })}
                    className={`relative rounded-xl border-2 py-2.5 font-black transition cursor-pointer
                      ${done.has(n)
                        ? 'border-[#58cc02] bg-[#d7ffb8] text-[#3f8f00]'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#1cb0f6] hover:bg-[#f3fbff]'}`}
                  >
                    {n}
                    {done.has(n) && <span className="absolute -right-1.5 -top-1.5 rounded-full bg-[#58cc02] px-1 text-[10px] text-white">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )
        })}

        <div className="mt-4 text-center">
          <button className="btn-ghost" onClick={() => go({ name: 'practice', type, skill, timed, setNo: null })}>
            🎲 Surprise me (random set)
          </button>
        </div>
      </div>
    </div>
  )
}
