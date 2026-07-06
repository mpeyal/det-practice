import React, { useState } from 'react'
import { EXAM_COUNT } from '../lib/exam.js'
import { micSupported } from '../lib/recorder.js'
import { ttsSupported } from '../lib/tts.js'

/** "Start test" lobby: pick one of the 50 assembled exams, see the rules. */
export default function ExamLobby({ go }) {
  const [examNo, setExamNo] = useState(() => 1 + Math.floor(Math.random() * EXAM_COUNT))

  return (
    <div className="mx-auto w-full max-w-2xl pb-16">
      <button className="mb-4 text-sm font-extrabold text-neutral-400 cursor-pointer" onClick={() => go({ name: 'home' })}>← Back</button>
      <div className="card text-center">
        <div className="text-5xl">🏁</div>
        <h1 className="mt-2 text-2xl font-black">Full Timed Exam</h1>
        <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-neutral-500">
          ~45 minutes of graded questions (all thirteen types, mixed) followed by an ungraded Writing Sample and Speaking
          Sample (~10 minutes). Per-question countdowns, auto-advance, no going back — just like test day.
        </p>

        <div className="mx-auto mt-5 flex max-w-xs items-center justify-center gap-3">
          <label className="font-extrabold text-neutral-500">Exam #</label>
          <input
            type="number" min="1" max={EXAM_COUNT} value={examNo}
            onChange={e => setExamNo(Math.max(1, Math.min(EXAM_COUNT, Number(e.target.value) || 1)))}
            className="w-24 rounded-xl border-2 border-neutral-200 p-2 text-center text-xl font-black focus:border-[#1cb0f6] focus:outline-none"
          />
          <button className="btn-ghost !px-3 !py-2 text-sm" onClick={() => setExamNo(1 + Math.floor(Math.random() * EXAM_COUNT))}>🎲</button>
        </div>
        <p className="mt-1 text-xs font-bold text-neutral-400">{EXAM_COUNT} distinct exams — same number = same exam, so you can retake or share.</p>

        <div className="mx-auto mt-5 max-w-md space-y-1.5 text-left text-sm font-semibold text-neutral-600">
          <div className="rounded-xl bg-neutral-50 p-2.5">✅ Use a quiet room and headphones; listening audio is spoken by your device (offline TTS).</div>
          <div className={`rounded-xl p-2.5 ${micSupported() ? 'bg-neutral-50' : 'bg-amber-50 text-amber-700'}`}>
            {micSupported() ? '🎤 Microphone available for the speaking tasks — allow access when asked.' : '⚠️ No microphone detected — you can type speaking answers instead.'}
          </div>
          {!ttsSupported() && <div className="rounded-xl bg-amber-50 p-2.5 text-amber-700">⚠️ No speech synthesis in this browser — listening items will show text.</div>}
        </div>

        <button className="btn mt-6 !px-10 !py-4 text-lg" onClick={() => go({ name: 'exam', examNo })}>Start test</button>
      </div>
    </div>
  )
}
