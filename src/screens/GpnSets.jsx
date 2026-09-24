import React, { useState } from 'react'
import { assembleGpnPractice, gpnSection, gpnQuestions, gpnModels } from '../lib/gpnPractice.js'
import { getHistory } from '../lib/storage.js'

export default function GpnSets({ go, type, timed }) {
  const section = gpnSection(type)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [followUp, setFollowUp] = useState(0)
  const done = new Set(getHistory().map(h => h.title))
  const questions = gpnQuestions(type).filter(q => `${q.number} ${q.topic || ''}`.toLowerCase().includes(search.toLowerCase()))
  const pages = Math.ceil(questions.length / 50)
  const models = gpnModels(type)
  return (
    <div className="mx-auto w-full max-w-3xl pb-16">
      <button className="mb-4 text-sm font-extrabold text-neutral-400" onClick={() => go({ name: 'gpn-lobby', timed })}>← GPN sections</button>
      <div className="card">
        <p className="text-xs font-extrabold uppercase tracking-widest text-[#1899d6]">GPN DET Sample · booklet p. {section.page}</p>
        <h1 className="mt-2 text-2xl font-black">{section.label}</h1>
        <p className="mt-2 text-sm font-semibold text-neutral-500">All {section.count} numbered samples, in the PDF’s order. {timed ? 'Timers are on.' : 'Take as long as you need.'} Answers and feedback appear after each question.</p>
        {type === 'interactive_listening' && <p className="mt-2 text-sm text-neutral-500">Four-minute conversations, then a 75-second summary. Partner dialogue uses device speech; the booklet supplies text for this section.</p>}
        {['listen_type', 'listen_then_speak'].includes(type) && <p className="mt-2 text-sm text-neutral-500">Original QR recordings are included for offline listening.</p>}
        {type === 'interactive_reading' && <p className="mt-2 text-sm text-neutral-500">Six linked tasks per passage, including the missing-sentence task. Eight minutes per passage, within the booklet’s 7–8 minute range.</p>}
        {type === 'interactive_writing' && <label className="my-4 block font-bold">Practice follow-up
          <select className="ml-3 rounded-lg border-2 p-2" value={followUp} onChange={e => setFollowUp(Number(e.target.value))}>{[0,1,2].map(n => <option key={n} value={n}>Follow-up {n + 1}</option>)}</select>
          <p className="mt-2 text-xs font-medium text-neutral-500">Every question includes all three printed follow-ups. Choose one for each attempt.</p>
        </label>}
        <input aria-label="Find question number or title" className="mt-4 w-full rounded-xl border-2 p-3" placeholder="Find a question number or title…" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} />
        <div className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {questions.slice(page * 50, (page + 1) * 50).map(q => {
            const practice = assembleGpnPractice(type, q.number, followUp)
            const completed = done.has(practice.title)
            return <button key={q.number} className={`rounded-xl border-2 p-3 text-left ${completed ? 'border-[#58cc02] bg-[#efffe3]' : 'border-neutral-200 hover:border-[#1cb0f6]'}`} onClick={() => go({ name: 'gpn-practice', type, timed, setNo: q.number, ...practice })}>
              <div className="font-black">Question {q.number}{completed ? ' ✓' : ''}</div>
              {q.topic && <div className="mt-1 text-xs font-semibold text-neutral-500">{q.topic}</div>}
            </button>
          })}
        </div>
        {pages > 1 && <div className="flex items-center justify-between"><button className="btn-ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button><span>{page + 1} / {pages}</span><button className="btn-ghost" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>Next page</button></div>}
        {models.map(m => <details key={m.section} className="my-4 rounded-xl bg-amber-50 p-4"><summary className="cursor-pointer font-bold">Booklet scored sample answer</summary><p className="mt-2 text-xs">This is the booklet’s worked example for this section. It is not an answer key for every prompt.</p>{m.photo && <img className="my-3 max-h-64 rounded-lg" src={`./${m.photo}`} alt="Photo for the booklet’s scored example" />}{m.audio && <audio className="my-3 w-full" controls preload="none" src={`./${m.audio}`} />}<p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{m.text}</p></details>)}
        <button className="btn-ghost mt-3" onClick={() => go({ name: 'gpn-booklet', type, timed })}>View instructions and examples in the PDF</button>
      </div>
    </div>
  )
}
