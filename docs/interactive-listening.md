# Interactive Listening practice

The practice flow follows the July 2025 DET update:

1. Listen and Complete: hear a scenario and fill three short sentence gaps. Scenario audio can be replayed.
2. Listen and Respond: five conversation turns with immediate best-answer feedback. Each partner turn plays once; the scenario remains replayable. The first two stages share 390 seconds.
3. Summarize the Conversation: write a summary under a new 75-second clock. The summary is saved and receives the app's AI writing feedback separately from objective listening marks.

Untimed practice uses the same stages without the timers. Timed practice plays speech at normal speed. Audio failures permit another attempt; successful partner playback cannot be replayed.

The 12 conversations are original practice material. Answer checking accepts listed alternatives, punctuation differences, and small spelling errors in longer answers; it is not Duolingo's semantic scoring engine. Summary grades and overall scores are practice estimates.

Bundled audio uses Samantha for conversation partners and Daniel for scenario narration. Both voice versions are shipped for each line, so playback does not require downloading a speech model. Run `node scripts/render-listening-voices.mjs` on macOS to regenerate changed clips. The PWA precaches the M4A assets.

Checks: `node scripts/validate-data.mjs`, `node scripts/test-listening-format.mjs`, and `node scripts/test-writing-grading.mjs`.

Sources:
- https://testcenter.zendesk.com/hc/en-us/articles/36094888038029-Test-Update-Expanded-Interactive-Listening-question
- https://englishtest-static.duolingo.com/media/resources/Question%20Guide%20(2025).pdf (Interactive Listening, pages 11–14)
