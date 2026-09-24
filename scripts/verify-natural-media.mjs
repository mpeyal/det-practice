import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { spokenStrings, packKey, profiles } from './render-natural-voices.mjs'
const manifest = JSON.parse(fs.readFileSync('src/data/naturalVoicePack.json'))
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'parrot-media-check-'))
const report = { date: new Date().toISOString(), ok: false, clips: 0, audioMinutes: 0, bytes: 0, maxPeak: 0, originalRecordingsUnchanged: 0 }
try {
  for (const text of spokenStrings()) for (const gender of Object.keys(profiles)) {
    const key = packKey(text, gender), source = `public/voices-natural/${key}.m4a`
    assert(manifest.keys.includes(key), `Missing manifest ${key}`)
    const meta = JSON.parse(fs.readFileSync(`public/voices-natural/${key}.json`))
    assert.equal(meta.text, text); assert.equal(meta.voice, profiles[gender])
    const dest = path.join(temp, 'decoded.wav')
    execFileSync('/usr/bin/afconvert', ['-f', 'WAVE', '-d', 'LEI16', source, dest], { stdio: 'pipe' })
    const b = fs.readFileSync(dest); let offset = 12, rate, pcm
    while (offset + 8 <= b.length) {
      const name = b.toString('ascii', offset, offset + 4), size = b.readUInt32LE(offset + 4)
      if (name === 'fmt ') { assert.equal(b.readUInt16LE(offset + 10), 1); rate = b.readUInt32LE(offset + 12) }
      if (name === 'data') { pcm = b.subarray(offset + 8, offset + 8 + size); break }
      offset += 8 + size + size % 2
    }
    assert.equal(rate, 24000); assert(pcm?.length > 0)
    const seconds = pcm.length / 2 / rate
    assert(Math.abs(seconds - meta.seconds) < 0.25, `Duration mismatch ${key}: ${seconds}/${meta.seconds}`)
    let peak = 0; for (let n = 0; n < pcm.length; n += 2) peak = Math.max(peak, Math.abs(pcm.readInt16LE(n)) / 32768)
    assert(peak > 0.001, `Silent clip ${key}`)
    report.maxPeak = Math.max(report.maxPeak, peak)
    report.clips++; report.audioMinutes += seconds / 60; report.bytes += fs.statSync(source).size
    if (report.clips % 100 === 0) console.log(`Decoded ${report.clips}/${manifest.keys.length}`)
  }
  const installed = '/Applications/ParrotReady.app/Contents/Resources/app/dist/gpn/audio'
  const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex')
  for (const file of fs.readdirSync('public/gpn/audio')) {
    assert.equal(hash(`public/gpn/audio/${file}`), hash(path.join(installed, file)), `Original QR audio changed ${file}`)
    report.originalRecordingsUnchanged++
  }
  assert.equal(report.originalRecordingsUnchanged, 103)
  assert.equal(report.clips, manifest.keys.length)
  report.ok = true
  fs.writeFileSync('docs/voices/media-report.json', JSON.stringify(report, null, 2) + '\n')
  console.log('PASS', report)
} finally { fs.rmSync(temp, { recursive: true, force: true }) }
