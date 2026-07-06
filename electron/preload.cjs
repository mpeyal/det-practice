// Preload bridge — exposes a tiny, safe API to the app (contextIsolation is on,
// so the web app can't touch Node directly). Used for self-update.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('parrot', {
  isDesktop: true,
  platform: process.platform,                 // 'win32' | 'darwin' | 'linux'
  version: () => ipcRenderer.invoke('app:version'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  runUpdate: (url) => ipcRenderer.invoke('update:run', url),
  onProgress: (cb) => ipcRenderer.on('update:progress', (_e, p) => cb(p)),
})
