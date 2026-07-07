// Electron desktop wrapper — turns the web app into a double-click installable
// app. It starts the bundled Node backend (server/server.mjs) on a free local
// port and loads it in a window, so everything works exactly like
// `npm run serve`: fully offline exams + one-click Claude-subscription grading.

const { app, BrowserWindow, session, shell, Menu, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const https = require('https')
const { spawn } = require('child_process')
const { pathToFileURL } = require('url')

// electron/ and dist/ and server/ are siblings under the app root (dev and
// packaged alike, since we ship with asar disabled).
const APP_ROOT = path.join(__dirname, '..')
const DIST_DIR = path.join(APP_ROOT, 'dist')
const SERVER_ENTRY = path.join(APP_ROOT, 'server', 'server.mjs')
const REPO = 'mpeyal/det-practice' // GitHub repo the app updates from

let mainWindow = null

// ---- self-update: read GitHub Releases, download + run the new installer ----

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ParrotReady', Accept: 'application/vnd.github+json' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return resolve(getJSON(res.headers.location))
      let d = ''; res.on('data', c => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } })
    }).on('error', reject)
  })
}

function download(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ParrotReady' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return resolve(download(res.headers.location, dest, onProgress))
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return }
      const total = Number(res.headers['content-length'] || 0)
      let got = 0
      const file = fs.createWriteStream(dest)
      res.on('data', c => { got += c.length; if (total) onProgress(got / total) })
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve(dest)))
      file.on('error', reject)
    }).on('error', reject)
  })
}

function cmpVer(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number)
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return 1; if ((pa[i] || 0) < (pb[i] || 0)) return -1 }
  return 0
}

function registerUpdateIPC() {
  ipcMain.handle('app:version', () => app.getVersion())

  ipcMain.handle('update:check', async () => {
    try {
      const rel = await getJSON(`https://api.github.com/repos/${REPO}/releases/latest`)
      const latest = String(rel.tag_name || '').replace(/^v/, '')
      const current = app.getVersion()
      const isWin = process.platform === 'win32'
      const asset = (rel.assets || []).find(a => (isWin ? a.name.endsWith('.exe') : a.name.endsWith('.dmg')))
      return {
        ok: true, current, latest,
        isNewer: Boolean(latest) && cmpVer(latest, current) > 0,
        url: asset ? asset.browser_download_url : rel.html_url,
        page: rel.html_url,
        canAutoInstall: isWin && Boolean(asset), // Mac unsigned can't self-install
      }
    } catch (e) { return { ok: false, error: e.message } }
  })

  ipcMain.handle('update:run', async (_e, url) => {
    // macOS (or no direct installer): open the download in the browser
    if (process.platform !== 'win32' || !url || !url.endsWith('.exe')) {
      shell.openExternal(url)
      return { opened: true }
    }
    // Windows: download the installer, run it, and quit so it can replace files
    const dest = path.join(os.tmpdir(), `ParrotReady-Setup-${Date.now()}.exe`)
    try {
      await download(url, dest, p => mainWindow?.webContents.send('update:progress', p))
      // /S = silent NSIS install (no wizard); the installer relaunches the app
      spawn(dest, ['/S'], { detached: true, stdio: 'ignore' }).unref()
      setTimeout(() => app.quit(), 500)
      return { installing: true }
    } catch (e) {
      shell.openExternal(url) // fall back to manual download
      return { opened: true, error: e.message }
    }
  })
}

// ---- native macOS speech (`say`) ----
// Chromium's speechSynthesis bridge on macOS is notoriously flaky (dropped /
// broken utterances). The desktop app can bypass it entirely: /usr/bin/say
// uses Apple's native engine (same as VoiceOver) — reliable, and it uses the
// user's downloaded Enhanced/Premium voices.
let sayProc = null
function registerSayIPC() {
  ipcMain.handle('say:speak', async (_e, { text, voice, rate } = {}) => {
    if (process.platform !== 'darwin') return { ok: false, error: 'not macos' }
    try { sayProc?.kill() } catch {}
    return await new Promise((resolve) => {
      const args = []
      if (voice) args.push('-v', String(voice))
      // `say` speaks ~175 words/min at default; scale by the app's rate
      if (rate && rate !== 1) args.push('-r', String(Math.round(175 * rate)))
      args.push(String(text))
      let p
      try { p = spawn('/usr/bin/say', args, { stdio: 'ignore' }) }
      catch (e) { resolve({ ok: false, error: e.message }); return }
      sayProc = p
      p.on('error', (e) => { if (sayProc === p) sayProc = null; resolve({ ok: false, error: e.message }) })
      p.on('exit', (code, signal) => {
        if (sayProc === p) sayProc = null
        // killed (stop/replaced) → interrupted, not an engine failure
        resolve({ ok: code === 0, interrupted: signal != null })
      })
    })
  })
  ipcMain.handle('say:stop', () => { try { sayProc?.kill() } catch {} ; sayProc = null; return true })

  // list the installed macOS voices (`say -v '?'`) so Settings can offer them
  ipcMain.handle('say:voices', async () => {
    if (process.platform !== 'darwin') return []
    return await new Promise((resolve) => {
      let out = ''
      let p
      try { p = spawn('/usr/bin/say', ['-v', '?'], { stdio: ['ignore', 'pipe', 'ignore'] }) }
      catch { resolve([]); return }
      p.stdout.on('data', d => { out += d.toString() })
      p.on('error', () => resolve([]))
      p.on('close', () => {
        const voices = []
        for (const line of out.split('\n')) {
          // "Samantha            en_US    # Hello, my name is Samantha."
          const m = line.match(/^(.+?)\s{2,}([a-z]{2}[-_][A-Z]{2})\s*#/)
          if (m) voices.push({ name: m[1].trim(), lang: m[2].replace('_', '-') })
        }
        resolve(voices)
      })
    })
  })
}

async function createWindow() {
  // Allow microphone (speaking tasks) — this is a local, user-owned app.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(permission === 'media' || permission === 'microphone')
  })
  session.defaultSession.setPermissionCheckHandler(() => true)

  // Start the backend (static app + /api grading) on a free port.
  let url = `file://${path.join(DIST_DIR, 'index.html')}` // fallback
  try {
    const { startServer } = await import(pathToFileURL(SERVER_ENTRY).href)
    const { port } = await startServer({ port: 0, distDir: DIST_DIR })
    url = `http://localhost:${port}`
  } catch (e) {
    console.error('backend failed to start, loading offline file:', e)
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 380,
    title: 'ParrotReady',
    backgroundColor: '#f7f7f5',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })
  Menu.setApplicationMenu(null)

  // open external links (claude.ai, console.anthropic.com) in the real browser
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//.test(target) && !target.startsWith('http://localhost')) {
      shell.openExternal(target)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  await mainWindow.loadURL(url)
  mainWindow.on('closed', () => { mainWindow = null })
}

// single instance
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } })
  registerUpdateIPC()
  registerSayIPC()
  app.whenReady().then(createWindow)
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
}
