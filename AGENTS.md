# ParrotReady agent handoff

## User requirements — preserve these

Keep **GPN DET Sample** separate from all normal banks, normal section practice
and normal exams. Do not mix content in either direction until the user requests
it. GPN is **section-wise practice**, following the source PDF's 14 sections and
original question numbers/titles, not three mixed tests.

The user requires the complete PDF, all numbered samples, authoritative answer
keys, original QR recordings and photos, and interactions following the booklet's
exam screenshots. They specifically corrected the earlier partial import:
Read and Complete must have 40 questions; #1 is **A Gentle Touch, A Powerful
Impact**. Do not revert to the old 660-example/72-set partial implementation.

The user authorizes implementation and installation without repeated approval
questions. Preserve settings/history. Do not send their data to new services.

## Paths

- Project: `/Users/puspita/Developer/det-practice`
- Original PDF: `/Users/puspita/Desktop/GPN DET Sample Questions - Full.pdf`
- Bundled identical PDF: `public/gpn-booklet.pdf`
- Installed application: `/Applications/ParrotReady.app`
- Packaged application: `release/mac-arm64/ParrotReady.app`

## Current implementation (2026-09-23)

All **1,080 numbered samples** are imported in `src/data/gpnSamples.json`:

| Bank | Count |
|---|---:|
| Read and Complete | 40 |
| Read and Select | 500 |
| Fill in the Blanks | 60 |
| Listen and Type | 60 |
| Read Aloud | 60 |
| Interactive Reading | 40 passages, six tasks each |
| Interactive Listening | 40 conversations |
| Write About the Photo | 40 |
| Speak About the Photo | 40 |
| Interactive Writing | 40, each with all 3 follow-ups |
| Read Then Speak | 40 |
| Listen Then Speak | 40 |
| Writing Sample | 40 |
| Speaking Sample | 40 |

Also: 80 original question photos, 100 original QR question recordings, three
scored example recordings, six scored section examples with comments, and ten
conversation model summaries. All 194 physical PDF pages are accounted for in
`docs/gpn/coverage.json`. Reference instructions/screenshots/rules/further reading
are accessible in the bundled PDF. Printed page = physical page minus four.

### Code map

- `src/screens/GpnLobby.jsx`: all 14 active sections, timed/untimed choice.
- `src/screens/GpnSets.jsx`: original question numbers, RC titles, number/title
  search, 50 per page, completion checks, IW follow-up selector and scored examples.
- `src/screens/GpnBooklet.jsx`: PDF viewer opens at each section's physical page.
- `src/lib/gpnPractice.js`: GPN-only single-question assembly; original IDs/numbers.
  No normal banks are imported here. Follow-up variants have distinct IDs/titles.
- `src/App.jsx`: `gpn-lobby`, `gpn-section`, `gpn-booklet`, `gpn-practice` routes.
  `PracticeRunner` handles feedback; review returns to the selected GPN section.
- `ReadComplete.jsx`: literal source gaps and title, no generated GPN masks.
- `InteractiveReading.jsx`: conditional sixth step for GPN sentence completion,
  source subnumbers (e.g. 40.2), dropdowns/highlights/main idea/title, eight minutes.
  Normal passages without `payload.sentence` keep their existing workflow.
- `GpnListening.jsx`: booklet's 240-second conversation + 75-second summary.
  No modern comprehension stage is injected. Partner speech is limited to once.
- `RecordedAudio.jsx`: original bundled QR files, three plays, failure retry,
  cleanup on unmount. `ListenType.jsx` uses it conditionally for GPN.
- `GpnSpeaking.jsx`: ReadAloud 20-second recording, ListenThenSpeak 20-second
  audio preparation (3 plays) then 90-second recording without replay.
- `SpeakingTasks.jsx`: exported PrepRecordTask; GPN RTS overrides prep to 20s.
- `WritingTasks.jsx`: GPN Writing Sample gets 30 seconds prep before 5 minutes.
- `grading.js`, `scoring.js`, `QuestionView.jsx`, `SubjectiveReview.jsx`,
  `listening.js`: source schemas/new types/review/model summaries supported.
- `public/gpn/audio`, `public/gpn/photos`: full original media.
- `server/server.mjs`: PDF/WAV MIME types. `vite.config.js`: includes PDF/WAV offline.
- `public/photos/gpn-*.jpg` and `gpn-speaking-*.jpg` are older partial-import assets;
  retained because historical attempts may reference them.

