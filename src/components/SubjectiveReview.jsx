import React, { useEffect, useRef, useState } from 'react'
import { aiAvailable, aiGrade, backendGrade, detectBackend, buildGradingPrompt, parseGradeReply, gradeQueued, SELF_RUBRIC } from '../lib/ai.js'
import { TYPE_LABELS } from '../lib/exam.js'

/** Build the prompt/response/model strings for a subjective item. */
export function subjectiveInfo(item, response) {
  const p = item.payload
  const r = response || {}
  switch (item.type) {
    case 'write_photo':
      return { kind: 'writing', prompt: `Describe this photo: ${p.photo.alt}`, response: r.text || '', models: [p.photo.modelWritten], audio: [] }
    case 'interactive_writing':
      return {
        kind: 'writing',
        prompt: `${p.prompt}\nFollow-up: ${p.followUp}`,
        response: `Part 1: ${r.part1 || ''}\n\nPart 2 (follow-up): ${r.part2 || ''}`,
        models: [p.model, p.modelFollowUp], audio: [],
      }
    case 'writing_sample':
      return { kind: 'writing', prompt: p.prompt, response: r.text || '', models: [p.model], audio: [] }
    case 'speak_photo':
      return { kind: 'speaking', prompt: `Describe this photo aloud: ${p.photo.alt}`, response: r.transcript || '', models: [p.photo.modelSpoken], audio: r.url ? [r.url] : [] }
    case 'read_then_speak':
    case 'speaking_sample':
      return { kind: 'speaking', prompt: p.prompt, response: r.transcript || '', models: [p.model], audio: r.url ? [r.url] : [] }
    case 'interactive_speaking': {
      const answers = r.answers || []
      return {
        kind: 'speaking',
        prompt: p.questions.map((q, i) => `Q${i + 1}: ${q}`).join('\n'),
        response: answers.map((a, i) => `A${i + 1}: ${a?.transcript || '(no transcript)'}`).join('\n'),
        models: p.questions.map((q, i) => `Q${i + 1}: ${q}\nModel: ${p.models[i]}`),
        audio: answers.filter(a => a?.url).map(a => a.url),
      }
    }
    default:
      return { kind: 'writing', prompt: '', response: '', models: [], audio: [] }
  }
}

const BANDS = [
  { label: '130–160', frac: 0.95 },
  { label: '100–125', frac: 0.72 },
  { label: '70–95', frac: 0.48 },
  { label: '10–65', frac: 0.2 },
]

/**
 * Review card for a writing/speaking response:
 * AI marking when online + key configured; otherwise (and always, as a
 * baseline) the bundled model answer + rubric with self-scoring.
 */
