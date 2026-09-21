import React, { useEffect, useRef, useState } from 'react'
import { QuestionCard, WordCount } from '../components/ui.jsx'
import { useCountdown, useLatest } from '../lib/hooks.js'
import { speak, stopSpeaking, conversationVoices } from '../lib/tts.js'
import { getSettings } from '../lib/storage.js'
import { LISTENING_SECONDS, SUMMARY_SECONDS } from '../lib/listening.js'

export default function InteractiveListening({ item, timed, onComplete }) {
  const conv = item.payload, questions = [conv.opener, ...conv.rounds]
  const [phase, setPhase] = useState('intro')
  const [state, setState] = useState({ comprehension: conv.comprehension.map(() => ''), opener: '', responses: conv.rounds.map(() => ''), summary: '' })
  const latest = useLatest(state)
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [playing, setPlaying] = useState(null)
  const [heard, setHeard] = useState({})
  const [audioError, setAudioError] = useState('')
  const voices = useRef(null), audioLock = useRef(false), generation = useRef(0), completed = useRef(false)
  const q = questions[step]
  const stop = () => { generation.current++; stopSpeaking(); audioLock.current = false; setPlaying(null) }
  useEffect(() => () => { generation.current++; stopSpeaking() }, [])
  const finish = () => { if (completed.current) return; completed.current = true; stop(); onComplete(latest.current) }
  const summarize = () => { stop(); setPhase('summary') }
  const [left] = useCountdown(LISTENING_SECONDS, { running: timed && ['complete','respond'].includes(phase), onExpire: summarize, resetKey: item.id })
  const [summaryLeft] = useCountdown(SUMMARY_SECONDS, { running: timed && phase === 'summary', onExpire: finish, resetKey: item.id })
  const play = async (kind) => {
    if (audioLock.current || (kind === 'turn' && heard[step])) return
    audioLock.current = true
    const token = ++generation.current
    setPlaying(kind); setAudioError('')
    voices.current ||= conversationVoices()
    try {
      const ok = await speak(kind === 'scenario' ? conv.scenario : q.audio, { rate: timed ? 1 : getSettings().ttsRate, voice: voices.current[kind === 'scenario' ? 1 : 0] })
      if (token !== generation.current) return
      if (ok === false) setAudioError('Audio could not finish. Check your speaker and try again.')
      else if (kind === 'turn') setHeard(h => ({ ...h, [step]: true }))
    } catch { if (token === generation.current) setAudioError('Audio could not play. Please try again.') }
    finally { if (token === generation.current) { audioLock.current = false; setPlaying(null) } }
  }
  const confirm = () => {
    if (!selected || !heard[step] || revealed) return
    setState(s => step === 0 ? { ...s, opener: selected } : { ...s, responses: s.responses.map((v,i) => i === step-1 ? selected : v) })
    setRevealed(true)
  }
  const next = () => { if (step === questions.length-1) summarize(); else { setStep(s => s+1); setSelected(''); setRevealed(false) } }
  return <QuestionCard label="Interactive Listening" instructions={phase === 'summary' ? 'Summarize the conversation in your own words.' : 'Listen to the scenario, complete the sentences, then participate in the conversation.'} seconds={!timed || phase === 'intro' ? null : phase === 'summary' ? summaryLeft : left}>
    {phase === 'intro' ? <div className="space-y-4">
      <p>Listen and Complete: {conv.comprehension.length} sentence blanks. Listen and Respond: {questions.length} replies.</p>
      <p>{timed ? 'You have 6 minutes 30 seconds for both parts, followed by 75 seconds to summarize.' : 'Untimed practice follows the same sequence. Choose timed practice to rehearse the test limits.'}</p>
      <p>You can replay the scenario. Each conversation turn can be played only once.</p>
      <button className="btn" onClick={() => setPhase('complete')}>Start</button>
    </div> : <>
      {phase !== 'summary' && <div className="mb-5 rounded-2xl bg-neutral-50 p-4">
        <div className="mb-2 font-bold">Scenario audio · unlimited replays</div>
        <button className="btn btn-blue !py-2" disabled={!!playing} onClick={() => play('scenario')}>{playing === 'scenario' ? 'Playing scenario…' : 'Play scenario'}</button>
      </div>}
      {audioError && <p role="alert" className="mb-3 text-red-600">{audioError}</p>}
      {phase === 'complete' && <>
        <h2 className="mb-3 font-black">Listen and Complete</h2>
        <div className="space-y-4">{conv.comprehension.map((c,i) => <label key={i} className="block rounded-xl bg-neutral-50 p-3">
          <span>{i+1}. {c.pre} </span><input aria-label={`Answer ${i+1}`} maxLength={120} className="w-44 border-b-2 border-[#1cb0f6] bg-white p-1" value={state.comprehension[i]} onChange={e => setState(s => ({...s,comprehension:s.comprehension.map((v,k) => k === i ? e.target.value : v)}))} /><span> {c.post}</span>
        </label>)}</div>
        <button className="btn mt-5" disabled={!!playing} onClick={() => setPhase('respond')}>Continue to conversation</button>
      </>}
      {phase === 'respond' && <>
        <h2 className="mb-3 font-black">Listen and Respond · {step+1} of {questions.length}</h2>
        {(step > 0 || revealed) && <div className="mb-4 space-y-2 rounded-xl bg-neutral-50 p-3" aria-label="Conversation so far">{questions.slice(0,step+(revealed ? 1 : 0)).map((turn,i) => <div key={i}><p><b>{conv.partner}:</b> {turn.audio}</p><p className="text-[#1899d6]"><b>You:</b> {turn.answer}</p></div>)}</div>}
        <button className="btn btn-blue mb-4 !py-2" disabled={!!playing || heard[step]} onClick={() => play('turn')}>{playing === 'turn' ? 'Playing…' : heard[step] ? 'Audio played' : `Listen to ${conv.partner}`}</button>
        <p className="mb-3 text-sm">Listen once, then choose the best reply.</p>
        <div className="space-y-2">{q.options.map((option,i) => <button key={i} disabled={!heard[step] || revealed || !!playing} onClick={() => setSelected(option)} className={`block w-full rounded-xl border-2 p-3 text-left ${revealed && option === q.answer ? 'border-green-500 bg-green-50' : option === selected ? 'border-blue-500 bg-blue-50' : 'border-neutral-200'}`}>{option}</button>)}</div>
        {revealed && <div role="status" className="mt-4 rounded-xl bg-neutral-50 p-3"><b>{selected === q.answer ? 'Correct.' : 'Best response: '+q.answer}</b><p>{q.explanation}</p><p className="mt-1 text-sm">The conversation continues using the best response.</p></div>}
        <button className="btn mt-5" disabled={!!playing || (!revealed && (!selected || !heard[step]))} onClick={revealed ? next : confirm}>{revealed ? step === questions.length-1 ? 'Continue to summary' : 'Next turn' : 'Submit response'}</button>
      </>}
      {phase === 'summary' && <>
        <h2 className="mb-3 font-black">Summarize the Conversation</h2>
        <p className="mb-3">Describe who was speaking, the situation, the main points discussed, and the outcome. Use complete sentences and your own words.</p>
        <textarea aria-label="Conversation summary" autoFocus className="min-h-48 w-full rounded-xl border-2 p-3" value={state.summary} onChange={e => setState(s => ({ ...s, summary: e.target.value }))} />
        <WordCount text={state.summary} /><button className="btn mt-4" onClick={finish}>Submit summary</button>
      </>}
    </>}
  </QuestionCard>
}
