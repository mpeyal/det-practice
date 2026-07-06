import React, { useEffect, useState } from 'react'
import { getAccount, accountAction } from '../lib/ai.js'

/**
 * AI Account dialog (like NeuroVAT's "Claude account" panel).
 * Only works when the app is served by server/server.mjs — it drives the
 * local `claude`/`codex` CLIs so you can switch account, log in a new user,
 * apply a per-app credential override, or switch to a ChatGPT (codex) backend.
 */
export default function AccountDialog({ onClose }) {
  const [st, setSt] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ovKind, setOvKind] = useState('api_key')
  const [ovValue, setOvValue] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [cliPath, setCliPath] = useState('')

  const refresh = async () => {
    setError('')
    try { setSt(await getAccount()) }
    catch (e) { setError('No local backend. Run “npm run serve” to manage accounts. (' + e.message + ')') }
  }
  useEffect(() => { refresh() }, [])

  const [note, setNote] = useState('')
  const act = async (action, body) => {
    setBusy(true); setError(''); setNote('')
    try {
      const j = await accountAction(action, body)
      if (j.message) setNote(j.message)
      // login/logout return only { ok, message } (they just launch the
      // browser) — don't overwrite the account status with that, re-fetch it
      if (j.providers) setSt(j)
      else await refresh()
    } catch (e) { setError(String(e.message || e)) }
    finally { setBusy(false) }
  }

  const acc = st?.account
  const provClaude = st?.providers?.claude
  const provOpenai = st?.providers?.openai

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-black">🤖 AI Account</h2>
          <button className="text-2xl font-black text-neutral-300 hover:text-neutral-500 cursor-pointer" onClick={onClose}>✕</button>
        </div>

        {error && <div className="mb-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">{error}</div>}
        {note && <div className="mb-3 rounded-xl bg-[#ddf4ff] p-3 text-sm font-semibold text-[#1899d6]">{note} <button className="ml-1 underline" onClick={refresh}>Refresh</button></div>}

        {!st ? (
          <p className="text-sm font-semibold text-neutral-500">Loading… (needs the local backend — run “npm run serve”)</p>
        ) : (
          <div className="space-y-5">
            {/* provider switch */}
            <div>
              <div className="mb-1 text-xs font-extrabold uppercase tracking-wide text-neutral-400">Grading provider</div>
              <div className="flex gap-2">
                <button
                  className={`flex-1 rounded-xl border-2 px-3 py-2 text-sm font-black cursor-pointer ${st.provider === 'claude' ? 'border-[#58cc02] bg-[#d7ffb8] text-[#3f8f00]' : 'border-neutral-200 bg-white text-neutral-500'}`}
                  onClick={() => act('provider', { provider: 'claude' })} disabled={busy}>
                  Claude {provClaude?.available ? '' : '(no CLI)'}
                </button>
                <button
                  className={`flex-1 rounded-xl border-2 px-3 py-2 text-sm font-black cursor-pointer ${st.provider === 'openai' ? 'border-[#10a37f] bg-[#d7f7ee] text-[#0b7a5e]' : 'border-neutral-200 bg-white text-neutral-500'}`}
                  onClick={() => act('provider', { provider: 'openai' })} disabled={busy}>
                  ChatGPT {provOpenai?.available ? '' : '(no CLI)'}
                </button>
              </div>
              {st.provider === 'openai' && !provOpenai?.available && (
                <p className="mt-1 text-xs font-bold text-amber-700">
                  ChatGPT grading needs OpenAI's codex CLI: <code>npm i -g @openai/codex</code> then <code>codex login</code> with your ChatGPT subscription. Restart the backend after.
                </p>
              )}
            </div>

            {/* Claude CLI not found → let the user point us at it manually */}
            {st.provider === 'claude' && !provClaude?.available && (
              <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-3">
                <div className="text-sm font-black text-amber-800">Claude CLI not found automatically</div>
                <p className="mt-1 text-xs font-semibold text-amber-700">
                  On a Mac the app can’t always see your install. In a <b>Terminal</b> run <code className="rounded bg-white/70 px-1">which claude</code>, copy the path it prints, and paste it here:
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-xl border-2 border-neutral-200 p-2 font-mono text-xs"
                    placeholder="/opt/homebrew/bin/claude"
                    value={cliPath}
                    onChange={e => setCliPath(e.target.value)}
                  />
                  <button className="btn !px-3 !py-1.5 text-xs" disabled={busy || !cliPath.trim()} onClick={() => act('claude-path', { path: cliPath })}>Use this path</button>
                </div>
                {st.claudePath && <p className="mt-1 text-xs font-bold text-red-500">Saved path didn’t work: {st.claudePath}</p>}
                <p className="mt-1 text-xs font-semibold text-amber-700">
                  Not installed yet? <code className="rounded bg-white/70 px-1">npm i -g @anthropic-ai/claude-code</code> then <code className="rounded bg-white/70 px-1">claude login</code>.
                </p>
              </div>
            )}

            {/* signed-in account (Claude) */}
            {st.provider === 'claude' && (
              <div className="rounded-2xl bg-neutral-50 p-3">
                {acc?.loggedIn ? (
                  <div className="text-sm">
                    <div className="font-black text-[#3f8f00]">[signed in] {acc.subscriptionType ? `Claude ${acc.subscriptionType[0].toUpperCase()}${acc.subscriptionType.slice(1)} account` : acc.authMethod}</div>
                    {acc.email && <div className="font-semibold text-neutral-600">{acc.email}</div>}
                    {acc.orgName && <div className="text-neutral-400">{acc.orgName}</div>}
                    {st.override && <div className="mt-1 font-bold text-[#1899d6]">App override active: {st.override.kind} (…{st.override.tail})</div>}
                  </div>
                ) : (
                  <div className="text-sm font-bold text-neutral-500">Not signed in to Claude.</div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={refresh} disabled={busy}>↻ Refresh</button>
                  <button className="btn !px-3 !py-1.5 text-xs" onClick={() => act('login')} disabled={busy}>Log in / switch (browser)</button>
                  <button className="btn-ghost !px-3 !py-1.5 text-xs !text-red-400" onClick={() => act('logout')} disabled={busy}>Log out</button>
                </div>
              </div>
            )}

            {/* per-app override (Claude) */}
            {st.provider === 'claude' && (
              <div>
                <div className="mb-1 text-xs font-extrabold uppercase tracking-wide text-neutral-400">Run this app under a specific account (this app only)</div>
                <div className="flex flex-wrap gap-2">
                  <select className="rounded-xl border-2 border-neutral-200 p-2 text-sm font-semibold" value={ovKind} onChange={e => setOvKind(e.target.value)}>
                    <option value="api_key">API key</option>
                    <option value="oauth">OAuth token</option>
                  </select>
                  <input className="min-w-0 flex-1 rounded-xl border-2 border-neutral-200 p-2 font-mono text-xs" placeholder={ovKind === 'api_key' ? 'sk-ant-…' : 'token from `claude setup-token`'} value={ovValue} onChange={e => setOvValue(e.target.value)} />
                </div>
                <div className="mt-2 flex gap-2">
                  <button className="btn !px-3 !py-1.5 text-xs" onClick={() => act('override', { kind: ovKind, value: ovValue })} disabled={busy}>Apply</button>
                  <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => { setOvValue(''); act('override', { value: '' }) }} disabled={busy}>Clear override</button>
                </div>
                <p className="mt-1 text-xs font-semibold text-neutral-400">Overrides the login for THIS app only; your global Claude Code login is untouched. Nothing is written to disk — it lives only in the running backend.</p>
              </div>
            )}

            {/* OpenAI key */}
            {st.provider === 'openai' && (
              <div>
                <div className="mb-1 text-xs font-extrabold uppercase tracking-wide text-neutral-400">OpenAI API key (optional — codex login is used otherwise)</div>
                <div className="flex gap-2">
                  <input className="min-w-0 flex-1 rounded-xl border-2 border-neutral-200 p-2 font-mono text-xs" placeholder="sk-…" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} />
                  <button className="btn !px-3 !py-1.5 text-xs" onClick={() => act('openai-key', { value: openaiKey })} disabled={busy}>Apply</button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 text-right">
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
