// One-time (online) helper: downloads freely-licensed photos from Wikimedia
// Commons into public/photos/ so the photo tasks can use real photographs
// while the app itself stays fully offline. Prefers the CC0 Unsplash
// collection mirrored on Commons (modern, natural-looking photos) and
// records license/attribution. Run: node scripts/fetch-photos.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'photos')
mkdirSync(outDir, { recursive: true })

const SCENES = [
  { id: 'ph1', query: 'picnic park unsplash' },
  { id: 'ph2', query: 'cooking kitchen unsplash' },
  { id: 'ph3', query: 'reading book unsplash' },
  { id: 'ph4', query: 'soccer ball field unsplash' },
  { id: 'ph5', query: 'market fruit stall unsplash' },
  { id: 'ph6', query: 'riding bicycle street unsplash' },
  { id: 'ph7', query: 'walking dogs unsplash' },
  { id: 'ph8', query: 'train station platform unsplash' },
  { id: 'ph9', query: 'flowers bouquet holding unsplash' },
  { id: 'ph10', query: 'birthday cake candles unsplash' },
  { id: 'ph11', query: 'coffee shop barista unsplash' },
  { id: 'ph12', query: 'beach sand children unsplash' },
  { id: 'ph13', query: 'tractor farm unsplash' },
  { id: 'ph14', query: 'street musician guitar unsplash' },
  { id: 'ph15', query: 'hiking mountains backpack unsplash' },
  { id: 'ph16', query: 'typing laptop hands unsplash' },
  { id: 'ph17', query: 'airport terminal window unsplash' },
  { id: 'ph18', query: 'basketball hoop unsplash' },
  { id: 'ph19', query: 'paint brushes palette unsplash' },
  { id: 'ph20', query: 'vegetables basket market unsplash' },
  { id: 'ph21', query: 'umbrella rain street unsplash' },
  { id: 'ph22', query: 'ice cream cone hand unsplash' },
  { id: 'ph23', query: 'camping tent forest unsplash' },
  { id: 'ph24', query: 'breakfast pancakes plate unsplash' },
]

const OK_LICENSE = /^(cc0|public domain|pd|cc[ -]by(?:[ -]sa)?[ -]?\d)/i
const BAD_TITLE = /nude|nudist|naked|drawing|diagram|logo|map|flag|poster|painting|engraving|screenshot|book page|manuscript/i

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function api(params, tries = 4) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ format: 'json', origin: '*', ...params })
  for (let t = 0; t < tries; t++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'det-practice-app/1.0 (personal offline study tool; contact: local)' } })
    const text = await res.text()
    try { return JSON.parse(text) } catch {
      console.log(`  rate-limited, backing off ${(t + 1) * 5}s…`)
      await sleep((t + 1) * 5000)
    }
  }
  throw new Error('API kept rate-limiting')
}

async function search(query) {
  const data = await api({
    action: 'query', generator: 'search',
    gsrsearch: `filetype:bitmap ${query}`, gsrlimit: '10', gsrnamespace: '6',
    prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '1000',
  })
  return Object.values(data?.query?.pages || {})
}

function candidates(pages) {
  const out = []
  for (const p of pages) {
    const ii = p.imageinfo?.[0]
    if (!ii) continue
    const license = ii.extmetadata?.LicenseShortName?.value || ''
    if (!OK_LICENSE.test(license)) continue
    if (!/\.(jpe?g|png)$/i.test(ii.url)) continue
    if (ii.width < 640 || ii.height < 420) continue
    if (BAD_TITLE.test(p.title)) continue
    let score = /unsplash/i.test(p.title) ? 5 : 0 // modern CC0 photography
    if (ii.width > ii.height) score += 2
    if (/^(cc0|public domain)/i.test(license)) score += 1
    out.push({ p, ii, license, score })
  }
  return out.sort((a, b) => b.score - a.score)
}

async function download(url, tries = 5) {
  for (let t = 0; t < tries; t++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'det-practice-app/1.0 (personal offline study tool)' } })
    const buf = Buffer.from(await res.arrayBuffer())
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8
    const isPng = buf[0] === 0x89 && buf[1] === 0x50
    if (buf.length >= 30_000 && (isJpeg || isPng)) return buf
    // small body = throttle/error page; back off and retry
    await sleep(6000 * (t + 1))
  }
  throw new Error('bad file after retries')
}

// e.g. `node scripts/fetch-photos.mjs ph2,ph5` re-fetches specific ones
const onlySet = new Set((process.argv[2] || '').split(',').filter(Boolean))
const only = onlySet.size > 0
const attributions = []
for (const scene of SCENES) {
  if (only && !onlySet.has(scene.id)) continue
  try {
    const cands = candidates(await search(scene.query))
    let saved = false
    for (const cand of cands.slice(0, 4)) {
      try {
        const buf = await download(cand.ii.thumburl || cand.ii.url)
        writeFileSync(join(outDir, `${scene.id}.jpg`), buf)
        const author = (cand.ii.extmetadata?.Artist?.value || 'Unknown').replace(/<[^>]+>/g, '').trim()
        attributions.push({
          id: scene.id, file: `photos/${scene.id}.jpg`, title: cand.p.title,
          author, license: cand.license, source: cand.ii.descriptionurl,
          sizeKB: Math.round(buf.length / 1024),
        })
        console.log(`✓ ${scene.id}: ${cand.p.title} [${cand.license}] ${Math.round(buf.length / 1024)}KB`)
        saved = true
        break
      } catch (e) { console.log(`  ${scene.id}: skip candidate (${e.message})`) }
    }
    if (!saved) console.log(`✗ ${scene.id}: nothing acceptable`)
  } catch (e) {
    console.log(`✗ ${scene.id}: ${e.message}`)
  }
  await sleep(8000) // stay well under the rate limit
}

if (!only) writeFileSync(join(root, 'scripts', 'photo-attributions.json'), JSON.stringify(attributions, null, 2))
else console.log(JSON.stringify(attributions, null, 2))
console.log('done')
