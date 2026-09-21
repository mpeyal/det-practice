// Build portable, offline listening clips using the Mac's installed voices.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const run = promisify(execFile)
const bank = JSON.parse(readFileSync('src/data/conversations.json', 'utf8'))
const strings = [...new Set(bank.flatMap(c => [c.scenario,c.opener.audio,...c.rounds.map(r=>r.audio)]))]
const temp = mkdtempSync(join(tmpdir(), 'parrot-listening-'))
mkdirSync('public/voices', { recursive: true })
const manifest = []
for (const [gender,voice] of [['female','Samantha'],['male','Daniel']]) {
  const pending = [...strings]
  await Promise.all(Array.from({length: 4}, async () => { while (pending.length) {
    const text = pending.shift()
    let h = 7
    for (const char of gender+text) h = (h*31+char.charCodeAt(0))>>>0
    const key = h.toString(16), output = `public/voices/${key}.m4a`
    if (!existsSync(output)) {
      const wav = join(temp, `${key}.aiff`)
      await run('/usr/bin/say', ['-v',voice,'-r','165','-o',wav,text])
      await run('/usr/bin/afconvert', ['-f','m4af','-d','aac','-b','64000',wav,output])
    }
    manifest.push(key)
  } }))
  console.log(`Rendered ${voice}: ${strings.length} clips`)
}
writeFileSync('src/data/listeningVoicePack.json', JSON.stringify(manifest.sort())+'\n')
