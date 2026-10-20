import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // The service worker caused stale app-shell caching: after each deploy the
    // old SW kept requesting asset filenames that no longer existed, producing
    // Vercel 404s until the browser cache was manually cleared.
    //
    // `selfDestroying: true` ships a service worker whose only job is to
    // unregister itself and delete existing caches, so browsers that already
    // installed an older worker heal themselves on the next visit.
    VitePWA({
      selfDestroying: true,
      registerType: 'autoUpdate',
      manifest: {
        name: 'Budget App',
        short_name: 'Budget',
        description: 'Professional Budget & Finance App',
        theme_color: '#0f172a',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
