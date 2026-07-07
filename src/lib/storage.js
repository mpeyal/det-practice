// LocalStorage-backed settings + attempt history.

const SETTINGS_KEY = 'det.settings'
const HISTORY_KEY = 'det.history'

const DEFAULT_SETTINGS = {
  apiKey: '',            // Anthropic API key (can also come from VITE_ANTHROPIC_API_KEY)
  model: 'claude-sonnet-5',
  ttsRate: 1,            // default playback speed
  // 'neural' = Studio voices: pre-rendered with Piper and BUNDLED as MP3, so
  // they play instantly (realtime), sound identical on every platform, work
  // offline, and need no download. 'system' = OS/native voices (also instant).
  ttsEngine: 'neural',
  voiceFemale: '',       // pinned female voice ('' = auto best)
  voiceMale: '',         // pinned male voice ('' = auto best)
  varyVoices: true,      // rotate speakers across listening questions
}

export function getSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) }
  } catch { return { ...DEFAULT_SETTINGS } }
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  return next
}

/** Effective API key: env var (baked at build time) wins unless user set one in Settings. */
export function getApiKey() {
  const s = getSettings()
  return s.apiKey || import.meta.env.VITE_ANTHROPIC_API_KEY || ''
}

export function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [] } catch { return [] }
}

/** Object URLs (mic recordings) can't survive a reload — drop them before saving. */
export function stripResponses(responses) {
  const out = {}
  for (const [k, v] of Object.entries(responses || {})) {
    if (v && typeof v === 'object') {
      const c = { ...v }
      if (c.url) c.url = null
      if (Array.isArray(c.answers)) c.answers = c.answers.map(a => (a && a.url ? { ...a, url: null } : a))
      out[k] = c
    } else out[k] = v
  }
  return out
}

/**
 * Insert or replace an attempt by its id. Attempts now carry the full items +
 * responses + subjectiveScores so "Recent results" can re-open the whole
 * review. localStorage is bounded, so cap the count and drop the oldest
 * attempts if we hit the quota.
 */
export function upsertAttempt(attempt) {
  let h = getHistory().filter(a => a.id !== attempt.id)
  h.unshift({ ...attempt, date: attempt.date || new Date().toISOString() })
  h = h.slice(0, 40)
  while (h.length) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); return }
    catch { h.pop() } // quota exceeded — drop the oldest and retry
  }
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY)
}
