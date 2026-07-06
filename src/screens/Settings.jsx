import React, { useEffect, useRef, useState } from 'react'
import { getSettings, saveSettings, clearHistory } from '../lib/storage.js'
import { cachedModels, KNOWN_MODELS, detectBackend } from '../lib/ai.js'
import { englishVoices, scoreVoice, guessGender, pickVoice, speak, stopSpeaking, ttsSupported } from '../lib/tts.js'
import AccountDialog from '../components/AccountDialog.jsx'

/* ---------- speaker + microphone sound check ---------- */

function SoundCheck() {
  const [speaking, setSpeaking] = useState(false)
  const [mic, setMic] = useState('idle') // idle | testing | ok | error
  const [micMsg, setMicMsg] = useState('')
  const [level, setLevel] = useState(0)
  const streamRef = useRef(null), ctxRef = useRef(null), rafRef = useRef(null)

  const stopMic = () => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    ctxRef.current?.close?.().catch(() => {})
    streamRef.current = null; ctxRef.current = null
  }
  useEffect(() => () => { stopMic(); stopSpeaking() }, [])

  const testSpeaker = async () => {
    if (!ttsSupported()) return
    setSpeaking(true)
    await speak('This is the voice you will hear during the listening questions. If you can hear this clearly, your speaker is working.',
      { rate: getSettings().ttsRate, voice: pickVoice() })
    setSpeaking(false)
  }

  const testMic = async () => {
    setMicMsg(''); stopMic()
    if (!navigator.mediaDevices?.getUserMedia) { setMic('error'); setMicMsg('This browser has no microphone support.'); return }
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setMic('error'); setMicMsg('The mic needs a secure page — use the desktop app or open the app at http://localhost (not a file:// page).'); return
    }
    setMic('testing')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const Ctx = window.AudioContext || window.webkitAudioContext
      const ctx = new Ctx(); ctxRef.current = ctx
      const analyser = ctx.createAnalyser(); analyser.fftSize = 256
      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      setMic('ok')
      const loop = () => {
        analyser.getByteTimeDomainData(data)
        let peak = 0
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128))
        setLevel(Math.min(1, peak / 60))
        rafRef.current = requestAnimationFrame(loop)
      }
      loop()
    } catch (e) {
      setMic('error')
      const n = e?.name
      setMicMsg(
        n === 'NotAllowedError' || n === 'SecurityError' ? 'Microphone blocked. Click the camera/lock icon in the address bar → Allow, then test again. (The embedded preview panel can’t grant the mic — open the app in a real browser tab or the desktop app.)' :
        n === 'NotFoundError' ? 'No microphone was found on this device.' :
        n === 'NotReadableError' ? 'The microphone is being used by another app. Close it and try again.' :
        'Could not access the microphone.')
    }
  }

  const SpeakerIcon = (props) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5.5a9 9 0 0 1 0 13" />
    </svg>
  )
  const MicIcon = (props) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v4" /><path d="M8 21h8" />
    </svg>
  )

  return (
    <div>
      <h2 className="font-black">Speaker &amp; microphone</h2>
      <p className="mt-1 text-sm font-semibold text-neutral-500">
        Check your audio before an exam — the speaker plays the listening questions, the microphone records the speaking tasks.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {/* speaker tile */}
        <div className="rounded-2xl border-2 border-[#e8e8e6] p-4">
          <div className="flex items-center gap-2 text-[#1cb0f6]"><SpeakerIcon /><span className="font-black text-neutral-700">Speaker</span></div>
          <p className="mt-1 text-xs font-semibold text-neutral-400">Plays the listening questions.</p>
          <button className="btn btn-blue mt-3 w-full !py-2.5 text-sm" disabled={speaking} onClick={testSpeaker}>
            {speaking ? 'Playing…' : 'Test speaker'}
          </button>
          {!ttsSupported() && <p className="mt-1 text-xs font-bold text-amber-700">No speech synthesis in this browser.</p>}
        </div>

        {/* microphone tile */}
        <div className="rounded-2xl border-2 border-[#e8e8e6] p-4">
          <div className="flex items-center gap-2 text-[#1cb0f6]"><MicIcon /><span className="font-black text-neutral-700">Microphone</span></div>
          <p className="mt-1 text-xs font-semibold text-neutral-400">Records the speaking tasks.</p>
          {mic === 'ok' ? (
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-neutral-200">
                  <div className="h-full rounded-full transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%`, background: level > 0.05 ? '#58cc02' : '#d1d5db' }} />
                </div>
                <span className="whitespace-nowrap text-xs font-black text-[#3f8f00]">{level > 0.05 ? 'Hearing you ✓' : 'Speak…'}</span>
              </div>
              <button className="btn-ghost mt-2 w-full !py-2 text-sm" onClick={() => { stopMic(); setMic('idle'); setLevel(0) }}>Stop test</button>
            </div>
          ) : (
            <button className="btn btn-blue mt-3 w-full !py-2.5 text-sm" disabled={mic === 'testing'} onClick={testMic}>
              {mic === 'testing' ? 'Starting…' : 'Test microphone'}
            </button>
          )}
          {mic === 'error' && <p className="mt-2 text-xs font-bold text-red-500">{micMsg}</p>}
        </div>
      </div>
    </div>
  )
}

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

        <SoundCheck />

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
