// Electron desktop wrapper — turns the web app into a double-click installable
// app. It starts the bundled Node backend (server/server.mjs) on a free local
// port and loads it in a window, so everything works exactly like
// `npm run serve`: fully offline exams + one-click Claude-subscription grading.

const { app, BrowserWindow, session, shell, Menu } = require('electron')
const path = require('path')
const { pathToFileURL } = require('url')

// electron/ and dist/ and server/ are siblings under the app root (dev and
// packaged alike, since we ship with asar disabled).
const APP_ROOT = path.join(__dirname, '..')
const DIST_DIR = path.join(APP_ROOT, 'dist')
const SERVER_ENTRY = path.join(APP_ROOT, 'server', 'server.mjs')

let mainWindow = null

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
    title: 'DET Practice',
    backgroundColor: '#f7f7f5',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
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
  app.whenReady().then(createWindow)
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
}