### Source caveats — intentional, documented handling

`docs/gpn/README.md` and `source-issues.json` explain all reconciliations.
Keyed answer text wins where key letters disagree. Preserve original keys.
Three highlight answers are not literal spans; exact source-span alternatives
are accepted in addition to their keys. RC10's answer truncates; its ending is
restored from the question. RC2 has typed answer overlays that are excluded from
practice. IR has six tasks (normal app previously had five). IL4 omits a You
label before one response block; importer restores the turn.

The PDF contains 104 QR images: 103 official recordings plus one overlapping
Google Drive QR on ListenType6. The official recording matches the main key.
The alternate link remains in `qr-manifest.json`. Interactive Listening has
printed transcripts and no QR audio for its conversations; UI explicitly labels
its generated American English audio. Writing/speaking prompts have no single correct answer per
sample: existing AI/self-scoring applies, with the PDF's worked examples available.
Do not invent model answers and present them as source keys.

## Reproduction and verification

Requires Python PyMuPDF. Currently installed temporarily via
`PYTHONPATH=/private/tmp/gpn-pdf-tools`; this is not an app runtime dependency.

```sh
python3 scripts/gpn/import_pdf.py
python3 scripts/gpn/restore_media.py
python3 scripts/gpn/enrich_assets.py
node scripts/gpn/verify.mjs
node scripts/test-listening-format.mjs
node scripts/test-writing-grading.mjs
npm run build
./node_modules/.bin/electron scripts/gpn/ui-smoke.cjs
./node_modules/.bin/electron-builder --mac dir --publish never
```

All data assertions and both existing regression scripts pass. All 103 audio
files decode using macOS afinfo. Assembly was checked for all 1,080 source-only
IDs/numbers, 120 distinct follow-up variants and invalid-number rejection.
Electron smoke passes all 14 workflows, exact masks/titles, six reading tasks,
conversation summary, third follow-up, original audio/replay limits, prep-stage
transitions, timer expiry, grading, review and return. The smoke uses an isolated
profile under `/private/tmp/parrot-gpn-full-ui-check`; it does not record a real
microphone response. Screenshot: `/private/tmp/gpn-full-picker.png`.

## Deployment status

Full build, all 14 UI workflows, packaging, and installation are complete.
`/Applications/ParrotReady.app` contains the verified current HTML, identical
194-page source PDF, all 103 recordings and all 80 photos. Installed assets
match source files byte-for-byte. `codesign --verify --deep --strict` passed.
The user should quit and reopen ParrotReady if an older instance is running.
Settings/history were not changed by installation.

Normal question-bank files have not been edited. No DMG is
needed; install the packaged `.app` with `ditto`, then verify its resources and
`codesign --verify --deep --strict /Applications/ParrotReady.app`.

## Exhaustive sample testing and grading refinement — 2026-09-23 evening

User requested trying every sample and every feature. User additionally requires
**Improved version to develop a complete task-appropriate answer**, even when the
submitted long-writing response is just one sentence. Score only their original
response. Do not restore the old "similar length" instruction.

- `scripts/gpn/all-samples.cjs` completed **1,160 DOM-driven attempts**: every one
  of the 1,080 original samples plus the remaining 80 IW follow-up variants.
  Zero failures or renderer errors. Real installed HTML, question entry, correct
  answers, media loading/playback, all reading/conversation stages, review,
  return and history were exercised. AI responses in this exhaustive pass were
  controlled fixtures (460 grading requests), not 460 external AI calls.
- Separately, real connected OpenAI subscription grading succeeded for writing
  and speaking test responses (`docs/gpn/live-grade-report.json`).
- `src/lib/ai.js` now instructs complete, developed improved examples, with
  task-appropriate scope, relevant supporting details, and both IW parts.
  Original-response scoring stays separate. Read Aloud uses the exact prompt;
  photo and conversation examples stay grounded in supplied source information.
- Live provider verified "Parks are good." → 176-word developed answer, while
  scoring the original at 30; brief IW responses → 237-word two-part example,
  original scored 50. See `expanded-writing-report.json` (test outputs, not keys).
- `SubjectiveReview.jsx` labels the improved response as a complete example.
  Retry also now falls back to a configured API key when no CLI backend exists;
  this bug was reproduced against the old install and the fix verified using
  `scripts/gpn/grading-recovery.cjs` with controlled first-failure/second-success.
