import React, { useEffect, useState } from 'react'
import { getHistory } from '../lib/storage.js'
import { aiAvailable, detectBackend } from '../lib/ai.js'

export default function Home({ go }) {
  const history = getHistory().slice(0, 6)
  const [backend, setBackend] = useState(false)
  useEffect(() => { detectBackend().then(b => setBackend(!!b)) }, [])
  return (
    <div className="mx-auto w-full max-w-3xl pb-16">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="./icon.svg" alt="" className="h-12 w-12 rounded-2xl" />
          <div>
            <h1 className="text-2xl font-black">DET Practice</h1>
            <p className="text-sm font-bold text-neutral-400">Offline Duolingo English Test trainer · 2026 format</p>
          </div>
        </div>
        <button className="btn-ghost !px-4 !py-2" onClick={() => go({ name: 'settings' })}>⚙️ Settings</button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <button onClick={() => go({ name: 'lobby' })}
          className="card cursor-pointer text-left transition hover:-translate-y-0.5 hover:shadow-lg">
          <div className="text-4xl">🏁</div>
          <h2 className="mt-2 text-xl font-black">Full Timed Exam</h2>
          <p className="mt-1 text-sm font-semibold text-neutral-500">
            The complete ~60 minute mock test: all thirteen question types with real timing, auto-advance, and no going back. Fifty distinct exams.
          </p>
        </button>
        <button onClick={() => go({ name: 'practice-menu' })}
          className="card cursor-pointer text-left transition hover:-translate-y-0.5 hover:shadow-lg">
          <div className="text-4xl">🎯</div>
          <h2 className="mt-2 text-xl font-black">Section Practice</h2>
          <p className="mt-1 text-sm font-semibold text-neutral-500">
            Drill one skill or one question type. Timed or untimed, with correct answers shown immediately.
          </p>
        </button>
      </div>

      <div className={`mt-4 rounded-2xl px-4 py-3 text-sm font-bold ${backend || aiAvailable() ? 'bg-[#d7ffb8] text-[#3f8f00]' : 'bg-neutral-100 text-neutral-500'}`}>
        {backend
          ? '✨ AI marking is ON via your Claude subscription (local backend) — writing & speaking grade with one click.'
          : aiAvailable()
          ? '✨ AI marking is ON via your API key — writing & speaking get Claude feedback.'
          : '📴 Offline mode — writing & speaking use bundled model answers + self-scoring. Run “npm run serve” to grade with your Claude subscription, or add an API key in Settings.'}
      </div>

      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-black">Recent results</h2>
          <p className="mb-2 text-sm font-semibold text-neutral-400">Tap a result to review every question, your answers, and what was wrong.</p>
          <div className="space-y-2">
            {history.map(h => {
              const openable = Array.isArray(h.items) && h.items.length > 0
              return (
                <button
                  key={h.id || h.date}
                  disabled={!openable}
                  onClick={() => openable && go({ name: 'review', history: h })}
                  className={`card flex w-full items-center justify-between !p-4 text-left transition
                    ${openable ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : 'opacity-70'}`}
                >
                  <div>
                    <div className="font-extrabold">{h.title}</div>
                    <div className="text-xs font-bold text-neutral-400">
                      {new Date(h.date).toLocaleString()}{openable ? '' : ' · summary only'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {h.marks?.possible > 0 && (
                      <span className="hidden rounded-lg bg-[#fff3c4] px-2 py-0.5 text-xs font-black text-amber-600 sm:inline">🏅 {h.marks.earned}/{h.marks.possible}</span>
                    )}
                    {h.subscores && Object.entries(h.subscores).map(([k, v]) => v != null && (
                      <span key={k} className="hidden text-xs font-bold text-neutral-400 md:inline">{k[0].toUpperCase()}{k.slice(1, 4)} {v}</span>
                    ))}
                    <span className="rounded-xl bg-[#58cc02] px-3 py-1 text-lg font-black text-white">{h.overall ?? '—'}</span>
                    {openable && <span className="text-neutral-300">›</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
