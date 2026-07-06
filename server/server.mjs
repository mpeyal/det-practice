// Optional local backend for AGENTIC AI grading with a Claude subscription.
//
// The offline app itself never needs a server. This tiny Node server adds one
// capability: it shells out to the Claude Code CLI (`claude -p`), which is
// already logged in with your Claude Pro/Max subscription, so writing and
// speaking get graded automatically — no API key, no copy/paste.
//
// (Same approach as the NeuroVAT studio backend: a local process invokes the
// claude CLI, inheriting its subscription OAuth login.)
//
// Run:  npm run serve      → builds dist/ and serves it + /api on :8000
//       node server/server.mjs   → serve an existing dist/ + /api
//
// Endpoints:
//   GET  /api/health  → { ok, backend: 'claude-cli'|'none', cli }
//   POST /api/grade   → { ok, text }  (body: { prompt, model })

import { createServer } from 'node:http'
import { spawn, execSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import { join, extname, normalize, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import os from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'dist')
const PORT = Number(process.env.PORT) || 8000

// extra directories a CLI is commonly installed in but that a macOS/Linux GUI
// app (launched from Dock/Finder) does NOT get on its PATH.
const EXTRA_BIN_DIRS = (() => {
  const home = os.homedir()
  if (process.platform === 'win32') return []
  return [
    '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin',
    join(home, '.claude', 'local'), join(home, '.claude', 'bin'),
    join(home, '.local', 'bin'), join(home, '.npm-global', 'bin'),
    join(home, '.bun', 'bin'), join(home, '.deno', 'bin'),
    '/opt/homebrew/lib/node_modules/.bin', '/usr/local/lib/node_modules/.bin',
  ]
})()

// ---- locate the Claude Code CLI (standard installs, VS Code ext, PATH) ----
function findClaudeCli() {
  const home = os.homedir()
  const isWin = process.platform === 'win32'
  const exe = isWin ? 'claude.exe' : 'claude'
  // 1) known install locations
  const direct = [
    join(home, '.claude', 'local', exe),
    join(home, '.claude', 'bin', exe),
    join(home, '.local', 'bin', exe),
    join(home, '.npm-global', 'bin', exe),
    ...(isWin ? [] : EXTRA_BIN_DIRS.map(d => join(d, 'claude'))),
  ]
  for (const p of direct) if (existsSync(p)) return p
  // 2) VS Code / Cursor extension bundled binary (newest version wins)
  for (const ext of ['.vscode', '.vscode-insiders', '.cursor']) {
    const base = join(home, ext, 'extensions')
    if (!existsSync(base)) continue
    let dirs = []
    try { dirs = readdirSync(base).filter(d => d.startsWith('anthropic.claude-code-')).sort() } catch {}
    for (const d of dirs.reverse()) {
      const p = join(base, d, 'resources', 'native-binary', exe)
      if (existsSync(p)) return p
    }
  }
  // 3) macOS/Linux: ask the user's LOGIN shell where claude is (GUI apps get a
  //    minimal PATH, so this finds Homebrew/nvm/npm installs the app can't see)
  if (!isWin) {
    try {
      const shell = process.env.SHELL || '/bin/zsh'
      const out = execSync(`${shell} -lic 'command -v claude' 2>/dev/null`, { encoding: 'utf8', timeout: 5000 }).trim()
      if (out && existsSync(out)) return out
    } catch { /* ignore */ }
  }
  // 4) last resort: bare name on PATH
  return 'claude'
}

function findCodexCli() {
  const home = os.homedir()
  const isWin = process.platform === 'win32'
  const exe = isWin ? 'codex.exe' : 'codex'
  const cand = join(home, '.codex', 'bin', exe)
  if (existsSync(cand)) return cand
  return which('codex') ? 'codex' : null
}

const CLAUDE = findClaudeCli()
const CLI_FOUND = CLAUDE !== 'claude' || which('claude')
const CODEX = findCodexCli()

// ---- per-app account state (never written to disk; lives in this process) ----
// Mirrors the NeuroVAT "Claude account" dialog: switch provider, override the
// login for THIS app only, without touching the global Claude Code login.
const account = {
  provider: 'claude',      // 'claude' | 'openai'
  overrideKind: null,      // 'api_key' | 'oauth' | null
  overrideValue: null,
  openaiKey: null,
}

// environment for a spawned CLI, applying the per-app override
function cliEnv() {
  const env = { ...process.env }
  // ensure common install dirs are on PATH (GUI apps on macOS start minimal)
  if (EXTRA_BIN_DIRS.length) {
    const sep = ':'
    const have = new Set((env.PATH || '').split(sep))
    const add = EXTRA_BIN_DIRS.filter(d => !have.has(d))
    if (add.length) env.PATH = [env.PATH, ...add].filter(Boolean).join(sep)
  }
  if (account.overrideValue) {
    if (account.overrideKind === 'api_key') {
      env.ANTHROPIC_API_KEY = account.overrideValue
      delete env.CLAUDE_CODE_OAUTH_TOKEN
    } else {
      env.CLAUDE_CODE_OAUTH_TOKEN = account.overrideValue
      delete env.ANTHROPIC_API_KEY
    }
  }
  if (account.openaiKey) env.OPENAI_API_KEY = account.openaiKey
  return env
}

// run a short claude subcommand (auth status/login/logout), return {ok, out}
function runClaudeCmd(args, { detached = false, timeout = 30000 } = {}) {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(CLAUDE, args, {
        cwd: ROOT,
        shell: process.platform === 'win32',
        windowsHide: !detached,
        detached,
        stdio: detached ? 'ignore' : 'pipe',
        env: cliEnv(),
      })
    } catch (e) { resolve({ ok: false, out: e.message }); return }
    if (detached) { try { child.unref() } catch {} ; resolve({ ok: true, out: 'launched' }); return }
    let out = '', err = ''
    const timer = setTimeout(() => { try { child.kill() } catch {} ; resolve({ ok: false, out: 'timed out' }) }, timeout)
    child.stdout.on('data', d => (out += d))
    child.stderr.on('data', d => (err += d))
    child.on('error', e => { clearTimeout(timer); resolve({ ok: false, out: e.message }) })
    child.on('close', code => { clearTimeout(timer); resolve({ ok: code === 0, out: out || err }) })
  })
}