- `scripts/gpn/timers-and-recovery.cjs` passed complete expiry in all 14 types,
  original-audio failure/refund/retry and offline self-score/history. Countdown
  intervals accelerated 100x here; earlier smoke verified real 20-second expiry.
- `scripts/gpn/recording-check.cjs` passed real MediaRecorder + offline Vosk using
  generated speech supplied through Chromium's simulated microphone. Blob plays
  and survives submission. **No human microphone audio was captured.**
- `scripts/gpn/whisper-check.cjs` also passed the optional Transcribe recording
  action, producing a full accurate transcript from the same generated speech.
  It downloads its model on first use as the existing UI explains.
- These recording scripts require `/private/tmp/parrot-test-voice.wav`, generated
  using macOS say + afconvert. The test process disables Chromium's sandbox only
  to read that fake audio input file; application security settings are unchanged.
- Scripts use isolated temporary app profiles; user history/settings untouched.
- Existing writing/listening regressions and GPN data verification pass after
  the grading changes. Detailed JSON reports are in `docs/gpn/`.

Final grading refinements are packaged and installed in /Applications/ParrotReady.app.
Installed HTML matches dist byte-for-byte and code-signature verification passed. The exhaustive sample pass used the prior
installed full-content build; the final changes only affect grading instructions,
the improved-answer label and provider selection for retries.

## Natural American English voices — 2026-09-23 (installed)

User requested researching and improving unnatural/British voices. Research,
primary sources, reproduction and test instructions are in `docs/voices.md`.
Root causes were the old Mac renderer's Daniel (en_GB) clips and fallback voice
selection accepting every English locale.

### Implementation

- Generated speech now uses Kokoro-82M v1.0, fp32: **Heart / af_heart** (female)
  and **Michael / am_michael** (male), both American English. All **504 texts ×
  2 voices = 1,008 clips** are complete, about 203 minutes / 103 MB of AAC audio.
- `scripts/render-natural-voices.mjs` is the resumable build-time renderer.
  Tooling is installed separately under `/private/tmp/parrot-kokoro` (kokoro-js
  1.2.1); it is not an app dependency. See docs for `KOKORO_MODULE` commands.
  The app ships audio, not the model. No speech is sent to a new service.
- `src/data/naturalVoicePack.json` and `public/voices-natural/` cover normal
  dictation/conversations/speaking prompts, GPN written conversation turns and
  full review playback, plus Settings previews. GPN and normal question banks
  remain separate. Original GPN QR recordings remain byte-for-byte unchanged.
- `src/lib/tts.js`: new pack only; US-only native/browser fallback, including
  previously pinned British voices; cancellation resolves without restarting
  fallback; system speaker choice preserved when a matching US voice exists.
  If no US male system voice exists, an available US female voice is used.
- `AudioBar.jsx` recovery selects bundled voices without an old Piper download.
  `Settings.jsx` offers Natural US voices and previews of both speakers.
  `GpnListening.jsx` explicitly labels generated audio from the source transcript.
- Legacy voice assets/scripts remain for compatibility, but current TTS does
  not route through them. **Do not restore Daniel or the old pack priority.**
- Renderer bounds chunks to 280 characters, disables tokenizer truncation,
  checks the model limit, limits PCM peaks, and encodes mono 24 kHz AAC / 64 kbps.
  Model/library attribution and license are in `public/licenses/`.

### Verification and deployment

- `test-natural-voices.mjs`: all 1,008 actual runtime routes; strict US filtering,
  stale British pins, native/browser fallback, system speaker choice, decode
  recovery, cancellation/replacement and pending native enumeration.
- `verify-natural-media.mjs`: every clip decodes, has the expected duration,
  is mono 24 kHz and non-silent. Maximum decoded peak 0.976; all 103 original
  GPN recordings match the prior installation by SHA-256.
- `voice-ui-check.cjs`: real female/male previews, completion/cancellation,
  normal dictation (all three plays), normal scenario/partner playback, GPN
  conversation (one play), original GPN QR audio. External network blocked.
  Question clips play to their natural end; zero renderer errors.
- Real phoneme/token audit: 684 chunks, maximum 317 tokens against limit 510.
  Local Whisper checks on eight short/long samples matched source wording after
  ignoring punctuation/case. This is sampled intelligibility testing, not a
  human naturalness rating or transcription of every clip. Reports are in
  `docs/voices/`; optional model-check scripts are documented in `voices.md`.
