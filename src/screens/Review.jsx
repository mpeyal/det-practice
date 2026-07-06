import React, { useEffect, useMemo, useRef, useState } from 'react'
import { computeResults, studySummary } from '../lib/scoring.js'
import { STUDY_TIPS } from '../lib/grading.js'
import { TYPE_LABELS } from '../lib/exam.js'
import DetailView from '../components/DetailView.jsx'
import SubjectiveReview from '../components/SubjectiveReview.jsx'
import QuestionView from '../components/QuestionView.jsx'
import { upsertAttempt, stripResponses } from '../lib/storage.js'
import { LEVEL_META, marksFor } from '../lib/difficulty.js'

function ScoreRing({ score }) {
  return (
    <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border-8 border-[#58cc02] bg-white">
      <div className="text-3xl font-black">{score ?? '—'}</div>
      <div className="text-[10px] font-extrabold uppercase text-neutral-400">est. / 160</div>
    </div>
  )
}

function SubBar({ label, score }) {
  const pct = score == null ? 0 : ((score - 10) / 150) * 100
  return (
    <div>
      <div className="flex justify-between text-sm font-extrabold">
        <span className="capitalize">{label}</span><span>{score ?? '—'}</span>
      </div>
      <div className="pbar mt-1 !h-2.5"><div style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

/**
 * Review screen shown after every exam or practice set:
 * estimated score + subscores, per-item breakdown with answers/keys/
 * explanations, AI/self grading for writing & speaking, and a
 * "What to study" summary grouped by skill theme.
 */
export default function Review({ title, items, responses, onHome, history = false, savedSubjectiveScores, savedSubjectiveResults, attemptId: savedId }) {
  const [subjectiveScores, setSubjectiveScores] = useState(savedSubjectiveScores || {})
  // full AI feedback objects per item, so history can re-show the details
  const [subjectiveResults, setSubjectiveResults] = useState(savedSubjectiveResults || {})
  const attemptId = useRef(savedId || `a_${Date.now()}_${Math.floor(Math.random() * 1e6)}`)

  const results = useMemo(
    () => computeResults(items, responses, subjectiveScores),
    [items, responses, subjectiveScores]
  )
  const weak = useMemo(() => studySummary(results.graded), [results])

  // total marks: every question is worth marks by difficulty (5/8/10);
  // unscored writing/speaking don't count toward the possible total yet
  const marks = useMemo(() => {
    let earned = 0, possible = 0
    for (const { item, grade } of results.graded) {
      if (item.isSample) continue
      const m = marksFor(item)
      if (grade.subjective) {
        const s = subjectiveScores[item.id]
        if (s == null) continue
        earned += s * m; possible += m
      } else {
        earned += grade.score * m; possible += m
      }
    }
    return { earned: Math.round(earned), possible }
  }, [results, subjectiveScores])

  // persist / live-update this attempt in history — now with the FULL items +
  // responses + grades, so "Recent results" can re-open the whole review.
  // (Skipped when we're already viewing a saved attempt from history.)
  useEffect(() => {
    if (history) return
    upsertAttempt({
      id: attemptId.current,
      title,
      overall: results.overall,
      subscores: results.subscores,
      itemCount: items.length,
      marks,
      items,
      responses: stripResponses(responses),
      subjectiveScores,
      subjectiveResults,
    })
  }, [results, title, items.length, subjectiveScores, subjectiveResults]) // eslint-disable-line

  return (
    <div className="mx-auto w-full max-w-3xl pb-16">
      {/* score header */}
      <div className="card mb-6 flex flex-col items-center gap-6 sm:flex-row">
        <ScoreRing score={results.overall} />
        <div className="w-full flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-lg font-black">{title}</div>
            {marks.possible > 0 && (
              <span className="rounded-xl bg-[#fff3c4] px-3 py-1 text-sm font-black text-amber-600">
                🏅 {marks.earned} / {marks.possible} marks
              </span>
            )}
          </div>
          {Object.entries(results.subscores).map(([k, v]) => <SubBar key={k} label={k} score={v} />)}
          <p className="text-[11px] font-semibold text-neutral-400">
            Estimated score for study purposes — the real DET uses adaptive IRT scoring. Grade your writing/speaking below to refine it.
          </p>
        </div>
      </div>

      {/* what to study */}
      {weak.length > 0 && (
        <div className="card mb-6">
          <h2 className="mb-3 text-lg font-black">📚 What to study</h2>
          <div className="space-y-3">
            {weak.map(({ tag, n }) => {
              const t = STUDY_TIPS[tag]
              if (!t) return null
              return (
                <div key={tag} className="rounded-2xl bg-neutral-50 p-3">
                  <div className="font-extrabold">{t.title} <span className="ml-1 rounded-full bg-[#ffdfe0] px-2 py-0.5 text-xs font-black text-[#d33131]">{n} miss{n > 1 ? 'es' : ''}</span></div>
                  <p className="mt-1 text-sm text-neutral-600">{t.tip}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* per-item review */}
      <h2 className="mb-3 text-lg font-black">Question review</h2>
      <div className="space-y-4">
        {results.graded.map(({ item, response, grade }, idx) => (
          <div key={item.id} className="card">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="font-extrabold">
                <span className="mr-2 text-neutral-300">#{idx + 1}</span>
                {TYPE_LABELS[item.type]}
                {item.level && LEVEL_META[item.level] && (
                  <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-black"
                    style={{ background: `${LEVEL_META[item.level].color}22`, color: LEVEL_META[item.level].color }}>
                    {LEVEL_META[item.level].icon} {LEVEL_META[item.level].label}
                  </span>
                )}
                {item.isSample && <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-black text-neutral-400">ungraded sample</span>}
              </div>
              {!grade.subjective ? (
                <span className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-black
                  ${grade.score >= 0.85 ? 'bg-[#d7ffb8] text-[#3f8f00]' : grade.score >= 0.5 ? 'bg-[#fff3c4] text-amber-600' : 'bg-[#ffdfe0] text-[#d33131]'}`}>
                  {Math.round(grade.score * marksFor(item))}/{marksFor(item)} · {Math.round(grade.score * 100)}%
                </span>
              ) : subjectiveScores[item.id] != null && !item.isSample ? (
                <span className="whitespace-nowrap rounded-full bg-[#ddf4ff] px-3 py-1 text-sm font-black text-[#1899d6]">
                  {Math.round(subjectiveScores[item.id] * marksFor(item))}/{marksFor(item)} marks
                </span>
              ) : null}
            </div>

            {/* show the actual QUESTION so the answer has context */}
            <QuestionView item={item} />

            {grade.subjective ? (
              <SubjectiveReview
                item={item}
                response={response}
                selfScore={subjectiveScores[item.id]}
                savedResult={subjectiveResults[item.id]}
                history={history}
                onScore={f => setSubjectiveScores(s => ({ ...s, [item.id]: f }))}
                onResult={r => setSubjectiveResults(s => ({ ...s, [item.id]: r }))}
              />
            ) : (
              <>
                <DetailView item={item} grade={grade} />
                {grade.explanation && <p className="mt-2 text-sm text-neutral-500">{grade.explanation}</p>}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <button className="btn" onClick={onHome}>Done — back to home</button>
      </div>
    </div>
  )
}
