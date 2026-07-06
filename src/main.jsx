import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Register the PWA service worker only when served over http(s).
// When the build is opened directly via file:// the app still works fully;
// service workers just aren't available there (and aren't needed — the
// files are already local).
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
