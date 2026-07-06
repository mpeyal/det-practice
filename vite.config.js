import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

// base: './' + singlefile: the production build inlines all JS/CSS into
// dist/index.html so it opens directly over file:// with no server (browsers
// block external ES-module scripts on file://, so inlining is required).
// The PWA (service worker) additionally works when served over http(s) — see README.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    viteSingleFile({ removeViteModuleLoader: true }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'ParrotReady — Duolingo English Test Practice',
        short_name: 'ParrotReady',
        description: 'Offline-first practice app for the 2026 Duolingo English Test (DET) format',
        theme_color: '#58cc02',
        background_color: '#f7f7f5',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      },
      workbox: {
        // include the vosk speech model so the PWA works offline end-to-end
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,woff2,gz}'],
        maximumFileSizeToCacheInBytes: 64 * 1024 * 1024,
        // everything is bundled locally; only the Anthropic API is network-only
        navigateFallback: 'index.html'
      }
    })
  ],
  // dev mode proxies /api to the grading backend (server/server.mjs on :8000)
  // so subscription grading works with `npm run dev` too
  server: { port: 5199, proxy: { '/api': 'http://localhost:8000' } }
})
