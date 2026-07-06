import React, { useEffect, useState } from 'react'
import { getSettings, saveSettings, clearHistory } from '../lib/storage.js'
import { cachedModels, KNOWN_MODELS, detectBackend } from '../lib/ai.js'
import { englishVoices, scoreVoice, guessGender, speak, stopSpeaking } from '../lib/tts.js'
import AccountDialog from '../components/AccountDialog.jsx'

/* ---------- AI model picker ---------- */

function ModelPicker({ s, setS }) {
  const models = cachedModels() || KNOWN_MODELS
  // make sure the saved model is always selectable, even if not in the list
  const options = models.some(m => m.id === s.model) ? models : [{ id: s.model, label: s.model }, ...models]

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <label className="text-sm font-extrabold text-neutral-500">Model</label>
      <select
        className="min-w-0 flex-1 rounded-xl border-2 border-neutral-200 p-2.5 text-sm font-semibold focus:border-[#1cb0f6] focus:outline-none"
        value={s.model}
        onChange={e => { setS({ ...s, model: e.target.value }); saveSettings({ model: e.target.value }) }}
      >
        {options.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
    </div>
  )
}

/* ---------- voice pickers: separate female & male + variety toggle ---------- */

function VoiceSelect({ label, value, onChange, gender, voices }) {
  const auto = voices.find(v => guessGender(v) === gender) || voices[0]
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-28 text-sm font-extrabold text-neutral-500">{label}</span>
      <select
        className="min-w-0 flex-1 rounded-xl border-2 border-neutral-200 p-2.5 text-sm font-semibold focus:border-[#1cb0f6] focus:outline-none"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">Auto — {auto ? auto.name : 'none found'}</option>
        {voices.map(v => (
          <option key={v.name} value={v.name}>
            {scoreVoice(v) >= 6 ? '★ ' : ''}{v.name} ({v.lang}){guessGender(v) !== 'unknown' ? ` · ${guessGender(v)}` : ''}
          </option>
        ))}
      </select>
      <button
        className="btn-ghost !px-3 !py-2 text-sm"
        onClick={() => {
          const v = voices.find(x => x.name === value) || auto
          speak(`Hi! I am ${v ? v.name.replace(/\(.*?\)/g, '').trim() : 'your device voice'}, and I will read the listening questions for you.`, { voice: v, rate: getSettings().ttsRate })
        }}
      >🔊</button>
    </div>
  )
}

function VoiceSection({ s, setS }) {
  const [voices, setVoices] = useState(englishVoices())
  useEffect(() => {
    const refresh = () => setVoices(englishVoices())
    const t = setTimeout(refresh, 400)
    window.speechSynthesis?.addEventListener?.('voiceschanged', refresh)
    return () => { clearTimeout(t); window.speechSynthesis?.removeEventListener?.('voiceschanged', refresh); stopSpeaking() }
  }, [])

  const natural = voices.filter(v => scoreVoice(v) >= 6).length
  const set = patch => { setS({ ...s, ...patch }); saveSettings(patch) }
  const isMac = /Mac/i.test(navigator.platform || navigator.userAgent)

  return (
    <div>
      <h2 className="font-black">Listening voices</h2>
      <p className="mt-1 text-sm font-semibold text-neutral-500">
        The app keeps a pool of your best voices: dictation questions rotate between speakers, and conversations use a
        female/male pair — like the real test. Pin specific voices below, or leave on Auto.
      </p>
      <div className={`mt-2 rounded-xl px-3 py-2 text-sm font-bold ${natural > 0 ? 'bg-[#d7ffb8] text-[#3f8f00]' : 'bg-amber-50 text-amber-700'}`}>
        {natural > 0
          ? `✅ ${natural} natural-quality voice${natural > 1 ? 's' : ''} detected on this browser.`
          : isMac
            ? '⚠️ Only basic voices detected. On macOS: System Settings ▸ Accessibility ▸ Spoken Content ▸ System Voice ▸ Manage Voices… and download “Enhanced/Premium” voices (e.g. Ava, Evan, Zoe) — they then appear here in Safari and Chrome.'
            : '⚠️ Only basic voices detected. On Windows, open the app in Microsoft Edge for built-in neural “(Natural)” voices.'}
      </div>
      <div className="mt-3 space-y-2">
        <VoiceSelect label="Female voice" gender="female" voices={voices} value={s.voiceFemale} onChange={v => set({ voiceFemale: v })} />
        <VoiceSelect label="Male voice" gender="male" voices={voices} value={s.voiceMale} onChange={v => set({ voiceMale: v })} />
      </div>
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-bold text-neutral-600">
        <input type="checkbox" className="h-4 w-4 accent-[#58cc02]" checked={s.varyVoices}
          onChange={e => set({ varyVoices: e.target.checked })} />
        Vary the speaker between listening questions (recommended — like the real exam)
      </label>
    </div>
  )
}

