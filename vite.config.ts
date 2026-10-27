/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Which build this is, shown on the Collection screen as v1, v2…: one number per deploy, counted from the
 * deploy workflow's run number (APP_RUN in deploy.yml). Run 23 was the first numbered deploy, so it's v1.
 * Local builds have no number (null, shown as "dev").
 */
const FIRST_NUMBERED_RUN = 23
const run = Number(process.env.APP_RUN)
const build = { version: run ? run - FIRST_NUMBERED_RUN + 1 : null, time: new Date().toISOString() }

/**
 * Writes version.json next to the app. The app fetches it past the service worker (json isn't precached)
 * to tell whether a newer deploy is live than the one it's running.
 */
function versionFile(): Plugin {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(build) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/sports-cards/',
  define: { __BUILD__: JSON.stringify(build) },
  plugins: [
    react(),
    tailwindcss(),
    versionFile(),
    VitePWA({
      // New deploys activate on the next app launch; no "update available" prompt needed.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Sports Cards',
        short_name: 'Cards',
        description: 'My sports card collection',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          // The icon is full-bleed with the card inside the safe zone, so it doubles as maskable.
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Only the app shell is cached; Supabase data always comes from the network (online-only by design).
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'] },
    }),
  ],
  // The photo touch-up worker (lib/touchUpWorker.ts) is a module worker, which every browser the app targets runs.
  worker: { format: 'es' },
  build: {
    // supabase-js + React + zod in one chunk; it's precached by the service worker after the first visit.
    chunkSizeWarningLimit: 800,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Form tests type with user-event, which can exceed the 5s default when every file runs in parallel.
    testTimeout: 20_000,
    // Placeholders so modules that create the Supabase client load in CI; tests never reach the network.
    env: { VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'test-key' },
  },
})
