import React, { useState } from 'react'
import { SKILL_GROUPS, TYPE_LABELS } from '../lib/exam.js'

const SKILL_META = {
  reading: { icon: '📖', color: '#58cc02' },
  listening: { icon: '🎧', color: '#1cb0f6' },
  writing: { icon: '✍️', color: '#ffc800' },
  speaking: { icon: '🎤', color: '#ff86d0' },
}

/** Pick a whole skill or a single question type; timed/untimed toggle. */
export default function PracticeMenu({ go }) {
  const [timed, setTimed] = useState(true)

  return (
    <div className="mx-auto w-full max-w-3xl pb-16">
      <button className="mb-4 text-sm font-extrabold text-neutral-400 cursor-pointer" onClick={() => go({ name: 'home' })}>← Back</button>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-black">🎯 Section Practice</h1>
        <button
          onClick={() => setTimed(t => !t)}
          className={`rounded-full px-4 py-2 text-sm font-black cursor-pointer transition ${timed ? 'bg-[#ffdfe0] text-[#d33131]' : 'bg-[#d7ffb8] text-[#3f8f00]'}`}
        >
          {timed ? '⏱ Timed — real exam clocks' : '🐢 Untimed — take your time'}
        </button>
      </div>

      <div className="space-y-5">
        {Object.entries(SKILL_GROUPS).map(([skill, types]) => (
          <div key={skill} className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black capitalize">{SKILL_META[skill].icon} {skill}</h2>
              <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => go({ name: 'practice-sets', skill, timed })}>
                Practice all {skill}
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {types.map(t => (
                <button key={t} className="choice" onClick={() => go({ name: 'practice-sets', type: t, timed })}>
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
