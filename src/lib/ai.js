// AI marking of writing/speaking via the Anthropic API — the ONLY feature
// that touches the network. Everything degrades gracefully offline: callers
// check aiAvailable() and fall back to bundled model answers + self-scoring.

import { getApiKey, getSettings } from './storage.js'

export function aiAvailable() {
  return Boolean(getApiKey()) && (typeof navigator === 'undefined' || navigator.onLine)
}

// ---- local backend (Claude Code CLI) for subscription grading ----
// When the app is served by server/server.mjs, /api/grade shells out to the
// `claude` CLI (logged in with your Claude subscription) — fully agentic
// grading with no API key. Probed once and cached.

let _backendProbe = undefined // undefined = not probed, null = none, obj = available

export async function detectBackend() {
  if (_backendProbe !== undefined) return _backendProbe
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 1500)
    const r = await fetch('/api/health', { signal: ctrl.signal })
    clearTimeout(t)
    const j = await r.json()
    _backendProbe = j && j.backend === 'claude-cli' ? j : null
  } catch {
    _backendProbe = null // not served by our backend (e.g. opened from file://)
  }
  return _backendProbe
}

/** Reset the cached backend probe (after switching provider/account). */
export function resetBackendProbe() { _backendProbe = undefined }

/** Read the backend's account/provider status (for the AI Account dialog). */
export async function getAccount() {
  const r = await fetch('/api/account')
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

/** POST an account action: login | logout | provider | override | openai-key. */
export async function accountAction(action, body = {}) {
  const r = await fetch(`/api/account/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))
  resetBackendProbe() // provider/override may have changed availability
  if (!j.ok && j.error) throw new Error(j.error)
  return j
}

/** Grade via the local Claude-subscription backend. Throws on failure. */
export async function backendGrade({ kind, taskLabel, prompt, response }) {
  const promptText = buildGradingPrompt({ kind, taskLabel, prompt, response })
  const r = await fetch('/api/grade', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: promptText, model: getSettings().model }),
  })
  const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))
  if (!j.ok) throw new Error(j.error || 'backend grading failed')
  return parseGradeReply(j.text)
}

// Fallback model choices shown before the live list is loaded.
// 'claude-sonnet-5' is the default: best quality/cost balance for grading.
export const KNOWN_MODELS = [
  { id: 'claude-sonnet-5', label: 'Sonnet 5 (default — recommended)' },
  { id: 'claude-fable-5', label: 'Fable 5 (most capable)' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (fastest/cheapest)' },
]

const MODELS_CACHE_KEY = 'det.models'

export function cachedModels() {
  try { return JSON.parse(localStorage.getItem(MODELS_CACHE_KEY)) || null } catch { return null }
}

/**
 * Fetch the models actually available to this API key (GET /v1/models) so
 * the Settings dropdown shows exactly what the user can use. Cached in
 * localStorage so the list survives offline sessions.
 */
export async function listModels() {
  const key = getApiKey()
  if (!key) throw new Error('Add an API key first')
  const res = await fetch('https://api.anthropic.com/v1/models?limit=50', {
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  const data = await res.json()
  const models = (data.data || [])
    .filter(m => m.type === 'model')
    .map(m => ({ id: m.id, label: m.display_name || m.id }))
  if (models.length) localStorage.setItem(MODELS_CACHE_KEY, JSON.stringify(models))
  return models
}

const RUBRIC = `You are an experienced Duolingo English Test (DET) examiner. Grade the candidate response on the DET 10-160 scale using this rubric:
- Task fulfillment: does it fully answer the prompt with relevant, developed content?
- Coherence & organization: logical flow, connectors, clear structure.
- Vocabulary: range, precision, appropriate register.
- Grammar: accuracy and variety of structures; errors weighted by how much they impede understanding.
For SPEAKING transcripts, ignore punctuation/casing entirely and judge spoken register; do not penalize transcription artifacts.
Length expectations: short tasks (photo, 1 min) ~40-80 words; interactive writing ~120+ words; samples ~150+ words. Heavily penalize off-topic or template-memorized answers.`

function gradingUserMessage({ kind, taskLabel, prompt, response }) {
  return `TASK TYPE: ${taskLabel} (${kind})
PROMPT SHOWN TO CANDIDATE:
${prompt}

CANDIDATE ${kind === 'speaking' ? 'SPEECH TRANSCRIPT' : 'WRITTEN RESPONSE'}:
${response || '(empty)'}

Return ONLY a JSON object, no markdown fences, with exactly these keys:
{
  "score": <integer 10-160, multiple of 5>,
  "cefr": "<A1|A2|B1|B2|C1|C2>",
  "task_fulfillment": "<2-3 sentences, specific>",
  "coherence": "<2-3 sentences, specific>",
  "vocabulary": "<2-3 sentences, name actual words/phrases to upgrade>",
  "grammar": "<2-3 sentences, quote actual errors and corrections>",
  "improved_version": "<a corrected and improved version of the response, similar length>",
  "summary": "<one-sentence overall verdict with the single highest-impact fix>"
}`
}

/**
 * Full self-contained grading prompt for MANUAL grading with a Claude
 * subscription: the user copies this into claude.ai and pastes the reply
 * back into the app (see parseGradeReply). Includes the rubric because
 * claude.ai has no separate system-prompt field.
 */
export function buildGradingPrompt(args) {
  return `${RUBRIC}\n\n${gradingUserMessage(args)}`
}

/** Parse Claude's grading reply (from the API or pasted from claude.ai). */
export function parseGradeReply(text) {
  const match = String(text).match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON found in the reply — paste Claude\'s whole answer')
  const j = JSON.parse(match[0])
  const score = Math.max(10, Math.min(160, Math.round((j.score || 10) / 5) * 5))
  return {
    score10to160: score,
    frac: (score - 10) / 150,
    cefr: j.cefr || '',
    feedback: {
      taskFulfillment: j.task_fulfillment || '',
      coherence: j.coherence || '',
      vocabulary: j.vocabulary || '',
      grammar: j.grammar || '',
    },
    improved: j.improved_version || '',
    summary: j.summary || '',
  }
}

/**
 * Grade one writing/speaking response with Claude via the API.
 * Returns { score10to160, frac (0..1), cefr, feedback: {taskFulfillment, coherence, vocabulary, grammar}, improved, summary }
 * Throws on network/API errors — callers show the offline fallback instead.
 */
export async function aiGrade({ kind, taskLabel, prompt, response }) {
  const key = getApiKey()
  if (!key) throw new Error('No API key configured')
  const { model } = getSettings()
  const userMsg = gradingUserMessage({ kind, taskLabel, prompt, response })

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      // required for calling the API directly from a browser
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      system: RUBRIC,
      messages: [{ role: 'user', content: userMsg }],
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API error ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = await res.json()
  const text = (data.content || []).map(b => b.text || '').join('')
  return parseGradeReply(text)
}

// Self-scoring rubric shown in the offline fallback.
export const SELF_RUBRIC = [
  { band: '130-160', desc: 'Fully answers every part of the prompt; well organized with clear connectors; wide, precise vocabulary; only rare minor errors.' },
  { band: '100-125', desc: 'Answers the prompt with some development; mostly organized; adequate vocabulary with some repetition; errors present but meaning always clear.' },
  { band: '70-95', desc: 'Partially answers the prompt; basic linking (and, but, because); simple/repetitive vocabulary; frequent errors that sometimes obscure meaning.' },
  { band: '10-65', desc: 'Off-topic, very short, or hard to understand; fragmentary sentences; errors dominate.' },
]