/* ---------- main screen ---------- */

export default function Settings({ go }) {
  const [s, setS] = useState(getSettings())
  const [saved, setSaved] = useState(false)
  const [backend, setBackend] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  useEffect(() => { detectBackend().then(b => setBackend(!!b)) }, [])

  const save = () => { saveSettings(s); setSaved(true); setTimeout(() => setSaved(false), 1500) }

  return (
    <div className="mx-auto w-full max-w-2xl pb-16">
      {showAccount && <AccountDialog onClose={() => setShowAccount(false)} />}
      <button className="mb-4 text-sm font-extrabold text-neutral-400 cursor-pointer" onClick={() => go({ name: 'home' })}>← Back</button>
      <div className="card space-y-6">
        <h1 className="text-2xl font-black">⚙️ Settings</h1>

        <div className="rounded-2xl border-2 border-[#e5e5e5] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black">🤖 AI Account {backend ? <span className="ml-1 rounded-full bg-[#d7ffb8] px-2 py-0.5 text-xs text-[#3f8f00]">backend on</span> : <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-400">backend off</span>}</h2>
              <p className="mt-0.5 text-sm font-semibold text-neutral-500">
                Switch Claude account, log in a new user, apply a per-app override, or switch to a ChatGPT backend.
              </p>
            </div>
            <button className="btn !px-4 !py-2 text-sm" onClick={() => setShowAccount(true)}>Manage</button>
          </div>
          {!backend && <p className="mt-2 text-xs font-bold text-amber-700">Account switching needs the local backend — run <b>npm run serve</b> and open the app on localhost:8000.</p>}
        </div>

        <div>
          <h2 className="font-black">AI grading model</h2>
          <p className="mt-1 text-sm font-semibold text-neutral-500">
            Which Claude model grades your writing &amp; speaking. Authentication (your Claude subscription or an API-key
            override) is set above in <b>AI Account</b>. When AI is connected, grading runs automatically — no button needed.
          </p>
          <ModelPicker s={s} setS={setS} />
        </div>

        <VoiceSection s={s} setS={setS} />

        <div>
          <h2 className="font-black">Listening voice speed (default)</h2>
          <div className="mt-2 flex gap-2">
            {[0.75, 1, 1.25].map(r => (
              <button key={r} onClick={() => setS({ ...s, ttsRate: r })}
                className={`rounded-xl px-4 py-2 font-black cursor-pointer ${s.ttsRate === r ? 'bg-[#ddf4ff] text-[#1899d6]' : 'bg-neutral-100 text-neutral-400'}`}>
                {r}×
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button className="btn" onClick={save}>{saved ? '✓ Saved' : 'Save settings'}</button>
          <button className="btn-ghost text-sm !text-red-400" onClick={() => { if (confirm('Delete all saved results?')) { clearHistory(); go({ name: 'home' }) } }}>
            Clear result history
          </button>
        </div>
      </div>
    </div>
  )
}