async function accountStatus() {
  const providers = {
    claude: { available: !!CLI_FOUND, cli: CLI_FOUND ? CLAUDE : null },
    openai: { available: !!CODEX, cli: CODEX },
  }
  const st = { provider: account.provider, providers, override: null, account: null }
  if (account.overrideValue) {
    st.override = { kind: account.overrideKind, tail: account.overrideValue.slice(-4) }
  }
  if (account.provider === 'claude' && CLI_FOUND) {
    const r = await runClaudeCmd(['auth', 'status'])
    if (r.ok) {
      try {
        const m = r.out.match(/\{[\s\S]*\}/)
        if (m) st.account = JSON.parse(m[0])
      } catch {}
    }
  }
  return st
}

function which(cmd) {
  const isWin = process.platform === 'win32'
  const paths = (process.env.PATH || '').split(isWin ? ';' : ':')
  const exts = isWin ? ['.exe', '.cmd', '.bat', ''] : ['']
  for (const p of paths) for (const e of exts) if (p && existsSync(join(p, cmd + e))) return true
  return false
}

// grading only needs plain text generation, so map to a safe CLI model alias
function cliModel(m) {
  const s = String(m || '').toLowerCase()
  if (s.includes('opus')) return 'opus'
  if (s.includes('haiku')) return 'haiku'
  return 'sonnet' // default: best quality/cost for grading
}

function spawnGrader(prompt, model) {
  // OpenAI (ChatGPT subscription) path via the codex CLI
  if (account.provider === 'openai') {
    if (!CODEX) return { error: 'ChatGPT/codex CLI not installed — run `npm i -g @openai/codex` and `codex login`, or switch provider to Claude' }
    const args = ['exec', '--sandbox', 'read-only']
    if (model && /^[a-z0-9._-]+$/i.test(model)) args.push('-m', model)
    args.push('-')
    return { cli: CODEX, args, kind: 'codex' }
  }
  // Claude path
  if (!CLI_FOUND) return { error: 'claude CLI not found — install Claude Code and log in' }
  return { cli: CLAUDE, args: ['-p', '--output-format', 'json', '--model', cliModel(model)], kind: 'claude' }
}

function runClaude(prompt, model) {
  return new Promise((resolve) => {
    const spec = spawnGrader(prompt, model)
    if (spec.error) { resolve({ ok: false, error: spec.error }); return }
    let child
    try {
      child = spawn(spec.cli, spec.args, {
        cwd: ROOT,
        shell: process.platform === 'win32', // resolve a .cmd shim if needed
        windowsHide: true,
        env: cliEnv(),
      })
    } catch (e) {
      resolve({ ok: false, error: `could not launch ${spec.kind} CLI: ${e.message}` })
      return
    }
    let out = '', err = ''
    const timer = setTimeout(() => { try { child.kill() } catch {} ; resolve({ ok: false, error: 'grading timed out (120s)' }) }, 120000)
    child.stdout.on('data', d => (out += d))
    child.stderr.on('data', d => (err += d))
    child.on('error', e => { clearTimeout(timer); resolve({ ok: false, error: `${spec.kind} CLI error: ${e.message}` }) })
    child.on('close', () => {
      clearTimeout(timer)
      if (spec.kind === 'codex') {
        // codex exec prints the plain assistant reply on stdout
        if (!out.trim()) { resolve({ ok: false, error: (err || 'no output from codex').slice(-500) }); return }
        resolve({ ok: true, text: out })
        return
      }
      // claude --output-format json prints a result envelope on stdout
      const m = out.match(/\{[\s\S]*\}\s*$/)
      if (!m) { resolve({ ok: false, error: (err || out || 'no output from claude CLI').slice(-500) }); return }
      try {
        const data = JSON.parse(m[0])
        if (data.is_error) { resolve({ ok: false, error: data.result || 'CLI reported an error' }); return }
        resolve({ ok: true, text: data.result || '' })
      } catch {
        resolve({ ok: false, error: 'could not parse claude CLI output' })
      }
    })
    child.stdin.write(prompt)
    child.stdin.end()
  })
}

