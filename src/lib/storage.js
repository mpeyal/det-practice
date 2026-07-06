// LocalStorage-backed settings + attempt history.

const SETTINGS_KEY = 'det.settings'
const HISTORY_KEY = 'det.history'

const DEFAULT_SETTINGS = {
  apiKey: '',            // Anthropic API key (can also come from VITE_ANTHROPIC_API_KEY)
  model: 'claude-sonnet-5',
  ttsRate: 1,            // default playback speed
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

export function saveAttempt(attempt) {
  const h = getHistory()
  h.unshift({ ...attempt, date: new Date().toISOString() })
  // keep the last 100 attempts
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 100)))
}

/** Insert or replace an attempt by its id (review screen updates scores live). */
export function upsertAttempt(attempt) {
  const h = getHistory().filter(a => a.id !== attempt.id)
  h.unshift({ ...attempt, date: attempt.date || new Date().toISOString() })
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 100)))
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY)
}