export default function SubjectiveReview({ item, response, selfScore, savedResult, onScore, onResult, history = false }) {
  const info = subjectiveInfo(item, response)
  const [ai, setAi] = useState(savedResult || null)
  const [aiState, setAiState] = useState(savedResult ? 'done' : 'idle') // idle | loading | done | error
  const [aiError, setAiError] = useState('')
  const [showModel, setShowModel] = useState(false)
  // manual grading via a Claude subscription (copy prompt → claude.ai → paste reply)
  const [subOpen, setSubOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pasted, setPasted] = useState('')
  const [pasteError, setPasteError] = useState('')
  // local Claude-subscription backend (server/server.mjs)? probe once
  const [backend, setBackend] = useState(undefined)
  const autoTried = useRef(false)
  useEffect(() => { detectBackend().then(setBackend) }, [])

  const applyGrade = (res) => { setAi(res); setAiState('done'); onScore && onScore(res.frac); onResult && onResult(res) }

  const gradeArgs = () => ({ kind: info.kind, taskLabel: TYPE_LABELS[item.type], prompt: info.prompt, response: info.response })

  const runAi = async () => {
    setAiState('loading')
    try { applyGrade(await gradeQueued(() => aiGrade(gradeArgs()))) }
    catch (e) { setAiState('error'); setAiError(String(e.message || e)) }
  }

  // one-click agentic grading via the local subscription backend
  const runBackend = async () => {
    setAiState('loading')
    try { applyGrade(await gradeQueued(() => backendGrade(gradeArgs()))) }
    catch (e) { setAiState('error'); setAiError(String(e.message || e)) }
  }

  // AUTO-GRADE the moment AI is connected — no button, no copy/paste.
  // (Skipped in history mode, when re-opening a past attempt, and for empty
  // responses.)
  useEffect(() => {
    if (history || autoTried.current || backend === undefined) return
    if (aiState !== 'idle' || !info.response.trim()) return
    if (backend) { autoTried.current = true; runBackend() }
    else if (aiAvailable()) { autoTried.current = true; runAi() }
  }, [backend, history]) // eslint-disable-line

  const copyPrompt = async () => {
    const text = buildGradingPrompt({ kind: info.kind, taskLabel: TYPE_LABELS[item.type], prompt: info.prompt, response: info.response })
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // clipboard API can be blocked — fall back to a temporary textarea
      const ta = document.createElement('textarea')
      ta.value = text; document.body.appendChild(ta); ta.select()
      document.execCommand('copy'); document.body.removeChild(ta)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const readPastedReply = () => {
    try {
      const res = parseGradeReply(pasted)
      setAi(res)
      setAiState('done')
      setPasteError('')
      onScore && onScore(res.frac)
    } catch (e) {
      setPasteError(String(e.message || e))
    }
  }

  return (
    <div className="space-y-3">
      {/* my response */}
      <div>
        <div className="text-xs font-extrabold uppercase text-neutral-400">Your response</div>
        {info.audio.map((u, i) => <audio key={i} controls src={u} className="my-1 h-9 w-full max-w-sm" />)}
        <div className="whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 text-sm font-medium">{info.response || '(empty)'}</div>
      </div>

      {/* AI marking — automatic when AI is connected (backend or API key) */}
      {aiState === 'done' && ai ? (
        <div className="rounded-2xl border-2 border-[#bde8ff] bg-[#f3fbff] p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#1cb0f6] px-3 py-1 text-xl font-black text-white">{ai.score10to160}</div>
            <div className="font-bold">AI grade · CEFR {ai.cefr}</div>
          </div>
          <p className="mt-2 text-sm font-semibold">{ai.summary}</p>
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            <div><b>Task fulfillment:</b> {ai.feedback.taskFulfillment}</div>
            <div><b>Coherence:</b> {ai.feedback.coherence}</div>
            <div><b>Vocabulary:</b> {ai.feedback.vocabulary}</div>
            <div><b>Grammar:</b> {ai.feedback.grammar}</div>
          </div>
          {ai.improved && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-extrabold text-[#1899d6]">Improved version</summary>
              <p className="mt-1 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm">{ai.improved}</p>
            </details>
          )}
        </div>
      ) : aiState === 'loading' ? (
        <div className="flex items-center gap-2 rounded-2xl border-2 border-[#bde8ff] bg-[#f3fbff] p-4 text-sm font-extrabold text-[#1899d6]">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#bde8ff] border-t-[#1cb0f6]" />
          Grading with Claude…
        </div>
      ) : aiState === 'error' ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-red-50 p-3">
          <span className="text-xs font-bold text-red-500">AI grading failed: {aiError}</span>
          <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => (backend ? runBackend() : runAi())}>Retry</button>
        </div>
      ) : !history && !backend && !aiAvailable() ? (
        // No AI connected — offer the manual copy/paste bridge + self-score
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-xl bg-neutral-100 px-3 py-2 text-xs font-bold text-neutral-500">
              No AI connected — connect your Claude subscription in ⚙️ Settings → AI Account, or self-score below.
            </span>
            <button className="btn-ghost !px-3 !py-2 text-xs" onClick={() => setSubOpen(v => !v)}>
              {subOpen ? '▾' : '▸'} 💬 Grade by copy/paste
            </button>
          </div>
          {subOpen && (
            <div className="mt-3 space-y-2 rounded-2xl border-2 border-[#e5e5e5] p-3">
              <p className="text-xs font-semibold text-neutral-500">
                Copy the grading prompt, paste it into claude.ai, then paste Claude's reply back — three steps, ~30 seconds:
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={copyPrompt}>
                  {copied ? '✓ Copied!' : '1️⃣ 📋 Copy grading prompt'}
                </button>
                <a className="btn-ghost !px-3 !py-1.5 text-xs" href="https://claude.ai/new" target="_blank" rel="noreferrer">
                  2️⃣ Open claude.ai & paste it ↗
                </a>
              </div>
              <div>
                <div className="mb-1 text-xs font-extrabold uppercase text-neutral-400">3️⃣ Paste Claude's reply here</div>
                <textarea
                  className="min-h-20 w-full rounded-xl border-2 border-neutral-200 p-2 font-mono text-xs focus:border-[#1cb0f6] focus:outline-none"
                  placeholder='{"score": 115, "cefr": "B2", …}'
                  value={pasted}
                  onChange={e => setPasted(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <button className="btn !py-1.5 !px-4 text-xs" disabled={!pasted.trim()} onClick={readPastedReply}>Read the grade</button>
                  {pasteError && <span className="text-xs font-bold text-red-500">{pasteError}</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* offline fallback: model answer + rubric + self-score */}
      <div className="rounded-2xl bg-[#fffbe8] p-4">
        <button className="text-sm font-extrabold text-amber-700 cursor-pointer" onClick={() => setShowModel(v => !v)}>
          {showModel ? '▾' : '▸'} Sample model answer (offline — not an AI grade)
        </button>
        {showModel && (
          <div className="mt-2 space-y-2">
            {info.models.map((m, i) => <p key={i} className="whitespace-pre-wrap rounded-xl bg-white p-3 text-sm">{m}</p>)}
            <div className="mt-2 text-xs font-extrabold uppercase text-neutral-400">Self-scoring rubric</div>
            {SELF_RUBRIC.map(r => <p key={r.band} className="text-xs"><b>{r.band}:</b> {r.desc}</p>)}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-extrabold uppercase text-neutral-400">Self-score:</span>
          {BANDS.map(b => (
            <button key={b.label}
              onClick={() => onScore && onScore(b.frac)}
              className={`rounded-lg px-2.5 py-1 text-xs font-black cursor-pointer
                ${selfScore === b.frac ? 'bg-[#58cc02] text-white' : 'bg-white text-neutral-500 border border-neutral-200 hover:bg-neutral-50'}`}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
