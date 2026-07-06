# ParrotReady — Offline Duolingo English Test Trainer

A fully offline-first practice app for the **2026 Duolingo English Test** format
(post-July-2025 update): all 13 question types with real exam timing, a Full
Timed Exam mode (50 distinct assembled exams) and a Section Practice mode,
local auto-grading with explanations, an estimated 10–160 score with per-skill
subscores, and optional AI marking of writing/speaking via the Anthropic API.

Everything runs locally: exam content is bundled JSON, listening audio is your
browser's built-in text-to-speech (SpeechSynthesis), speaking is recorded from
your microphone and stored in memory for replay.

> **Voice quality:** audio uses your browser's voices. The app ranks them,
> keeps a pool of the best female + male voices, rotates speakers between
> listening questions, and uses a female/male pair in conversations. Pin your
> preferred voices (with test buttons) in ⚙️ Settings.
> - **Windows:** open the app in **Microsoft Edge** — it ships neural
>   "(Natural)" voices very close to the real test.
> - **macOS:** System Settings ▸ Accessibility ▸ Spoken Content ▸ System
>   Voice ▸ *Manage Voices…* → download **Enhanced/Premium** voices (Ava,
>   Evan, Zoe, Nathan…). They appear in Safari and Chrome after download and
>   work fully offline. **The only feature that ever
touches the internet is AI marking, and it degrades gracefully to bundled
model answers + a self-scoring rubric.**

## Run it

> **New here?** See **[SETUP.md](SETUP.md)** for a full step-by-step install
> tutorial (macOS & Windows), including how to enable AI grading with your
> Claude subscription.

### Development
```bash
npm install
npm run dev          # http://localhost:5199
```

### Production / offline build
```bash
npm run build
```
This produces `dist/index.html` with **all JS/CSS inlined** — you can
double-click that file and the whole app runs from `file://` with no server
and no internet. Copy the `dist` folder anywhere (USB stick, another laptop).

### Install as a PWA (recommended)
Service workers need http(s), so to get the installable, always-offline PWA:
```bash
npm run build
npm run preview      # or any static file server over the dist folder
```
Open the served URL in Chrome/Edge and click the install icon in the address
bar. After the first load the app works with the network fully off, and
launches from your desktop/start menu like a native app.

## AI marking setup (optional, online only)

Three ways to get AI grading of writing/speaking, in order of convenience:

### A) Claude subscription — one-click, no API key (recommended if you have Claude Pro/Max)

If you have the **Claude Code CLI** installed and logged in (the same login as
your Claude Pro/Max subscription), run the app with its local backend:

```bash
npm run serve      # builds, then serves the app + grading backend on :8000
```

Open **http://localhost:8000**. Writing/speaking reviews now show a
**“✨ Grade with Claude (subscription)”** button that grades automatically —
the backend (`server/server.mjs`) shells out to the `claude` CLI, which uses
your subscription login. No API key, no copy/paste. Works in `npm run dev`
too (the dev server proxies `/api` to the backend on :8000 — run
`npm run server` alongside it).

This is fully local: the only network call is the CLI talking to Claude, same
as using Claude Code normally.

**Switching account / provider:** Settings ▸ **🤖 AI Account ▸ Manage** (only
shown when the backend is running) lets you see the signed-in Claude account,
**log in / switch user** (opens the browser sign-in), log out, apply a
**per-app credential override** (an API key or a `claude setup-token` OAuth
token, for THIS app only — your global login is untouched), or switch the
grading **provider to ChatGPT**. ChatGPT grading needs OpenAI's codex CLI
(`npm i -g @openai/codex` then `codex login` with your ChatGPT subscription);
if it isn't installed the dialog says so instead of failing silently.

### B) Anthropic API key — one-click, pay-as-you-go

Two ways to provide an Anthropic API key (never hardcoded):

1. **Settings screen** (easiest): open ⚙️ Settings in the app and paste your
   key. It is stored only in your browser's localStorage and sent only to
   `api.anthropic.com` when you press "Grade with AI".
