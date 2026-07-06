import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Register the PWA service worker only when served over http(s) in a real
// browser. Skipped on file:// (not available, not needed) and inside the
// Electron desktop app (redundant — the app is already local — and avoids
// stale-cache issues across app updates).
const isElectron = /electron/i.test(navigator.userAgent)
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !isElectron) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
