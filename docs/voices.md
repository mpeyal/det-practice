# Natural American English listening voices

Research and implementation: 2026-09-23.

## Decision

Use Kokoro-82M v1.0, `af_heart` (female) and `am_michael` (male), generated
locally at build time using kokoro-js 1.2.1, CPU ONNX fp32. Both are explicitly
American English in the model author's voice inventory. This is a practical
choice for natural speech without requiring users to pay for a speech API or
upload content. It is not Duolingo's proprietary voice or an exact imitation.
Perceived naturalness is subjective; Settings offers previews of both speakers.

The DET listening paper describes American English pronunciation common in
mass media, education and commerce. The old app's Mac renderer used **Daniel
(en_GB)** for male conversation clips, and its fallback accepted any English
locale. Both routes could therefore produce British English.

References (primary sources):

- DET listening paper: https://englishtest-static.duolingo.com/media/resources/media/resources/whitepapers/listening-whitepaper.pdf
- Model card/license: https://huggingface.co/hexgrad/Kokoro-82M
- Voice inventory and short/long utterance limitations: https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md
- Author's implementation: https://github.com/hexgrad/kokoro
- JavaScript implementation: https://github.com/hexgrad/kokoro/tree/main/kokoro.js

Other local engines considered: KittenTTS (https://github.com/KittenML/KittenTTS)
and Supertonic (https://github.com/supertone-oss-archive/supertonic). Kokoro's
explicit US profiles and working native CPU implementation fit this app. The
Supertonic repository was archived on September 9, 2026; it was not chosen.
No objective head-to-head listening study was performed.

## Audio pipeline

`scripts/render-natural-voices.mjs` enumerates every generated spoken string:
normal dictation, normal conversation scenario/turns/full review, interactive
speaking questions, GPN conversation partner turns/full review, Settings tests.
Every string has both voices, preserving rotation and the female/male pair.
The complete pack contains **504 texts / 1,008 clips**.

Text stays verbatim. Sentence-aligned chunks are bounded to 280 characters,
including long sentences. Tokenization also explicitly disables truncation and
rejects inputs above the model limit. A separate full-bank phoneme check verified
all 684 chunks: maximum 317 tokens against the 510-token limit. PCM is joined with 120 ms gaps, finite/non-silent audio is checked,
and peaks are limited to 0.95 before encoding AAC mono at 24 kHz / 64 kbps.
This bitrate is supported by Apple's encoder at 24 kHz (96 kbps is not).
No speed distortion is baked in; generation uses speed 1. Playback preserves
pitch at the user's chosen speed.

`naturalVoicePack.json` maps exact text + gender hashes to `public/voices-natural`.
The runtime never selects the old Piper/Daniel packs. For unknown text or a file
error, system fallback accepts only en-US/en_US non-novelty voices. A previously
pinned British voice cannot bypass the filter. If no American male OS voice is
installed, the available American female voice is used; if no American voice is
available, playback returns failure instead of using an arbitrary default.
Interrupted playback resolves promptly and cannot restart via fallback.

GPN original QR recordings remain unchanged. GPN conversation transcripts contain
no original QR audio; their generated audio is explicitly labeled. The two
question banks remain separate; sharing a speech engine does not merge content.

The old optional runtime Piper downloads are no longer part of the playback or
recovery flow. Legacy files are retained for old app/history compatibility.
The app ships audio only, not the Kokoro model or its generation dependencies.

## Reproduce (Mac build tools)

Install build tooling outside the app's npm dependencies to avoid Electron native
module rebuilds. Models are downloaded once to the tooling directory's cache.
Only public model files are downloaded; synthesis is local.

```sh
npm install --prefix /private/tmp/parrot-kokoro kokoro-js@1.2.1
KOKORO_MODULE=/private/tmp/parrot-kokoro/node_modules/kokoro-js/dist/kokoro.js node scripts/render-natural-voices.mjs
```

The generator resumes matching completed clips. For two concurrent processes,
set `RENDER_GENDER=female` in one and `RENDER_GENDER=male` in the other. After
both finish, run the same command with `VERIFY_ONLY=1` to write the combined
manifest and `docs/voices/coverage.json`. Do not package a partial render.

The `.json` sidecars record text, voice, duration and chunk count for resumable
builds. The coverage report records the full provenance and all clip metadata.

## Verification

- `node scripts/test-natural-voices.mjs`: all source strings route to the new pack
  for both genders, strict US filtering, stale British pins, missing US voices,
  decode failure, stop/replace and cancellation while native voices load.
- `node scripts/verify-natural-media.mjs`: decode every AAC file, compare duration
  with synthesis metadata, check mono 24 kHz non-silent signal, and compare all
  103 original GPN recordings with the prior installation by SHA-256.
- `node scripts/test-listening-format.mjs`: normal listening format/scoring and
  current natural voice assets. Old Daniel clips no longer satisfy this gate.
- `./node_modules/.bin/electron scripts/voice-ui-check.cjs`: actual Settings
  preview audio, correct new URLs, completion, navigation cancellation and reuse.
  Set `TEST_DIST` to the installed app's dist directory to test deployment.
- `preview-transcription.json` and `generated-transcription.json`: local Whisper
  tiny.en checks, including a roughly one-minute full review in each voice.
  All eight sampled transcriptions matched their source wording after ignoring
  punctuation/case. This checks intelligibility and endings, not subjective
  naturalness or every word of all 1,008 clips. No speech was uploaded.

The model's author warns about very short utterances and long passages. Chunking
addresses overlong inputs; sampled short responses also passed local ASR. User
listening feedback remains useful for deciding which voice style they prefer.

Optional reproducible model checks (using the same external build-tool install):

```sh
KOKORO_MODULE=/private/tmp/parrot-kokoro/node_modules/kokoro-js/dist/kokoro.js node scripts/check-voice-tokens.mjs
KOKORO_MODULE=/private/tmp/parrot-kokoro/node_modules/kokoro-js/dist/kokoro.js node scripts/check-voice-transcription.mjs
```

## Installed result

The complete pack is installed in `/Applications/ParrotReady.app`. All 1,008
clips decoded successfully (203.12 minutes, 103,295,513 bytes), with maximum
decoded peak 0.976. Original GPN audio is unchanged. Full app playback/replay
checks passed with external networking blocked. Installed HTML and every audio
file match verified source/build bytes; code-signature verification passed.
See `voices/media-report.json`, `voices/ui-report.json` and
`voices/install-report.json`. Existing user settings and history were not edited.

## Follow-up evaluation and fixes — 2026-09-23 evening

Retained the original Heart/Michael synthesis at speed 1. Median clip pace is
approximately 169 words/minute for Heart and 150 for Michael (word count divided
by complete clip duration, including pauses). This measurement does not rate
warmth or prosody. Six additional local ASR samples cover both voices' shortest
greeting, fastest phrase, and fastest passage spanning multiple chunks. All
matched their source wording after punctuation/case normalization; see
`voices/boundary-transcription.json`. No clips or original QR audio were edited.

Playback fixes:

- Native-only Mac voice lists now retain female/male selection and rotation.
- Native-to-browser fallback resolves an actual browser voice object, avoiding
  a type error that could strand the playback control. British and novelty
  voices remain excluded.
- Stalled bundled clips recover after 15 seconds without playback progress.
  Browser utterances have bounded lengths and a timeout; engine exceptions
  resolve failure instead of leaving controls disabled. Cancellation still
  cannot trigger fallback audio.
- AudioBar synchronously locks repeat clicks, stops the old question on reuse,
  and rejects stale completions. Failed attempts refund the correct question.
- Settings previews show failure/retry feedback. Speed changes apply immediately
  to the next preview; 1× retains the original synthesized pace, and playback
  preserves pitch at the user's other speed choices.

Additional checks: `scripts/audio-bar-check.cjs` exercises actual React controls
with controlled speech outcomes; `test-natural-voices.mjs` covers native-only
voices, descriptor fallback, exceptions, stalls, invalid rates and long browser
utterances. `voice-ui-check.cjs` also checks real AAC pitch/rate settings and a
failed preview. These tests use isolated profiles and do not edit user settings.

```sh
CHECK_BOUNDARIES=1 KOKORO_MODULE=/private/tmp/parrot-kokoro/node_modules/kokoro-js/dist/kokoro.js node scripts/check-voice-transcription.mjs
./node_modules/.bin/electron scripts/audio-bar-check.cjs
```