// ---- static file serving (serves the built dist/) ----
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain', '.md': 'text/markdown',
}

async function serveStatic(req, res, distDir) {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (path === '/') path = '/index.html'
  const full = normalize(join(distDir, path))
  if (!full.startsWith(distDir)) { res.writeHead(403).end('forbidden'); return }
  try {
    const body = await readFile(full)
    res.writeHead(200, { 'content-type': MIME[extname(full)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    // SPA fallback
    try {
      const body = await readFile(join(distDir, 'index.html'))
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(body)
    } catch {
      res.writeHead(404).end('not found (run `npm run build` first)')
    }
  }
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*' })
  res.end(JSON.stringify(obj))
}

function makeHandler(distDir) {
  return async (req, res) => {
  const url = new URL(req.url, 'http://x')

  if (req.method === 'OPTIONS' && url.pathname.startsWith('/api')) {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
    })
    res.end(); return
  }

  if (url.pathname === '/api/health') {
    const anyBackend = (account.provider === 'claude' && CLI_FOUND) || (account.provider === 'openai' && CODEX)
    sendJson(res, 200, { ok: true, backend: anyBackend ? `${account.provider}-cli` : 'none', provider: account.provider, cli: CLI_FOUND ? CLAUDE : null })
    return
  }

  // --- account management (mirrors the NeuroVAT "Claude account" dialog) ---
  if (url.pathname === '/api/account' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, ...(await accountStatus()) })
    return
  }

  if (url.pathname.startsWith('/api/account/') && req.method === 'POST') {
    let raw = ''
    req.on('data', c => { raw += c; if (raw.length > 100_000) req.destroy() })
    req.on('end', async () => {
      let body = {}
      try { body = raw ? JSON.parse(raw) : {} } catch {}
      const action = url.pathname.split('/').pop()

      if (action === 'login') {
        if (!CLI_FOUND) { sendJson(res, 503, { ok: false, error: 'claude CLI not found' }); return }
        // launch interactive browser sign-in in its own console window
        const r = await runClaudeCmd(['auth', 'login'], { detached: true })
        sendJson(res, 200, { ok: r.ok, message: 'A sign-in window/browser is opening. Finish there, then Refresh.' })
        return
      }
      if (action === 'logout') {
        const r = await runClaudeCmd(['auth', 'logout'])
        sendJson(res, 200, { ok: r.ok, message: r.out })
        return
      }
      if (action === 'provider') {
        const p = String(body.provider || '').toLowerCase()
        if (!['claude', 'openai'].includes(p)) { sendJson(res, 400, { ok: false, error: 'provider must be claude|openai' }); return }
        account.provider = p
        sendJson(res, 200, { ok: true, ...(await accountStatus()) })
        return
      }
      if (action === 'override') {
        // per-app credential override for Claude (API key or OAuth setup-token)
        const kind = body.kind === 'oauth' ? 'oauth' : 'api_key'
        const value = String(body.value || '').trim()
        account.overrideKind = value ? kind : null
        account.overrideValue = value || null
        sendJson(res, 200, { ok: true, ...(await accountStatus()) })
        return
      }
      if (action === 'openai-key') {
        account.openaiKey = String(body.value || '').trim() || null
        sendJson(res, 200, { ok: true, ...(await accountStatus()) })
        return
      }
      sendJson(res, 404, { ok: false, error: 'unknown account action' })
    })
    return
  }

  if (url.pathname === '/api/grade' && req.method === 'POST') {
    let raw = ''
    req.on('data', c => { raw += c; if (raw.length > 2_000_000) req.destroy() })
    req.on('end', async () => {
      let body
      try { body = JSON.parse(raw) } catch { sendJson(res, 400, { ok: false, error: 'bad JSON' }); return }
      if (!body.prompt) { sendJson(res, 400, { ok: false, error: 'missing prompt' }); return }
      if (!CLI_FOUND) { sendJson(res, 503, { ok: false, error: 'claude CLI not found — install Claude Code and log in' }); return }
      const result = await runClaude(body.prompt, body.model)
      sendJson(res, result.ok ? 200 : 502, result)
    })
    return
  }

  serveStatic(req, res, distDir)
  }
}

/**
 * Start the server. Returns a Promise<{ server, port }>.
 * - port 0 picks a free port (used by the Electron desktop wrapper).
 * - distDir defaults to ../dist relative to this file (used by `npm run serve`).
 */
export function startServer({ port = PORT, distDir = DIST } = {}) {
  const server = createServer(makeHandler(distDir))
  return new Promise((resolve) => {
    server.listen(port, () => {
      const actual = server.address().port
      console.log(`\n  ParrotReady server → http://localhost:${actual}`)
      console.log(`  AI grading backend: ${CLI_FOUND ? `claude CLI ✓ (${CLAUDE})` : 'NOT found — offline/self-score only'}`)
      resolve({ server, port: actual })
    })
  })
}

// Auto-start only when run directly (npm run server / serve), not when imported
// by the Electron main process.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer({ port: PORT, distDir: DIST })
}