- Writing grading, normal listening and all 1,080 GPN data regressions pass.
- Production build and Mac packaging pass. **Installed in
  `/Applications/ParrotReady.app`**. All 1,008 installed audio files and HTML match
  the verified source/build; original QR recordings also match. Code-signature
  verification (`codesign --verify --deep --strict`) passed. See
  `docs/voices/install-report.json`.
- Settings/history were not edited. Existing explicit System voices preference
  is preserved; choose Settings → Natural US voices to hear the new pair.
  Quit/reopen an older running instance to load the update.

## Voice evaluation and recovery fixes — 2026-09-23 late evening (installed)

User asked to evaluate/fix the voice update and make it natural and friendly.
Retained Heart/Michael, their original speed-1 synthesis and unchanged QR audio.
Six additional local Whisper samples (short greetings, fastest phrases, fastest
multi-chunk passages in both voices) all matched source wording. Report:
`docs/voices/boundary-transcription.json`. Median clip pace including pauses is
about 169 words/minute female, 150 male. Automated transcription/pace checks do
not establish subjective friendliness; no human naturalness rating was made.

Fixed in `src/lib/tts.js`:
- System voice selection now uses native-only Mac lists for gender/rotation.
- Native descriptors are mapped to actual browser SpeechSynthesisVoice objects
  on fallback; exceptions no longer strand replay controls.
- Bundled playback recovers after 15 seconds with no progress; browser speech
  has bounded chunks and a per-chunk deadline. Invalid rates fall back to 1×.
- Cleanup cancels old playback, releases timers, and prevents late events from
  restarting speech. Strict US filtering and cancellation guards remain.

`AudioBar.jsx` now locks rapid repeated clicks and isolates each question's
play count from stale playback completions. Reusing the component stops old
speech, resets its state and supports the next question's autoplay. Failures
and thrown engine errors refund the attempt and unlock retry.

Settings shows failed preview/speaker-test feedback. Rate selection applies
immediately to the next playback, including previews; 1× retains the original
voice pace. Pitch preservation is verified in real Electron AAC playback.

Verification:
- `node scripts/test-natural-voices.mjs`: 1,008 routes and added native-only,
  native-to-browser descriptor, exception, timeout and long-utterance cases.
- `./node_modules/.bin/electron scripts/audio-bar-check.cjs`: actual React
  controls with controlled engine results; double click, question replacement,
  stale completion, limit enforcement, failure/exception refund. Isolated profile.
- `voice-ui-check.cjs`: both real voice previews, speed/pitch, navigation,
  normal dictation/conversations, GPN conversation and original QR, failed-preview
  feedback; all passed, no renderer errors, external network blocked.
- Listening/writing regressions and all 1,080 GPN source assertions pass.
- Production build, packaging and installation complete. Installed HTML and all
  1,008 natural clips plus 103 original recordings match verified source/build
  bytes; strict code-signature verification passed. Updated install-report.json.

No user settings/history or question data changed. Quit/reopen the installed
app to load this version. AGENTS.md and docs/voices.md are the current handoff.

## GitHub repository handoff — 2026-09-23

The user requested uploading the completed app to
`https://github.com/mpeyal/det-practice`. This update groups the complete isolated
GPN practice implementation and source assets, writing-feedback refinements,
American voice pack, playback fixes, verification scripts/reports and this handoff.
The target branch is `main`. Existing normal question-bank data remains intact.

The production build and Mac installation were verified before this repository
update. Desktop installer CI runs only on a `v*` tag or manual workflow dispatch;
a normal branch push updates the source without publishing a new installer release.

## Desktop release 1.6.1

Version fields in package.json and package-lock.json are 1.6.1. Package build
configuration explicitly targets Windows x64 NSIS and a universal Mac DMG
(Intel + Apple Silicon), with architecture-specific artifact names. Ad-hoc
signing failure fails packaging instead of producing an unusable Mac download.

The existing GitHub Actions workflow is unchanged: the available GitHub token
can push code/tags and manage releases but cannot edit workflow files. Each
platform's job uploads its installer to the tagged release. The release body is
maintained in docs/releases/v1.6.1.md and applied through GitHub's API. Existing
app updater compatibility is preserved: one .exe and one universal .dmg. No paid
signing certificate or Apple notarization is configured. Check GitHub release
v1.6.1 and its Actions run for final publication status.
