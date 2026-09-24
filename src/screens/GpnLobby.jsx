import React, { useState } from 'react'
import { GPN_SECTIONS } from '../lib/gpnPractice.js'

export default function GpnLobby({ go, timed: initialTimed = true }) {
  const [timed, setTimed] = useState(initialTimed)
  return (
    <div className="mx-auto w-full max-w-3xl pb-16">
      <button className="mb-4 cursor-pointer text-sm font-extrabold text-neutral-400" onClick={() => go({ name: 'home' })}>← Home</button>
      <div className="card mb-5">
        <div className="text-4xl">📘</div>
        <h1 className="mt-2 text-2xl font-black">GPN DET Sample</h1>
        <p className="mt-2 text-sm font-semibold text-neutral-500">All 1,080 numbered samples across the booklet’s 14 sections. Choose a section, then the original question number. Get feedback after each answer.</p>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Practice timing">
          {[true, false].map(value => <button key={String(value)} aria-pressed={timed === value} onClick={() => setTimed(value)} className={`rounded-xl border-2 px-4 py-2 font-bold ${timed === value ? 'border-[#58cc02] bg-[#efffe3] text-[#3f8f00]' : 'border-neutral-200 text-neutral-500'}`}>{value ? 'Timed practice' : 'Untimed practice'}</button>)}
        </div>
        <p className="mt-3 text-xs font-semibold text-neutral-500">Includes the booklet’s answer keys, 100 original question recordings, 80 photos, and scored sample answers. The complete PDF is included.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {GPN_SECTIONS.map((section, index) => (
          <button key={section.type} onClick={() => go({ name: 'gpn-section', type: section.type, timed })} className="card cursor-pointer text-left transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex items-center justify-between text-xs font-extrabold text-neutral-400"><span>SECTION {index + 1}</span><span>Booklet p. {section.page}</span></div>
            <h2 className="mt-2 text-lg font-black">{section.label}</h2>
            <p className="mt-2 text-sm font-bold text-[#1899d6]">{section.count ? `${section.count} numbered samples` : 'Booklet reference'}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
