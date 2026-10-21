import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // The service worker caused stale app-shell caching: after each deploy the
    // old SW kept serving a cached index.html that referenced asset filenames
    // which no longer existed, producing 404s on refresh after sign-in.
    //
    // `injectRegister: null` stops vite-plugin-pwa from emitting registerSW.js,
    // so no new worker is ever installed. The small script in index.html below
    // actively unregisters any worker a visitor already has and clears its
    // caches, so affected browsers heal on their next visit.
    VitePWA({
      selfDestroying: true,
      injectRegister: null,
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
