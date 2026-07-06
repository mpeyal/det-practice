import React, { useEffect, useMemo, useRef, useState } from 'react'
import { QuestionCard, Choices } from '../components/ui.jsx'
import { useCountdown, useLatest } from '../lib/hooks.js'

/**
 * Interactive Reading — one passage with linked tasks under a single timer,
 * matching the real DET, and RESPONSIVE like it:
 *   - Wide screens: two-panel "complete the passage" (numbered gaps in the
 *     passage on the left, a list of dropdowns on the right).
 *   - Narrow screens: single column with the dropdowns inline in the passage.
 * Then: highlight the answer (x2), main idea, best title.
 *
 * The dropdown is a custom popup (not a native <select>) so it looks and
 * behaves the same inline or in the side list, on any screen.
 */

/** True when the viewport is at least `px` wide (live-updating). */
function useIsWide(px = 768) {
  const [wide, setWide] = useState(typeof window === 'undefined' ? true : window.innerWidth >= px)
  useEffect(() => {
    const mq = window.matchMedia(`(min-width:${px}px)`)
    const h = e => setWide(e.matches)
    setWide(mq.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [px])
  return wide
}

function NumBadge({ n, done }) {
  return (
    <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs font-black
      ${done ? 'bg-[#58cc02] text-white' : 'bg-neutral-200 text-neutral-500'}`}>{n}</span>
  )
}

/** Custom gap dropdown: a button + popup list of word options. */
function GapDropdown({ n, value, options, onChange, block = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <span ref={ref} className={`relative ${block ? 'block' : 'inline-block'} align-middle`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2 font-bold transition
          ${block ? 'w-full' : 'mx-0.5 min-w-[140px]'}
          ${value ? 'border-[#1cb0f6] bg-[#ddf4ff] text-[#1899d6]' : 'border-neutral-200 bg-white text-neutral-400'}`}
      >
        <NumBadge n={n} done={!!value} />
        <span className="flex-1 text-left">{value || 'Select a word'}</span>
        <span className="text-neutral-400">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className={`absolute left-0 top-full z-30 mt-1 overflow-hidden rounded-2xl border-2 border-neutral-200 bg-white shadow-lg
          ${block ? 'w-full' : 'min-w-[180px]'}`}>
          {options.map(o => (
            <button
              key={o}
              type="button"
              onClick={() => { onChange(o === value ? '' : o); setOpen(false) }}
              className={`block w-full px-4 py-2.5 text-left font-bold transition hover:bg-[#f3fbff]
                ${o === value ? 'text-[#1899d6]' : 'text-neutral-700'}`}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </span>
  )
}

export default function InteractiveReading({ item, timed, onComplete }) {
  const p = item.payload
  const wide = useIsWide()
  const passageText = p.passage || `${p.paragraph1 || ''} ${p.paragraph2 || ''}`.trim()
  const nBlanks = p.blanks.length

  const steps = ['blanks', 'hl0', 'hl1', 'mainIdea', 'title']
  const [step, setStep] = useState(0)
  const [state, setState] = useState({ blanks: Array(nBlanks).fill(''), highlights: ['', ''], mainIdea: '', title: '' })
  const latest = useLatest(state)
  const passageRef = useRef(null)

  const submit = () => onComplete(latest.current)
  const [left] = useCountdown(item.timeLimit, { running: timed, onExpire: submit, resetKey: item.id })
  const next = () => (step + 1 >= steps.length ? submit() : setStep(s => s + 1))
  const setBlank = (bi, val) => setState(s => ({ ...s, blanks: s.blanks.map((x, k) => (k === bi ? val : x)) }))

  const parts = useMemo(() => passageText.split(/(\{\d+\})/), [passageText])
  const filledPassage = useMemo(
    () => passageText.replace(/\{(\d+)\}/g, (_, d) => p.blanks[Number(d) - 1]?.answer || '_____'),
    [passageText, p.blanks]
  )

  const captureSelection = (hi) => {
    const sel = window.getSelection()
    const text = sel ? sel.toString().trim() : ''
    if (!text) return
    if (passageRef.current && sel.anchorNode && !passageRef.current.contains(sel.anchorNode)) return
    setState(s => ({ ...s, highlights: s.highlights.map((x, k) => (k === hi ? text : x)) }))
  }

  const cur = steps[step]
  const hlIndex = cur === 'hl0' ? 0 : cur === 'hl1' ? 1 : null
  const filledCount = state.blanks.filter(Boolean).length

  // passage with each {n} rendered as an INLINE dropdown (narrow layout)
  const passageInline = (
    <p className="leading-loose text-[15px]">
      {parts.map((chunk, i) => {
        const m = chunk.match(/^\{(\d+)\}$/)
        if (!m) return <span key={i}>{chunk}</span>
        const bi = Number(m[1]) - 1
        return <GapDropdown key={i} n={m[1]} value={state.blanks[bi]} options={p.blanks[bi].options} onChange={v => setBlank(bi, v)} />
      })}
    </p>
  )

  // passage with each {n} rendered as a numbered badge + underline (wide layout,
  // filled words appear inline once selected on the right)
  const passageBadges = (
    <p className="leading-loose text-[15px]">
      {parts.map((chunk, i) => {
        const m = chunk.match(/^\{(\d+)\}$/)
        if (!m) return <span key={i}>{chunk}</span>
        const bi = Number(m[1]) - 1
        const val = state.blanks[bi]
        return val ? (
          <span key={i} className="mx-0.5 rounded border-b-2 border-[#1cb0f6] px-1 font-bold text-[#1899d6]">{val}</span>
        ) : (
          <span key={i} className="mx-0.5 inline-flex items-center gap-1 align-middle">
            <NumBadge n={m[1]} /> <span className="inline-block w-20 border-b-2 border-neutral-300" />
          </span>
        )
      })}
    </p>
  )

  return (
    <QuestionCard
      label={`Interactive Reading · ${
        cur === 'blanks' ? 'complete the passage' :
        hlIndex != null ? `highlight ${hlIndex + 1} of 2` :
        cur === 'mainIdea' ? 'main idea' : 'best title'}`}
      instructions={
        cur === 'blanks' ? 'Select the best option for each missing word.' :
        hlIndex != null ? 'Drag over the text in the passage that answers the question.' :
        cur === 'mainIdea' ? 'Select the main idea of the passage.' : 'Select the best title for the passage.'
      }
      seconds={timed ? left : null}
    >
      {cur === 'blanks' ? (
        wide ? (
          // WIDE: two-panel — passage (badges) left, dropdown list right
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-extrabold uppercase tracking-widest text-neutral-400">Passage</div>
              <div className="rounded-2xl bg-neutral-50 p-4">{passageBadges}</div>
            </div>
            <div>
              <div className="mb-3 text-lg font-black">Select the best option for each missing word</div>
              <div className="flex flex-col gap-2">
                {p.blanks.map((b, bi) => (
                  <GapDropdown key={bi} n={bi + 1} value={state.blanks[bi]} options={b.options} onChange={v => setBlank(bi, v)} block />
                ))}
              </div>
              <div className="mt-2 text-right text-xs font-bold text-neutral-400">{filledCount}/{nBlanks} filled</div>
            </div>
          </div>
        ) : (
          // NARROW: single column — dropdowns inline in the passage
          <div>
            <div className="mb-3 text-lg font-black">Select the best option for each missing word</div>
            {passageInline}
            <div className="mt-3 text-right text-xs font-bold text-neutral-400">{filledCount}/{nBlanks} filled</div>
          </div>
        )
      ) : (
        // highlight / main idea / title — passage + task, stacks on narrow
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-extrabold uppercase tracking-widest text-neutral-400">Passage</div>
            <div className="rounded-2xl bg-neutral-50 p-4">
              <p ref={passageRef} onMouseUp={() => hlIndex != null && captureSelection(hlIndex)} className="leading-loose text-[15px]">{filledPassage}</p>
            </div>
          </div>
          <div>
            {hlIndex != null && (
              <div>
                <div className="mb-3 font-bold">{p.highlight[hlIndex].question}</div>
                <div className="mb-2 text-xs font-extrabold uppercase text-neutral-400">Your selection</div>
                <div className="min-h-16 rounded-xl border-2 border-dashed border-neutral-300 p-3 text-sm font-medium">
                  {state.highlights[hlIndex] || <span className="text-neutral-400">Drag over text in the passage…</span>}
                </div>
                {state.highlights[hlIndex] && (
                  <button className="btn-ghost mt-2 !py-1.5 text-sm" onClick={() => setState(s => ({ ...s, highlights: s.highlights.map((x, k) => k === hlIndex ? '' : x) }))}>Clear</button>
                )}
              </div>
            )}
            {cur === 'mainIdea' && <Choices options={p.mainIdea.options} value={state.mainIdea} onChange={v => setState(s => ({ ...s, mainIdea: v }))} />}
            {cur === 'title' && <Choices options={p.title.options} value={state.title} onChange={v => setState(s => ({ ...s, title: v }))} />}
          </div>
        </div>
      )}

      <div className="mt-5 text-right">
        <button className="btn" onClick={next}>{step + 1 >= steps.length ? 'Submit' : 'Next'}</button>
      </div>
    </QuestionCard>
  )
}
