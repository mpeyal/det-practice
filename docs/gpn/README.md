# GPN booklet import audit

The complete 194-page source is bundled at `public/gpn-booklet.pdf`.
`coverage.json` accounts for every physical page and stores its SHA-256.
Printed page numbers are physical page numbers minus four.

## Imported inventory

| Section | Original question numbers | Physical pages |
|---|---:|---:|
| Read and Complete | 1–40 | 7–12 |
| Read and Select | 1–500 | 13–16 |
| Fill in the Blanks | 1–60 | 17–19 |
| Listen and Type | 1–60 | 20–22 |
| Read Aloud | 1–60 | 23–24 |
| Interactive Reading | 1–40, six tasks each | 25–73 |
| Interactive Listening | 1–40 | 74–125 |
| Write About the Photo | 1–40 | 126–133 |
| Speak About the Photo | 1–40 | 134–141 |
| Interactive Writing | 1–40, three follow-ups each | 142–149 |
| Read Then Speak | 1–40 | 150–152 |
| Listen Then Speak | 1–40 | 153–154 |
| Writing Sample | 1–40 | 155–157 |
| Speaking Sample | 1–40 | 158–160 |

Total: **1,080 numbered samples**, plus all 120 writing follow-up variants,
10 conversation model summaries and six scored section examples with comments.
The introduction's claim of five scored examples is outdated within the PDF;
the actual answer section has six, all included.

Pages 1–6 (front matter, introduction, rules), all exam screenshots and section
instructions, and page 194 (further reading) remain accessible in the complete
PDF viewer. They are reference material rather than additional numbered tests.

## Keys and source defects

All objective answers come from pages 161–189. Listen Then Speak transcripts
come from pages 192–193. Open-ended writing/speaking prompts do not each have
one correct answer in the PDF. Its six scored examples are available from their
section pickers; the ten conversation summaries appear in answer feedback.

`source-issues.json` records inconsistent option letters, abbreviated key text,
and invalid highlight spans. Match keyed **answer text**, not incorrect letters.
Exact selectable passage alternatives are accepted for highlights in 10, 20,
and 36 while retaining the printed key for feedback. Read and Complete 10's
key truncates after “a point of”; the remaining text and the missing word
“density” are restored from the question. RC12/17 have intact-word differences
between source question and key; the source wording and keyed gaps are kept.
RC14's key joins the words in two movie titles; question spacing is preserved.

RC questions use character coordinates to recover the literal masks. Helvetica
answer overlays on question 2 are excluded. No generated masks are used.
Interactive Listening 4 omits a “You:” label; its option block is restored as a
response turn. All 40 conversations validate against their full answer dialogues.
The isolated “s pecial” extraction in Speaking Sample 2 is normalized to “special”.

## Media

- `qr-manifest.json`: all **104 QR images**, with physical page, coordinates,
  PDF xref and decoded URL.
- `audio-manifest.json`: **103 downloaded recordings** (60 Listen and Type,
  40 Listen Then Speak, 3 scored examples), including provenance and file sizes.
- One alternate Google Drive QR overlays the official Listen and Type 6 QR.
  The official recording matches the answer key and is the practice recording;
  the overlay link is retained in the QR manifest, not treated as question 61.
- Interactive Listening has written dialogue and no individual conversation
  recordings in this PDF. Its practice explicitly labels generated American English audio. See `../voices.md` for the offline voice pack.
- `photo-manifest.json`: all **80 original question images**, with original
  numbers and printed pages; alt descriptions were added for accessibility
  and the app's text-based feedback service.
- All recordings decode successfully with macOS `afinfo`. Question audio uses
  the original file and is available offline, with replay limits enforced.

## Reproduce

Requires Python 3 with PyMuPDF (`pymupdf`). Run from the project root:

```sh
python3 scripts/gpn/import_pdf.py
python3 scripts/gpn/restore_media.py
python3 scripts/gpn/enrich_assets.py
node scripts/gpn/verify.mjs
npm run build
./node_modules/.bin/electron scripts/gpn/ui-smoke.cjs
```

The importer and enrichment script optionally accept another path to the same
PDF as their first argument. Do not use these hardcoded page ranges for a
different edition without auditing it. All runtime data/assets are in the repo;
no `/private/tmp` dependency ships in the application.

## Verified behavior

The data check covers consecutive numbering, all source masks, all option keys,
perfect and empty response grading, media existence/file signatures and skill
scoring. The Electron test uses an isolated temporary profile and completes all
14 workflows, including all six reading stages, summaries, third follow-ups,
recording-preparation transitions, original audio replay limits, timed expiry,
review and return navigation. It does not record a human microphone answer.
Existing normal listening and writing regression checks also pass.

## Exhaustive verification (2026-09-23 evening)

`all-samples-report.json` records **1,160 successful UI attempts**, covering all
1,080 original samples and all three follow-ups for each Interactive Writing
question. No failures or renderer errors. The pass used the installed full-content
build and controlled AI responses to exercise grading callbacks without issuing
hundreds of provider calls. It checked actual question interaction, feedback,
review, return navigation and saved attempts for every sample.

Separate real-provider checks are recorded in `live-grade-report.json` and
`expanded-writing-report.json`. The latter verifies the user's requested change:
short long-writing submissions now receive developed example answers while the
score assesses only the submitted text. These reports are test fixtures/results,
not additional PDF sample answers.

`timers-report.json` covers full countdown expiry in all 14 types (accelerated
clock), audio failure/refund/retry and offline self-scoring/history.
`recording-report.json` covers capture, live offline transcription, playable audio
and preserved submission. `whisper-report.json` covers the optional transcription
button. Generated speech was supplied through a simulated microphone; no ambient
or human microphone audio was recorded. `grading-recovery-report.json` verifies
the repaired API-key retry path using controlled replies.

Use `TEST_DIST=/absolute/path/to/dist` to test a new build with these scripts;
otherwise they load `/Applications/ParrotReady.app/Contents/Resources/app/dist`.
Each runs with an isolated temporary profile. The external-provider test cases
use short synthetic responses, not user history.