2. **Build-time env var**: `cp .env.example .env`, set
   `VITE_ANTHROPIC_API_KEY=sk-ant-…`, rebuild. (Note: the key is then embedded
   in your local build — fine for personal use, don't share that build.)

When offline or without a key, writing/speaking review shows the bundled
**model answer + DET-style rubric** and lets you self-score — clearly labeled
as not an AI grade. API errors fall back the same way.

### C) Fully offline — self-score

No backend and no key: writing/speaking reviews show the bundled model answer
+ rubric and you self-score. There's also a **“💬 Grade by copy/paste”**
fallback that gives you a ready-made prompt to paste into claude.ai and paste
the reply back (useful if you can't run the local backend).

Model defaults to `claude-sonnet-5`; changeable in Settings.

## The exam format implemented

| # | Type | Timing |
|---|------|--------|
| 1 | Read and Select | 18 words × 5 s |
| 2 | Fill in the Blanks | 20 s each × 7 |
| 3 | Read and Complete | 3 min per paragraph |
| 4 | Interactive Reading | 3 min per passage, 6 linked tasks |
| 5 | Listen and Type | 1 min, max 3 plays |
| 6 | Interactive Listening | 4 min: conversation + best-reply choices + completion + summary |
| 7 | Write About the Photo | 1 min |
| 8 | Interactive Writing | 5 min + 3 min follow-up |
| 9 | Writing Sample (ungraded) | 5 min |
| 10 | Speak About the Photo | 20 s prep + 90 s |
| 11 | Read, Then Speak | 30 s prep + 90 s |
| 12 | Interactive Speaking | 6 questions × 35 s |
| 13 | Speaking Sample (ungraded) | 30 s prep + up to 3 min |

A Full Timed Exam = a mixed graded section (~45 min) then the two ungraded
samples (~10 min). Per-question countdowns auto-advance and you cannot go
back.

**Adaptive difficulty (like the real test):** every content bank is tiered
easy/medium/hard (authored levels for sentences, a text-complexity heuristic
for the rest), and generators scale with difficulty — harder tiers mask more
letters, add more gaps, and use longer/rarer words with more deceptive
pseudowords. The exam starts at medium and steps up when you score ≥80% on an
item, down at ≤45%. Scoring weights items by difficulty: a perfect run that
stays on easy tops out around ~120, and 160 requires beating hard items.
Practice sets form a training ramp: sets 1–10 easy, 11–20 medium, 21–30 hard.

## Project layout

```
src/
  lib/            rng, TTS, generators, grading, scoring, exam assembly,
                  AI client, mic recorder, storage (settings + history)
  data/           the bundled content banks (see below)
  questions/      one component per question type (13)
  components/     shared UI: timers, letter boxes, audio bar, recorder,
                  review detail views
  screens/        home, exam lobby/runner, practice menu/runner, review,
                  settings
scripts/
  validate-data.mjs   schema checker for the content banks
```

## Adding your own content

All content lives in `src/data/*.json`. After editing, run
`node scripts/validate-data.mjs` to catch schema mistakes, then rebuild.

- `wordlist.json` — `{ real: [...], fake: [...] }` for Read and Select. Fakes
  must be pronounceable non-words. (A rule-based generator also invents extra
  fakes at runtime.)
- `sentences.json` — `{ text, level, themes }`; used for both Fill in the
  Blanks (a word is auto-masked) and Listen and Type (read by TTS).
- `paragraphs.json` — `{ topic, text }`; Read and Complete auto-masks words.
- `passages.json` — Interactive Reading; see an existing entry. Gaps are
  `{1}{2}{3}` in `paragraph1`; each `highlight.answer` must be an exact
  substring of `paragraph2`.
- `conversations.json` — Interactive Listening; `turns` alternate spoken
  `line`s and best-reply `choice`s, plus a `completion` sentence (`{1}{2}`)
  and a `summary` with model + keywords.
- `writing.json` / `speaking.json` — prompts with model answers.
- `photos.json` — real CC0 photographs bundled in `public/photos/` (see
  `public/photos/ATTRIBUTIONS.md`), each with `img`, `alt` and model answers.
  To add your own: drop a `.jpg` in `public/photos/`, add an entry with
  `"img": "photos/yourfile.jpg"`, and write the alt + model answers. Entries
  may alternatively carry an inline `"svg"` scene instead of an image file.
  `scripts/fetch-photos.mjs` (online, one-time) can pull more freely-licensed
  photos from Wikimedia Commons' Unsplash CC0 collection.

Generated items (Read and Select, Fill in the Blanks, Read and Complete) are
seeded per exam number, so exam #12 is always the same test — retake it or
compare runs. Banked items rotate across the 50 exams so repeats are rare.

## Privacy

Results history and settings live in localStorage. Mic audio stays in memory
(gone on refresh). Nothing is transmitted anywhere except the text of a
response you explicitly send for AI grading.
