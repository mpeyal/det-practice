# Setup Guide — DET Practice

A step-by-step guide to install and run the DET Practice app on **macOS** and
**Windows**. No prior coding experience needed — just follow the steps for your
system.

There are three ways to run it, from simplest to fullest:

| Mode | AI grading? | Best for |
|------|-------------|----------|
| **A. Just open the built file** | Self-score only | Quick offline practice, USB stick |
| **B. `npm run dev`** | API key (optional) | Trying it / developing |
| **C. `npm run serve`** | ✅ Your Claude subscription, one-click | Full experience |

---

## Step 1 — Install the prerequisites

You need **Node.js** (which includes `npm`) and **Git**.

### macOS

1. Install **Homebrew** (if you don't have it) — open **Terminal** (Cmd+Space, type "Terminal") and paste:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
2. Install Node.js and Git:
   ```bash
   brew install node git
   ```
3. Check they work:
   ```bash
   node --version    # should print v18 or higher
   git --version
   ```

*(No Homebrew? Alternatively download the Node.js installer from
<https://nodejs.org> — pick the "LTS" version — and Git from
<https://git-scm.com>.)*

### Windows

1. Download and run the **Node.js LTS installer** from <https://nodejs.org>
   (accept all defaults). This gives you `node` and `npm`.
2. Download and run **Git for Windows** from <https://git-scm.com/download/win>
   (accept all defaults).
3. Open **PowerShell** (Start menu → type "PowerShell") and check:
   ```powershell
   node --version    # should print v18 or higher
   git --version
   ```

---

## Step 2 — Get the code

Pick a folder (e.g. your Desktop) and clone the repo. Replace the URL with your
repository's URL if different.

**macOS (Terminal):**
```bash
cd ~/Desktop
git clone https://github.com/mpeyal/det-practice.git
cd det-practice
```

**Windows (PowerShell):**
```powershell
cd $HOME\Desktop
git clone https://github.com/mpeyal/det-practice.git
cd det-practice
```

Then install the dependencies (same on both systems):
```bash
npm install
```
This downloads the libraries into a `node_modules` folder (takes a minute).

---

## Step 3 — Run it

### Mode A — Simplest (offline, self-scoring)

Build the app once, then open the file:
```bash
npm run build
```
This creates a `dist` folder. Open **`dist/index.html`**:
- **macOS:** `open dist/index.html`
- **Windows:** `start dist/index.html`

The whole app runs in your browser with **no internet needed**. Writing and
speaking use bundled model answers + self-scoring (no AI grade).

> Tip: keep the whole `dist` folder together (it contains the photos). You can
> copy `dist` to a USB stick or another computer and it just works.

### Mode B — Development server

```bash
npm run dev
```
Open the URL it prints (usually <http://localhost:5199>). Changes reload live.

### Mode C — Full experience with AI grading (recommended)

This grades your writing & speaking automatically using **your Claude
subscription** (see Step 4 to set that up), or an API key.

```bash
npm run serve
```
Open <http://localhost:8000>. Writing/speaking reviews now show a
**"✨ Grade with Claude (subscription)"** button.

---

## Step 4 — (Optional) Enable AI grading

You have two independent options. **You do not need both.**

### Option 1 — Claude subscription (Pro/Max) — no API key, one click

This uses the **Claude Code CLI**, logged in with your subscription.

1. Install Claude Code: follow <https://claude.com/claude-code> (or, if you use
   the VS Code / Cursor "Claude Code" extension, it's already installed).
2. Log in with your Claude account:
   ```bash
   claude auth login      # opens a browser to sign in
   ```
   (If `claude` isn't found on Windows, the app also auto-detects the copy
   bundled with the VS Code extension — no extra step needed.)
3. Run the app with its backend:
   ```bash
   npm run serve
   ```
4. Open <http://localhost:8000>, do a writing/speaking task, and on the review
   screen click **"✨ Grade with Claude (subscription)"**.

You can switch account, log in a different user, or apply a per-app override in
the app: **⚙️ Settings → 🤖 AI Account → Manage**.

### Option 2 — Anthropic API key (pay-as-you-go, a fraction of a cent per grade)

1. Create a key at <https://console.anthropic.com>.
2. Open the app → **⚙️ Settings**, paste the key (it saves instantly, stored
   only in your browser).
3. Writing/speaking reviews show a **"✨ Grade with AI (API key)"** button.

*(Prefer to bake the key into a build? Copy `.env.example` to `.env`, set
`VITE_ANTHROPIC_API_KEY=sk-ant-...`, then `npm run build`. The `.env` file is
git-ignored.)*

> **A claude.ai subscription cannot be connected directly** to a plain
> browser app — that's why Option 1 uses the local backend (`npm run serve`),
> which drives the CLI that *is* logged in with your subscription.

---

## Step 5 — (Optional) Best listening-voice quality

All listening audio uses your browser/OS voices. To get natural, exam-like
speech:

- **macOS:** System Settings → Accessibility → Spoken Content → System Voice →
  *Manage Voices…* → download an **Enhanced** or **Premium** English voice
  (e.g. Ava, Evan, Zoe). They then appear in the app (Settings → Listening
  voices) and **work fully offline**. Use Safari or Chrome.
- **Windows:** open the app in **Microsoft Edge** — it ships neural
  "(Natural)" voices that sound close to the real test.

The app auto-picks the most natural voice and lets you pin a male/female pair
in **⚙️ Settings → Listening voices**.

---

## Step 6 — (Optional) Install as an app (PWA)

Run `npm run serve` (or `npm run preview`) and open the localhost URL in
**Chrome or Edge**. Click the install icon in the address bar to install it
like a native app that launches offline.

- **macOS Safari:** File → **Add to Dock**.

---

## Troubleshooting

- **`npm: command not found`** — Node.js isn't installed or the terminal wasn't
  reopened after installing. Close and reopen the terminal, redo Step 1.
- **`claude: command not found`** (Option 1) — install Claude Code, or just use
  the VS Code extension (the app auto-detects it). On Windows the backend
  searches the extension path automatically.
- **The "Grade with Claude (subscription)" button doesn't appear** — you must
  run **`npm run serve`** and open **localhost:8000** (not the `file://` build).
  The button only shows when the local backend is running.
- **Port already in use** — set a different port: `PORT=8100 npm run server`
  (macOS) / `$env:PORT=8100; npm run server` (Windows PowerShell).
- **Photos don't show when opening `dist/index.html`** — keep the whole `dist`
  folder together; the images live in `dist/photos/`.

---

## Adding your own content

All exam content is JSON in `src/data/`. Edit it, then run
`node scripts/validate-data.mjs` to check it, and rebuild. See the main
[README](README.md) for the schema of each file (word lists, sentences,
passages, conversations, writing/speaking prompts, photos).
