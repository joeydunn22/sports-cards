/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/sports-cards/',
  plugins: [
    react(),
    tailwindcss(),
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
