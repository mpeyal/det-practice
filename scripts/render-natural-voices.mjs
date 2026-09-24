// Build-time only. Install kokoro-js in a separate tools directory (see docs/voices.md).
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const profiles = { female: 'af_heart', male: 'am_michael' }
export function packKey(text, gender) {
  let h = 7
  const s = gender + text
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h.toString(16)
}
export function spokenStrings() {
  const read = name => JSON.parse(fs.readFileSync(path.join(root, 'src/data', name)))
  const texts = new Set()
  const add = text => { if (text?.trim()) texts.add(text.trim()) }
  read('sentences.json').forEach(s => add(s.text))
  for (const c of read('conversations.json')) {
    add(c.scenario); add(c.opener?.audio)
    c.rounds?.forEach(r => add(r.audio))
    c.dialogue?.forEach(t => add(t.text))
    c.turns?.forEach(t => add(t.text))
    if (c.dialogue?.length) add(c.dialogue.map(t => t.text).join(' '))
  }
  read('speaking.json').interactive.forEach(c => c.questions.forEach(add))
  for (const c of read('gpnSamples.json').interactiveListening) {
    c.turns.filter(t => t.speaker === 'partner').forEach(t => add(t.text))
    add(c.dialogue.map(t => t.text).join(' '))
  }
  add('My sister walks to work every morning when the weather is nice.')
  add('This is the voice you will hear during the listening questions. If you can hear this clearly, your speaker is working.')
  return [...texts].sort()
}
// Bound every chunk, including long sentences. Never let tokenizer silently truncate.
export function chunkText(text, limit = 280) {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [text]
  const out = []; let current = ''
  for (const sentence of sentences) {
    if (current && (current + ' ' + sentence.trim()).length > limit) { out.push(current); current = '' }
    for (const word of sentence.trim().split(/\s+/)) {
      if (current && current.length + word.length + 1 > limit) { out.push(current); current = '' }
      current += (current ? ' ' : '') + word
    }
  }
  if (current) out.push(current)
  if (out.some(s => s.length > limit)) throw Error('Unexpected oversized token')
  return out
}
export function wav(samples, rate) {
  const b = Buffer.alloc(44 + samples.length * 2)
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22)
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34)
  b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40)
  let peak = 0
  for (const s of samples) { if (!Number.isFinite(s)) throw Error('Nonfinite audio'); peak = Math.max(peak, Math.abs(s)) }
  if (peak < 0.001) throw Error('Silent synthesis')
  const gain = Math.min(1, 0.95 / peak)
  samples.forEach((s, i) => b.writeInt16LE(Math.round(s * gain * 32767), 44 + i * 2))
  return b
}
async function render() {
  const modulePath = process.env.KOKORO_MODULE
  if (!modulePath) throw Error('Set KOKORO_MODULE to the installed kokoro-js module entry')
  const { KokoroTTS } = await import(pathToFileURL(modulePath))
  const model = 'onnx-community/Kokoro-82M-v1.0-ONNX'
  const tts = process.env.VERIFY_ONLY ? null : await KokoroTTS.from_pretrained(model, { dtype: 'fp32', device: 'cpu' })
  if (tts) {
    const tokenizer = tts.tokenizer
    tts.tokenizer = (text, options) => {
      const encoded = tokenizer(text, { ...options, truncation: false })
      if (Number(encoded.input_ids.dims.at(-1)) > 510) throw Error('Phonemes exceed model token limit')
      return encoded
    }
  }
  const out = path.join(root, 'public/voices-natural'); fs.mkdirSync(out, { recursive: true })
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'parrot-natural-'))
  const records = []; const keys = new Map(); const texts = spokenStrings()
  const total = texts.length * (process.env.RENDER_GENDER ? 1 : 2)
  console.log(`${texts.length} texts / ${total} clips`)
  try {
    for (const [gender, voice] of Object.entries(profiles)) for (const text of texts) {
      if (process.env.RENDER_GENDER && process.env.RENDER_GENDER !== gender) continue
      const key = packKey(text, gender), output = path.join(out, `${key}.m4a`)
      if (keys.has(key) && keys.get(key) !== gender + text) throw Error('Hash collision')
      keys.set(key, gender + text)
      const metaFile = path.join(out, `${key}.json`)
      let meta
      if (fs.existsSync(output) && fs.existsSync(metaFile)) meta = JSON.parse(fs.readFileSync(metaFile))
      if (!meta || meta.voice !== voice || meta.text !== text) {
        if (!tts) throw Error('Missing or invalid clip: ' + key)
        const chunks = chunkText(text), audioParts = []; let rate
        for (const chunk of chunks) {
          const a = await tts.generate(chunk, { voice, speed: 1 })
          rate = a.sampling_rate
          if (!a.audio.length) throw Error('Empty synthesis')
          audioParts.push(a.audio)
          audioParts.push(new Float32Array(Math.round(rate * 0.12)))
        }
        audioParts.pop()
        const samples = new Float32Array(audioParts.reduce((n, p) => n + p.length, 0))
        let offset = 0; for (const p of audioParts) { samples.set(p, offset); offset += p.length }
        const input = path.join(temp, 'clip.wav'), pending = path.join(temp, 'clip.m4a')
        fs.writeFileSync(input, wav(samples, rate))
        execFileSync('/usr/bin/afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '64000', input, pending])
        fs.renameSync(pending, output)
        meta = { key, gender, voice, text, seconds: samples.length / rate, chunks: chunks.length }
        fs.writeFileSync(metaFile, JSON.stringify(meta))
      }
      records.push(meta)
      if (records.length % 20 === 0) console.log(`${records.length}/${total} ${gender}`)
    }
    if (process.env.RENDER_GENDER) { console.log(`DONE ${records.length} ${process.env.RENDER_GENDER}`); return }
    const manifest = { model, dtype: 'fp32', sampleRate: 24000, codec: 'AAC 64kbps', profiles, keys: [...keys.keys()].sort() }
    fs.writeFileSync(path.join(root, 'src/data/naturalVoicePack.json'), JSON.stringify(manifest) + '\n')
    fs.mkdirSync(path.join(root, 'docs/voices'), { recursive: true })
    fs.writeFileSync(path.join(root, 'docs/voices/coverage.json'), JSON.stringify({ generatedAt: new Date().toISOString(), ...manifest, clips: records }, null, 2) + '\n')
    console.log(`DONE ${records.length} clips`)
  } finally { fs.rmSync(temp, { recursive: true, force: true }) }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await render() } catch (e) { console.error(e.message); process.exitCode = 1 }
}
