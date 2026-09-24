import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { spokenStrings, packKey, chunkText } from './render-natural-voices.mjs'
const manifest = JSON.parse(fs.readFileSync('src/data/naturalVoicePack.json'))
const source = fs.readFileSync('src/lib/tts.js', 'utf8')
  .replace(/^import .*\n/gm, '').replace(/export /g, '')
  .replaceAll('import.meta.env.BASE_URL', "'./'")
const us = { name: 'Samantha', lang: 'en_US' }, gb = { name: 'Daniel', lang: 'en-GB' }
function harness({ voices = [gb, us], nativeList = voices, native = true, audioFailure = false, audioThrow = false, nativeFailure = false, browserThrow = false, browserHang = false, delayedVoices = false } = {}) {
  const settings = { ttsEngine: 'neural', varyVoices: true, voiceMale: 'Daniel' }
  const clips = [], nativeCalls = [], browserCalls = []
  let resolveVoices
  let clock = Date.now()
  const ticks = new Set()
  const interval = (fn, ms) => { const id = setInterval(fn, ms); ticks.add({ id, fn }); return id }
  const clear = id => { clearInterval(id); for (const t of ticks) if (t.id === id) ticks.delete(t) }
  class FakeAudio {
    constructor(url) { this.src = url; clips.push(this) }
    play() { if (audioThrow) throw Error('audio unavailable'); return audioFailure ? Promise.reject(Error('decode')) : Promise.resolve() }
    pause() { this.paused = true }
  }
  const synth = { getVoices: () => voices, cancel() {}, speak(u) { if (browserThrow) throw Error('speech unavailable'); browserCalls.push(u); if (!browserHang) u.onend() } }
  const context = vm.createContext({ getSettings: () => settings, NATURAL_PACK: manifest, Audio: FakeAudio,
    Date: { now: () => clock }, setTimeout, clearTimeout, setInterval: interval, clearInterval: clear,
    SpeechSynthesisUtterance: class {
      constructor(text) { this.text = text }
      set voice(v) { assert(voices.includes(v), 'Chromium requires its own SpeechSynthesisVoice'); this._voice = v }
      get voice() { return this._voice }
    },
    window: { speechSynthesis: synth, ...(native ? { parrot: { platform: 'darwin', say: {
      voices: () => delayedVoices ? new Promise(r => { resolveVoices = r }) : Promise.resolve(nativeList),
      speak: async opts => { nativeCalls.push(opts); return { ok: !nativeFailure } }, stop: async () => {},
    } } } : {}) } })
  vm.runInContext(source + '\nglobalThis.api = { speak, stopSpeaking, usableVoices, voicePool, voiceOfGender, isSpeaking, conversationVoices };', context)
  return { ...context.api, clips, nativeCalls, browserCalls, settings, resolveVoices: () => resolveVoices(nativeList),
    advance: ms => { clock += ms; for (const t of [...ticks]) t.fn() }, activeTimers: () => ticks.size }
}
const sample = 'My sister walks to work every morning when the weather is nice.'
{
  const h = harness()
  assert.deepEqual(Array.from(h.usableVoices([gb, us, { name: 'Bells', lang: 'en-US' }])), [us])
  assert.equal(h.voiceOfGender('male').name, 'Samantha')
  assert(h.voicePool().every(v => /^en[-_]US$/i.test(v.lang)))
  const p = h.speak(sample, { voice: { neuralGender: 'male' }, rate: 0.75 })
  assert(h.clips[0].src.endsWith(`/voices-natural/${packKey(sample, 'male')}.m4a`))
  assert.equal(h.clips[0].playbackRate, 0.75)
  h.clips[0].onended(); assert.equal(await p, true); assert.equal(h.isSpeaking(), false)
  const stopped = h.speak(sample); h.stopSpeaking()
  assert.equal(await stopped, false); assert.equal(h.nativeCalls.length, 0)
  const previous = h.speak(sample), replacement = h.speak(sample)
  assert.equal(await previous, false); h.clips.at(-1).onended(); assert.equal(await replacement, true)
  assert.equal(h.nativeCalls.length, 0)
  h.settings.ttsEngine = 'system'
  assert.equal(await h.speak('Unknown text', { voice: gb }), true)
  assert.equal(h.nativeCalls.at(-1).voice, 'Samantha')
}
{
  const h = harness({ audioFailure: true })
  assert.equal(await h.speak(sample, { voice: { neuralGender: 'male' } }), true)
  assert.equal(h.nativeCalls[0].voice, 'Samantha')
}
{
  const h = harness({ delayedVoices: true })
  h.settings.ttsEngine = 'system'
  const p = h.speak('Cancelled before voices load')
  h.stopSpeaking(); h.resolveVoices()
  assert.equal(await p, false); assert.equal(h.nativeCalls.length, 0)
}
{
  const h = harness({ voices: [gb], native: false })
  h.settings.ttsEngine = 'system'
  assert.equal(await h.speak('No US voice'), false)
  assert.equal(h.browserCalls.length, 0)
}
{
  const h = harness({ native: false })
  h.settings.ttsEngine = 'system'
  assert.equal(await h.speak('US browser fallback', { voice: gb }), true)
  assert.equal(h.browserCalls[0].voice.name, 'Samantha')
}
// Exercise the real routing code against every source string, not just the manifest builder.
{
  const h = harness()
  for (const text of spokenStrings()) for (const gender of ['female', 'male']) {
    const p = h.speak(text, { voice: { neuralGender: gender } })
    assert(h.clips.at(-1).src.endsWith(`/voices-natural/${packKey(text, gender)}.m4a`))
    h.stopSpeaking(); assert.equal(await p, false)
  }
  assert.equal(h.nativeCalls.length, 0, 'A bank string fell back to system speech')
}
{
  const male = { name: 'Evan', lang: 'en-US' }
  const h = harness({ voices: [gb, us, male] })
  h.settings.ttsEngine = 'system'
  assert.equal(await h.speak('Rotating US system speaker', { voiceKey: 'b' }), true)
  assert.equal(h.nativeCalls.at(-1).voice, 'Evan')
}
{
  const male = { name: 'Evan', lang: 'en-US' }
  const h = harness({ voices: [], nativeList: [us, male] })
  h.settings.ttsEngine = 'system'
  assert.equal(await h.speak('Native-only voice rotation', { voiceKey: 'b' }), true)
  assert.equal(h.nativeCalls.at(-1).voice, 'Evan')
  assert.deepEqual(Array.from(h.conversationVoices(), v => v.name), ['Samantha', 'Evan'])
}
{
  const descriptor = { ...us }
  const h = harness({ nativeList: [descriptor], nativeFailure: true })
  h.settings.ttsEngine = 'system'
  assert.equal(await h.speak('Native fallback', { voice: descriptor }), true)
  assert.equal(h.browserCalls[0].voice, us)
}
{
  const h = harness({ native: false, browserThrow: true })
  h.settings.ttsEngine = 'system'
  assert.equal(await h.speak('Throwing browser'), false)
  assert.equal(h.activeTimers(), 0)
}
{
  const h = harness({ audioThrow: true })
  assert.equal(await h.speak(sample), true)
  assert.equal(h.clips[0].paused, true)
  assert.equal(h.activeTimers(), 0)
}
{
  const h = harness()
  const p = h.speak(sample, { rate: Infinity })
  assert.equal(h.clips[0].playbackRate, 1)
  h.advance(16000)
  assert.equal(await p, true, 'Stalled clip should recover with US native voice')
  assert.equal(h.clips[0].paused, true)
  assert.equal(h.activeTimers(), 0)
  assert.equal(await h.speak('  '), false)
}
{
  const h = harness({ native: false, browserHang: true })
  h.settings.ttsEngine = 'system'
  const p = h.speak('Never finishes')
  await new Promise(r => setTimeout(r, 100))
  h.advance(31000)
  assert.equal(await p, false)
  assert.equal(h.activeTimers(), 0)
}
{
  const h = harness({ native: false })
  h.settings.ttsEngine = 'system'
  const text = Array(100).fill('gentle friendly speech').join(' ') + '.'
  assert.equal(await h.speak(text), true)
  assert(h.browserCalls.every(u => u.text.length <= 180))
  assert.equal(h.browserCalls.map(u => u.text).join(' '), text)
}
const expected = spokenStrings().flatMap(t => ['female', 'male'].map(g => packKey(t, g))).sort()
assert.deepEqual(manifest.keys, expected)
assert.equal(new Set(expected).size, expected.length, 'hash collision')
for (const text of spokenStrings()) {
  const parts = chunkText(text)
  assert(parts.every(p => p.length <= 280))
  assert.equal(parts.join(' '), text.replace(/\s+/g, ' ').trim(), 'Chunking lost source text')
}
console.log(`PASS: ${expected.length} manifest entries; US-only selection, stale British pin, native/browser fallback, missing US voice, decode recovery, stop/replace and delayed cancellation; chunk text preserved.`)
